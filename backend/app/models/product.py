"""
Product model. Stock is tracked per (colour, size) combination via
ProductVariant below, never as a single number on the product itself.
total_stock/stock_status are DERIVED by summing variant stock - never
stored, so they can never drift from reality (PRD section 7).
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    String,
    Numeric,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("listed_price >= 0", name="ck_products_price_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id"), nullable=False, index=True
    )
    listed_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    category: Mapped["Category"] = relationship(back_populates="products")
    variants: Mapped[list["ProductVariant"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )

    @property
    def total_stock(self) -> int:
        return sum(v.stock_quantity for v in self.variants)

    @property
    def stock_status(self) -> str:
        return "In Stock" if self.total_stock > 0 else "Out of Stock"


class ProductVariant(Base):
    """
    A specific colour+size combination of a product, with its own stock
    count. Variants are never created directly through a product-edit
    endpoint - they come into existence automatically the first time
    that colour+size is approved through the stock receiving workflow
    (see services/receiving_service.py), so sizes/colours are never
    hardcoded ahead of time.
    """
    __tablename__ = "product_variants"
    __table_args__ = (
        CheckConstraint("stock_quantity >= 0", name="ck_variants_stock_non_negative"),
        UniqueConstraint("product_id", "colour", "size", name="uq_variant_product_colour_size"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True
    )
    # Empty string ("") means "not applicable" - e.g. plain socks with
    # no colour/size breakdown. Deliberately NOT NULL: Postgres treats
    # every NULL as distinct in a unique constraint, so two receiving
    # batches of the same no-variant product would create duplicate
    # rows instead of accumulating into one. "" behaves like a normal
    # value and keeps the constraint below meaningful.
    colour: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    size: Mapped[str] = mapped_column(String(10), nullable=False, default="")
    stock_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    product: Mapped["Product"] = relationship(back_populates="variants")
    sales: Mapped[list["Sale"]] = relationship(back_populates="variant")