"""
Stock receiving models implementing the full session workflow:

    OPEN -> STAFF_COMPLETED -> CLOSED -> APPROVED / REJECTED

Staff enters items while OPEN, then explicitly marks the session
STAFF_COMPLETED ("I'm done entering") - this is NOT approval, just an
end-of-entry signal that notifies Admin. Admin then explicitly CLOSEs
the session (locking it from further Staff edits) before the
Approve/Reject controls become available at all - approval can never
be shown, let alone triggered, while Staff might still be entering
data (see services/receiving_service.py for the enforced transitions).

Authoritative inventory is only ever touched on approval, handled
transactionally in services/receiving_service.py, never here.

Each item carries the colour/size Staff submitted (either can be left
blank - "" - for products with no colour/size breakdown, e.g. plain
socks). product_variant_id is populated on approval with whichever
ProductVariant the item resolved to - either an existing one or one
created fresh on the spot, since variants are never pre-defined.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Integer, Numeric, String, DateTime, ForeignKey, Enum, CheckConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ReceivingSessionStatus(str, enum.Enum):
    OPEN = "open"
    STAFF_COMPLETED = "staff_completed"
    CLOSED = "closed"
    APPROVED = "approved"
    REJECTED = "rejected"


class ReceivingItemStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class StockReceivingSession(Base):
    __tablename__ = "stock_receiving_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    opened_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    status: Mapped[ReceivingSessionStatus] = mapped_column(
        Enum(ReceivingSessionStatus), nullable=False, default=ReceivingSessionStatus.OPEN
    )
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Staff explicitly marks entry finished (OPEN -> STAFF_COMPLETED).
    # Not approval - just "I'm done", which notifies Admin.
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    # Admin explicitly locks the session for review (STAFF_COMPLETED ->
    # CLOSED). Approve/Reject only become available once this is set.
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Set when Admin makes the final call, whichever way it goes
    # (CLOSED -> APPROVED or CLOSED -> REJECTED).
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Admin-only escape hatch back to OPEN - never automatic, always a
    # deliberate action with a recorded reason (PRD-equivalent section 19).
    reopened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reopened_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    reopen_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    items: Mapped[list["StockReceivingItem"]] = relationship(back_populates="session")


class StockReceivingItem(Base):
    __tablename__ = "stock_receiving_items"
    __table_args__ = (
        CheckConstraint("quantity_submitted > 0", name="ck_receiving_qty_submitted_positive"),
        CheckConstraint(
            "quantity_approved IS NULL OR quantity_approved >= 0",
            name="ck_receiving_qty_approved_non_negative",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stock_receiving_sessions.id"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True
    )
    # Set on approval to whichever variant this item resolved to.
    # Nullable because it doesn't exist yet while the item is
    # pending/being corrected - only assigned at approval time.
    product_variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_variants.id"), nullable=True
    )
    submitted_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # "" means "not applicable" for this product - see ProductVariant.
    colour: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    size: Mapped[str] = mapped_column(String(10), nullable=False, default="")

    quantity_submitted: Mapped[int] = mapped_column(Integer, nullable=False)
    price_submitted: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    quantity_approved: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_approved: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    status: Mapped[ReceivingItemStatus] = mapped_column(
        Enum(ReceivingItemStatus), nullable=False, default=ReceivingItemStatus.PENDING
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["StockReceivingSession"] = relationship(back_populates="items")
