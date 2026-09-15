from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db, require_admin
from app.core.csrf import verify_csrf
from app.models.sale import Sale
from app.models.user import User
from app.schemas.sale import SaleCreate, SaleRead
from app.services.sales_service import (
    InsufficientStockError,
    ProductInactiveError,
    VariantNotFoundError,
    record_sale,
)

router = APIRouter(prefix="/api/sales", tags=["sales"])


@router.post("", response_model=SaleRead, dependencies=[Depends(verify_csrf)])
def create_sale(
    payload: SaleCreate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    try:
        sale = record_sale(
            db=db,
            staff_id=user.id,
            product_variant_id=payload.product_variant_id,
            quantity=payload.quantity,
            actual_price_paid=payload.actual_price_paid,
        )
    except VariantNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product variant not found"
        )
    except ProductInactiveError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product is inactive")
    except InsufficientStockError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock: {e.available} available, {e.requested} requested",
        )
    return sale


@router.get("", response_model=list[SaleRead], dependencies=[Depends(require_admin)])
def list_all_sales(db: Session = Depends(get_db)):
    # Admin-only: system-wide sales view.
    return db.query(Sale).order_by(Sale.created_at.desc()).all()


@router.get("/my-sales", response_model=list[SaleRead])
def my_sales(user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    # Staff can only ever see their OWN sales - enforced server-side via
    # current_user.id, never a client-supplied staff id (PRD section 16).
    return (
        db.query(Sale)
        .filter(Sale.staff_id == user.id)
        .order_by(Sale.created_at.desc())
        .all()
    )