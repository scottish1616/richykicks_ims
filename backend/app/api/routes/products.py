"""
Product & category routes. Admin manages products/categories; Staff
gets read-only access to products/stock (PRD sections 3-6). Stock
quantity is intentionally NOT editable here - it only ever changes
through the sales and receiving-approval workflows.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db, require_admin, require_any_role
from app.core.csrf import verify_csrf
from app.core.product_sizes import sizes_for_category
from app.models.category import Category
from app.models.product import Product
from app.models.user import User
from app.schemas.product import (
    CategoryRead,
    ProductCreate,
    ProductRead,
    ProductUpdate,
    ProductVariantAdjustmentRequest,
    ProductVariantRead,
    StockAdjustmentRequest,
)
from app.services import audit_service, inventory_service

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[ProductRead], dependencies=[Depends(require_any_role)])
def list_products(
    include_inactive: bool = Query(default=False),
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    # TODO: pagination, category filter, search (PRD section 49)
    if include_inactive and user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    query = db.query(Product)
    if not include_inactive:
        query = query.filter(Product.is_active.is_(True))
    return query.order_by(Product.name).all()


@router.post("", response_model=ProductRead, dependencies=[Depends(verify_csrf)])
def create_product(
    payload: ProductCreate, user: User = Depends(require_admin), db: Session = Depends(get_db)
):
    if db.get(Category, payload.category_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category not found")

    product = Product(**payload.model_dump())
    db.add(product)
    db.flush()  # assign product.id before the audit row references it
    audit_service.log_event(
        db,
        event_type="product.created",
        user_id=user.id,
        resource=f"product:{product.id}",
        result="success",
        metadata={"name": product.name, "listed_price": str(product.listed_price)},
        commit=False,
    )
    db.commit()
    db.refresh(product)
    return product


@router.patch(
    "/{product_id}", response_model=ProductRead, dependencies=[Depends(verify_csrf)]
)
def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    update_data = payload.model_dump(exclude_unset=True)

    if "category_id" in update_data and db.get(Category, update_data["category_id"]) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category not found")

    price_changed = "listed_price" in update_data and update_data["listed_price"] != product.listed_price
    old_price = product.listed_price

    for field, value in update_data.items():
        setattr(product, field, value)

    audit_service.log_event(
        db,
        event_type="product.updated",
        user_id=user.id,
        resource=f"product:{product.id}",
        result="success",
        metadata={"fields_changed": list(update_data.keys())},
        commit=False,
    )
    if price_changed:
        audit_service.log_event(
            db,
            event_type="product.price_changed",
            user_id=user.id,
            resource=f"product:{product.id}",
            result="success",
            metadata={"old_price": str(old_price), "new_price": str(product.listed_price)},
            commit=False,
        )

    db.commit()
    db.refresh(product)
    return product


def _set_product_active(
    product_id: uuid.UUID,
    active: bool,
    user: User,
    db: Session,
) -> Product:
    product = (
        db.query(Product)
        .filter(Product.id == product_id)
        .with_for_update()
        .first()
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if product.is_active == active:
        return product

    product.is_active = active
    try:
        audit_service.log_event(
            db,
            event_type="product.reactivated" if active else "product.deactivated",
            user_id=user.id,
            resource=f"product:{product.id}",
            result="success",
            metadata={"name": product.name},
            commit=False,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(product)
    return product


@router.post(
    "/{product_id}/deactivate",
    response_model=ProductRead,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def deactivate_product(
    product_id: uuid.UUID,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return _set_product_active(product_id, False, user, db)


@router.post(
    "/{product_id}/reactivate",
    response_model=ProductRead,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def reactivate_product(
    product_id: uuid.UUID,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return _set_product_active(product_id, True, user, db)


@router.post(
    "/variants/{variant_id}/adjust-stock",
    response_model=ProductVariantRead,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def adjust_stock(
    variant_id: uuid.UUID,
    payload: StockAdjustmentRequest,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        return inventory_service.adjust_variant_stock(
            db,
            variant_id=variant_id,
            adjustment=payload.adjustment,
            reason=payload.reason,
            actor_id=user.id,
        )
    except inventory_service.VariantNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")
    except inventory_service.NegativeStockAdjustmentError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock cannot be negative. Current stock is {exc.available}.",
        )


@router.post(
    "/{product_id}/variants/adjust-stock",
    response_model=ProductVariantRead,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def adjust_product_variant_stock(
    product_id: uuid.UUID,
    payload: ProductVariantAdjustmentRequest,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        return inventory_service.adjust_product_variant_stock(
            db,
            product_id=product_id,
            colour=(payload.colour or "").strip(),
            size=(payload.size or "").strip(),
            adjustment=payload.adjustment,
            reason=payload.reason,
            actor_id=user.id,
        )
    except inventory_service.ProductNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    except inventory_service.UnsupportedVariantColourError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New variants must use one of the supported colours.",
        )
    except inventory_service.NegativeStockAdjustmentError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock cannot be negative. Current stock is {exc.available}.",
        )


@router.get("/categories", response_model=list[CategoryRead], dependencies=[Depends(require_any_role)])
def list_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).order_by(Category.name).all()
    return [
        CategoryRead(id=c.id, name=c.name, sizes=sizes_for_category(c.name)) for c in categories
    ]
