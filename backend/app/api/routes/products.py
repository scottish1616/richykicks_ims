"""
Product & category routes. Admin manages products/categories; Staff
gets read-only access to products/stock (PRD sections 3-6). Stock
quantity is intentionally NOT editable here - it only ever changes
through the sales and receiving-approval workflows.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin, require_any_role
from app.core.csrf import verify_csrf
from app.core.product_sizes import sizes_for_category
from app.models.category import Category
from app.models.product import Product
from app.models.user import User
from app.schemas.product import CategoryRead, ProductCreate, ProductRead, ProductUpdate
from app.services import audit_service

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[ProductRead], dependencies=[Depends(require_any_role)])
def list_products(db: Session = Depends(get_db)):
    # TODO: pagination, category filter, search (PRD section 49)
    return db.query(Product).filter(Product.is_active.is_(True)).all()


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


@router.get("/categories", response_model=list[CategoryRead], dependencies=[Depends(require_any_role)])
def list_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).order_by(Category.name).all()
    return [
        CategoryRead(id=c.id, name=c.name, sizes=sizes_for_category(c.name)) for c in categories
    ]
