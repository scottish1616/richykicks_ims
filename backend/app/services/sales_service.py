"""
Sales business logic. record_sale() is one atomic transaction: lock
the ProductVariant row (the specific colour+size being sold),
validate stock, create the sale record, decrement stock, commit - or
roll back everything (PRD sections 8, 9, 29).

Uses SELECT ... FOR UPDATE so two concurrent sales of the same variant
can't both read stale stock and oversell it - the second request
blocks until the first transaction commits or rolls back.
"""
import uuid
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.product import ProductVariant
from app.models.sale import Sale
from app.services import audit_service


class VariantNotFoundError(Exception):
    pass


class ProductInactiveError(Exception):
    pass


class InsufficientStockError(Exception):
    def __init__(self, available: int, requested: int):
        self.available = available
        self.requested = requested
        super().__init__(f"Insufficient stock: {available} available, {requested} requested")


def record_sale(
    db: Session,
    staff_id: uuid.UUID,
    product_variant_id: uuid.UUID,
    quantity: int,
    actual_price_paid: Decimal,
) -> Sale:
    variant = (
        db.query(ProductVariant)
        .filter(ProductVariant.id == product_variant_id)
        .with_for_update()
        .first()
    )

    if variant is None:
        raise VariantNotFoundError()

    if not variant.product.is_active:
        raise ProductInactiveError()

    if variant.stock_quantity < quantity:
        raise InsufficientStockError(available=variant.stock_quantity, requested=quantity)

    sale = Sale(
        product_variant_id=variant.id,
        staff_id=staff_id,
        quantity=quantity,
        listed_price_at_sale=variant.product.listed_price,
        actual_price_paid=actual_price_paid,
        total_amount=actual_price_paid * quantity,
    )
    variant.stock_quantity -= quantity

    try:
        db.add(sale)
        audit_service.log_event(
            db,
            event_type="sale.created",
            user_id=staff_id,
            resource=f"variant:{product_variant_id}",
            result="success",
            metadata={
                "quantity": quantity,
                "actual_price_paid": str(actual_price_paid),
                "listed_price_at_sale": str(variant.product.listed_price),
                "colour": variant.colour,
                "size": variant.size,
            },
            commit=False,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(sale)
    return sale