"""Transactional inventory adjustments kept separate from route handlers."""
import uuid

from sqlalchemy.orm import Session

from app.models.product import ProductVariant
from app.services import audit_service


class VariantNotFoundError(Exception):
	pass


class NegativeStockAdjustmentError(Exception):
	def __init__(self, available: int, adjustment: int):
		self.available = available
		self.adjustment = adjustment


def adjust_variant_stock(
	db: Session,
	*,
	variant_id: uuid.UUID,
	adjustment: int,
	reason: str,
	actor_id: uuid.UUID,
) -> ProductVariant:
	variant = (
		db.query(ProductVariant)
		.filter(ProductVariant.id == variant_id)
		.with_for_update()
		.first()
	)
	if variant is None:
		raise VariantNotFoundError()

	old_quantity = variant.stock_quantity
	new_quantity = old_quantity + adjustment
	if new_quantity < 0:
		raise NegativeStockAdjustmentError(old_quantity, adjustment)

	variant.stock_quantity = new_quantity
	try:
		audit_service.log_event(
			db,
			event_type="inventory.stock_adjusted",
			user_id=actor_id,
			resource=f"variant:{variant.id}",
			result="success",
			metadata={
				"product_id": str(variant.product_id),
				"colour": variant.colour,
				"size": variant.size,
				"old_quantity": old_quantity,
				"adjustment": adjustment,
				"new_quantity": new_quantity,
				"reason": reason.strip(),
			},
			commit=False,
		)
		db.commit()
	except Exception:
		db.rollback()
		raise

	db.refresh(variant)
	return variant
