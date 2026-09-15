"""
Sale model. References a specific ProductVariant (colour+size), not a
bare product, since stock now lives on the variant. Stores BOTH the
listed price at the time of sale and the actual price paid (bargaining,
PRD section 9) so historical revenue never changes when the product's
current listed price changes later.
"""
import uuid
from datetime import datetime

from sqlalchemy import Numeric, Integer, DateTime, ForeignKey, CheckConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Sale(Base):
    __tablename__ = "sales"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_sales_quantity_positive"),
        CheckConstraint("actual_price_paid >= 0", name="ck_sales_price_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    product_variant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_variants.id"), nullable=False, index=True
    )
    staff_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    listed_price_at_sale: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    actual_price_paid: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    variant: Mapped["ProductVariant"] = relationship(back_populates="sales")
    staff: Mapped["User"] = relationship(back_populates="sales")

    @property
    def product_name(self) -> str:
        return self.variant.product.name

    @property
    def colour(self) -> str:
        return self.variant.colour

    @property
    def size(self) -> str:
        return self.variant.size