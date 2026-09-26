r"""
Stock receiving business logic implementing the full session workflow:

    OPEN -> STAFF_COMPLETED -> CLOSED -> APPROVED / REJECTED
                                       \-> CANCELLED (only from OPEN, empty)

Authoritative inventory is only ever touched in approve_session() and
admin_direct_receive() - never at any earlier step. Every transition
is a single atomic commit, and approve_session() takes a row lock on
the session itself so two concurrent approve requests can't both pass
the CLOSED check (double-approval prevention).

Colour/size are normalized to "" (never None) at the submit boundary -
see ProductVariant's docstring for why "" rather than NULL is used as
the "not applicable" sentinel. Approval (and admin_direct_receive)
find the matching (product_id, colour, size) variant or create it on
the spot, so new sizes/colours are never pre-defined anywhere - they
exist the moment stock for them is first approved or directly received.
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.product import Product, ProductVariant
from app.models.stock_receiving import (
    ReceivingItemStatus,
    ReceivingSessionStatus,
    StockReceivingItem,
    StockReceivingSession,
)
from app.models.user import User, UserRole
from app.models.notification import NotificationType
from app.services import audit_service, notification_service


class SessionNotFoundError(Exception):
    pass


class SessionNotOpenError(Exception):
    pass


class SessionNotStaffCompletedError(Exception):
    pass


class SessionNotClosedError(Exception):
    pass


class SessionAlreadyFinalizedError(Exception):
    pass


class SessionNotEmptyError(Exception):
    pass


class ItemNotFoundError(Exception):
    pass


class EmptySessionError(Exception):
    pass


def _admin_recipient_id(db: Session) -> uuid.UUID | None:
    # Exactly one Admin account exists in this system (PRD section 5).
    admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
    return admin.id if admin is not None else None


def open_session(db: Session, admin_id: uuid.UUID) -> StockReceivingSession:
    session = StockReceivingSession(opened_by=admin_id, status=ReceivingSessionStatus.OPEN)
    db.add(session)
    audit_service.log_event(
        db,
        event_type="receiving.session_opened",
        user_id=admin_id,
        resource=None,
        result="success",
        commit=False,
    )
    db.commit()
    db.refresh(session)
    return session


def _get_session_or_raise(db: Session, session_id: uuid.UUID) -> StockReceivingSession:
    session = db.get(StockReceivingSession, session_id)
    if session is None:
        raise SessionNotFoundError()
    return session


def submit_item(
    db: Session,
    session_id: uuid.UUID,
    staff_id: uuid.UUID,
    product_id: uuid.UUID,
    quantity_submitted: int,
    price_submitted: Decimal,
    colour: str | None = None,
    size: str | None = None,
) -> StockReceivingItem:
    session = _get_session_or_raise(db, session_id)
    if session.status != ReceivingSessionStatus.OPEN:
        raise SessionNotOpenError()

    item = StockReceivingItem(
        session_id=session.id,
        product_id=product_id,
        submitted_by=staff_id,
        colour=(colour or "").strip(),
        size=(size or "").strip(),
        quantity_submitted=quantity_submitted,
        price_submitted=price_submitted,
        status=ReceivingItemStatus.PENDING,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def complete_session(
    db: Session, session_id: uuid.UUID, actor_id: uuid.UUID
) -> StockReceivingSession:
    """Either role can complete a session they've been entering items
    into (OPEN -> STAFF_COMPLETED) - the name reflects the common case,
    but Admin must be able to complete a session they opened and filled
    solo, without needing Staff involved at all. Not approval - just
    tells Admin the submission is ready to be reviewed, via a
    persistent notification."""
    session = _get_session_or_raise(db, session_id)
    if session.status != ReceivingSessionStatus.OPEN:
        raise SessionNotOpenError()

    if len(session.items) == 0:
        raise EmptySessionError()

    session.status = ReceivingSessionStatus.STAFF_COMPLETED
    session.completed_at = datetime.now(timezone.utc)
    session.completed_by = actor_id

    admin_id = _admin_recipient_id(db)
    # Don't notify Admin about their own action - only meaningful when
    # someone else (Staff) is the one signaling completion.
    if admin_id is not None and admin_id != actor_id:
        notification_service.notify(
            db,
            recipient_id=admin_id,
            type=NotificationType.RECEIVING_COMPLETED,
            title="Receiving Session Completed",
            message=(
                f"Staff has completed entering stock for Receiving Session "
                f"#{str(session.id)[:8]}. Review the submission when ready."
            ),
            receiving_session_id=session.id,
            commit=False,
        )

    audit_service.log_event(
        db,
        event_type="receiving.staff_completed",
        user_id=actor_id,
        resource=f"session:{session_id}",
        result="success",
        metadata={"item_count": len(session.items)},
        commit=False,
    )
    db.commit()
    db.refresh(session)
    return session


def cancel_session(
    db: Session, session_id: uuid.UUID, actor_id: uuid.UUID
) -> StockReceivingSession:
    """Admin-only cleanup for a session that was opened but never used
    (OPEN, zero items). Not a general-purpose abandon button - a
    session with items must go through complete -> close -> reject
    instead, so there's always a reviewable record of what was
    entered. No notification needed: nothing was ever submitted, so
    there's nothing for anyone to be told about."""
    session = _get_session_or_raise(db, session_id)
    if session.status != ReceivingSessionStatus.OPEN:
        raise SessionNotOpenError()
    if len(session.items) > 0:
        raise SessionNotEmptyError()

    session.status = ReceivingSessionStatus.CANCELLED
    audit_service.log_event(
        db,
        event_type="receiving.session_cancelled",
        user_id=actor_id,
        resource=f"session:{session_id}",
        result="success",
        commit=False,
    )
    db.commit()
    db.refresh(session)
    return session


def close_session(
    db: Session, session_id: uuid.UUID, actor_id: uuid.UUID
) -> StockReceivingSession:
    """Admin explicitly locks the session for review (STAFF_COMPLETED ->
    CLOSED). Staff can no longer edit past this point. Approve/Reject
    only become available once a session reaches CLOSED - never before,
    so Admin can't accidentally approve an incomplete submission."""
    session = _get_session_or_raise(db, session_id)
    if session.status != ReceivingSessionStatus.STAFF_COMPLETED:
        raise SessionNotStaffCompletedError()

    session.status = ReceivingSessionStatus.CLOSED
    session.closed_at = datetime.now(timezone.utc)

    audit_service.log_event(
        db,
        event_type="receiving.admin_closed",
        user_id=actor_id,
        resource=f"session:{session_id}",
        result="success",
        commit=False,
    )
    db.commit()
    db.refresh(session)
    return session


def correct_item(
    db: Session,
    item_id: uuid.UUID,
    quantity_approved: int,
    price_approved: Decimal,
    actor_id: uuid.UUID | None = None,
) -> StockReceivingItem:
    item = db.get(StockReceivingItem, item_id)
    if item is None:
        raise ItemNotFoundError()

    if item.session.status != ReceivingSessionStatus.CLOSED:
        raise SessionNotClosedError()

    item.quantity_approved = quantity_approved
    item.price_approved = price_approved
    audit_service.log_event(
        db,
        event_type="receiving.item_corrected",
        user_id=actor_id,
        resource=f"item:{item_id}",
        result="success",
        metadata={
            "quantity_approved": quantity_approved,
            "price_approved": str(price_approved),
            "originally_submitted_quantity": item.quantity_submitted,
            "originally_submitted_price": str(item.price_submitted),
        },
        commit=False,
    )
    db.commit()
    db.refresh(item)
    return item


def _get_or_create_variant(
    db: Session, product_id: uuid.UUID, colour: str, size: str
) -> ProductVariant:
    variant = (
        db.query(ProductVariant)
        .filter(
            ProductVariant.product_id == product_id,
            ProductVariant.colour == colour,
            ProductVariant.size == size,
        )
        .with_for_update()
        .first()
    )
    if variant is None:
        variant = ProductVariant(product_id=product_id, colour=colour, size=size, stock_quantity=0)
        db.add(variant)
        db.flush()  # assign variant.id before the caller references it
    return variant


def approve_session(
    db: Session, session_id: uuid.UUID, actor_id: uuid.UUID | None = None
) -> StockReceivingSession:
    session = (
        db.query(StockReceivingSession)
        .filter(StockReceivingSession.id == session_id)
        .with_for_update()
        .first()
    )
    if session is None:
        raise SessionNotFoundError()
    if session.status != ReceivingSessionStatus.CLOSED:
        raise SessionNotClosedError()

    try:
        for item in session.items:
            # Default to what Staff submitted if Admin never corrected it.
            approved_qty = (
                item.quantity_approved
                if item.quantity_approved is not None
                else item.quantity_submitted
            )
            approved_price = (
                item.price_approved if item.price_approved is not None else item.price_submitted
            )

            variant = _get_or_create_variant(db, item.product_id, item.colour, item.size)
            variant.stock_quantity += approved_qty

            product = (
                db.query(Product).filter(Product.id == item.product_id).with_for_update().first()
            )
            if product is not None:
                product.listed_price = approved_price

            item.product_variant_id = variant.id
            item.quantity_approved = approved_qty
            item.price_approved = approved_price
            item.status = ReceivingItemStatus.APPROVED

        session.status = ReceivingSessionStatus.APPROVED
        session.verified_at = datetime.now(timezone.utc)

        if session.completed_by is not None:
            notification_service.notify(
                db,
                recipient_id=session.completed_by,
                type=NotificationType.RECEIVING_APPROVED,
                title="Stock Upload Verified Successfully",
                message=(
                    f"Your stock submission for Receiving Session "
                    f"#{str(session.id)[:8]} has been verified and approved."
                ),
                receiving_session_id=session.id,
                commit=False,
            )

        audit_service.log_event(
            db,
            event_type="receiving.session_approved",
            user_id=actor_id,
            resource=f"session:{session_id}",
            result="success",
            metadata={"item_count": len(session.items)},
            commit=False,
        )

        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(session)
    return session


def reject_session(
    db: Session,
    session_id: uuid.UUID,
    actor_id: uuid.UUID | None = None,
    reason: str | None = None,
) -> StockReceivingSession:
    session = _get_session_or_raise(db, session_id)
    if session.status != ReceivingSessionStatus.CLOSED:
        raise SessionNotClosedError()

    for item in session.items:
        item.status = ReceivingItemStatus.REJECTED

    session.status = ReceivingSessionStatus.REJECTED
    session.verified_at = datetime.now(timezone.utc)
    session.rejection_reason = reason

    if session.completed_by is not None:
        message = (
            f"Your stock receiving submission for Receiving Session "
            f"#{str(session.id)[:8]} was rejected."
        )
        if reason:
            message += f" Reason: {reason}"
        notification_service.notify(
            db,
            recipient_id=session.completed_by,
            type=NotificationType.RECEIVING_REJECTED,
            title="Stock Submission Requires Attention",
            message=message,
            receiving_session_id=session.id,
            commit=False,
        )

    audit_service.log_event(
        db,
        event_type="receiving.session_rejected",
        user_id=actor_id,
        resource=f"session:{session_id}",
        result="success",
        metadata={"reason": reason},
        commit=False,
    )
    db.commit()
    db.refresh(session)
    return session


def reopen_session(
    db: Session,
    session_id: uuid.UUID,
    actor_id: uuid.UUID,
    reason: str,
) -> StockReceivingSession:
    """Admin-only escape hatch back to OPEN, from STAFF_COMPLETED,
    CLOSED, or REJECTED. Never available on APPROVED - inventory has
    already moved by then, so reopening would risk double-counting
    stock; an approved session is final. Staff can never call this."""
    session = _get_session_or_raise(db, session_id)
    if session.status not in (
        ReceivingSessionStatus.STAFF_COMPLETED,
        ReceivingSessionStatus.CLOSED,
        ReceivingSessionStatus.REJECTED,
    ):
        raise SessionAlreadyFinalizedError()

    session.status = ReceivingSessionStatus.OPEN
    session.completed_at = None
    session.completed_by = None
    session.closed_at = None
    session.reopened_at = datetime.now(timezone.utc)
    session.reopened_by = actor_id
    session.reopen_reason = reason

    audit_service.log_event(
        db,
        event_type="receiving.session_reopened",
        user_id=actor_id,
        resource=f"session:{session_id}",
        result="success",
        metadata={"reason": reason},
        commit=False,
    )
    db.commit()
    db.refresh(session)
    return session


def admin_direct_receive(
    db: Session,
    admin_id: uuid.UUID,
    product_id: uuid.UUID,
    quantity: int,
    price: Decimal,
    colour: str | None = None,
    size: str | None = None,
) -> ProductVariant:
    """Admin-only, session-free stock receipt (PRD-equivalent section
    18): Admin is already the one who verifies/approves in the normal
    workflow, so when acting alone there is no separate approval step
    to route through - this updates inventory the moment it's called,
    as one atomic transaction, logged distinctly from a
    session-approval event so the audit trail is never ambiguous about
    which path stock came through."""
    colour = (colour or "").strip()
    size = (size or "").strip()

    try:
        variant = _get_or_create_variant(db, product_id, colour, size)
        variant.stock_quantity += quantity

        product = db.query(Product).filter(Product.id == product_id).with_for_update().first()
        if product is not None:
            product.listed_price = price

        audit_service.log_event(
            db,
            event_type="receiving.direct_admin_receipt",
            user_id=admin_id,
            resource=f"product:{product_id}",
            result="success",
            metadata={
                "colour": colour,
                "size": size,
                "quantity": quantity,
                "price": str(price),
            },
            commit=False,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(variant)
    return variant
