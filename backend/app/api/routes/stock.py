r"""
Stock receiving routes implementing the full workflow:

    OPEN -> STAFF_COMPLETED -> CLOSED -> APPROVED / REJECTED
                                       \-> CANCELLED (only from OPEN, empty)

Approve/Reject/Correct are only reachable once a session is CLOSED -
the service layer enforces this regardless of what the frontend shows,
so the sequence can't be bypassed by calling the API directly.

/direct-receive is a separate, session-free Admin path (PRD-equivalent
section 18): no approval step, updates inventory immediately.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db, require_admin, require_any_role
from app.core.csrf import verify_csrf
from app.models.stock_receiving import StockReceivingItem, StockReceivingSession
from app.models.user import User
from app.schemas.product import ProductVariantRead
from app.schemas.stock_receiving import (
    DirectReceiveRequest,
    ReceivingItemCorrection,
    ReceivingItemCreate,
    ReceivingItemRead,
    ReceivingSessionRead,
    RejectSessionRequest,
    ReopenSessionRequest,
)
from app.services import receiving_service as svc

router = APIRouter(prefix="/api/stock", tags=["stock-receiving"])


@router.post(
    "/sessions",
    response_model=ReceivingSessionRead,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def open_session(user: User = Depends(require_admin), db: Session = Depends(get_db)):
    return svc.open_session(db, admin_id=user.id)


@router.get(
    "/sessions", response_model=list[ReceivingSessionRead], dependencies=[Depends(require_any_role)]
)
def list_sessions(db: Session = Depends(get_db)):
    return db.query(StockReceivingSession).order_by(StockReceivingSession.opened_at.desc()).all()


@router.get(
    "/sessions/{session_id}/items",
    response_model=list[ReceivingItemRead],
    dependencies=[Depends(require_any_role)],
)
def list_session_items(session_id: uuid.UUID, db: Session = Depends(get_db)):
    return db.query(StockReceivingItem).filter(StockReceivingItem.session_id == session_id).all()


@router.post(
    "/sessions/{session_id}/items",
    response_model=ReceivingItemRead,
    dependencies=[Depends(require_any_role), Depends(verify_csrf)],
)
def submit_item(
    session_id: uuid.UUID,
    payload: ReceivingItemCreate,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    try:
        return svc.submit_item(
            db=db,
            session_id=session_id,
            staff_id=user.id,
            product_id=payload.product_id,
            quantity_submitted=payload.quantity_submitted,
            price_submitted=payload.price_submitted,
            colour=payload.colour,
            size=payload.size,
        )
    except svc.SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    except svc.SessionNotOpenError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session is not open")


@router.post(
    "/sessions/{session_id}/complete",
    response_model=ReceivingSessionRead,
    dependencies=[Depends(require_any_role), Depends(verify_csrf)],
)
def complete_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Either role can complete a session they've been entering items
    into - NOT approval, just moves OPEN -> STAFF_COMPLETED and
    notifies Admin (unless Admin is the one completing their own)."""
    try:
        return svc.complete_session(db, session_id, actor_id=user.id)
    except svc.SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    except svc.SessionNotOpenError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session is not open")
    except svc.EmptySessionError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot complete an empty session"
        )


@router.post(
    "/sessions/{session_id}/cancel",
    response_model=ReceivingSessionRead,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def cancel_session(
    session_id: uuid.UUID, user: User = Depends(require_admin), db: Session = Depends(get_db)
):
    """Admin-only cleanup for a session that was opened but never used
    (OPEN, zero items). A session with items must go through the
    normal complete -> close -> reject path instead."""
    try:
        return svc.cancel_session(db, session_id, actor_id=user.id)
    except svc.SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    except svc.SessionNotOpenError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session is not open")
    except svc.SessionNotEmptyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only an empty session can be cancelled - use Reject for a session with items",
        )


@router.post(
    "/sessions/{session_id}/close",
    response_model=ReceivingSessionRead,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def close_session(
    session_id: uuid.UUID, user: User = Depends(require_admin), db: Session = Depends(get_db)
):
    """Admin locks the session for review. Only from here do
    Approve/Reject become reachable."""
    try:
        return svc.close_session(db, session_id, actor_id=user.id)
    except svc.SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    except svc.SessionNotStaffCompletedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session must be completed before it can be closed",
        )


@router.patch(
    "/items/{item_id}/correct",
    response_model=ReceivingItemRead,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def correct_item(
    item_id: uuid.UUID,
    payload: ReceivingItemCorrection,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        return svc.correct_item(
            db=db,
            item_id=item_id,
            quantity_approved=payload.quantity_approved,
            price_approved=payload.price_approved,
            actor_id=user.id,
        )
    except svc.ItemNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    except svc.SessionNotClosedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session must be closed before items can be corrected",
        )


@router.post(
    "/sessions/{session_id}/approve",
    response_model=ReceivingSessionRead,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def approve_session(
    session_id: uuid.UUID, user: User = Depends(require_admin), db: Session = Depends(get_db)
):
    try:
        return svc.approve_session(db, session_id, actor_id=user.id)
    except svc.SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    except svc.SessionNotClosedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session must be closed before it can be approved",
        )


@router.post(
    "/sessions/{session_id}/reject",
    response_model=ReceivingSessionRead,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def reject_session(
    session_id: uuid.UUID,
    payload: RejectSessionRequest,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        return svc.reject_session(db, session_id, actor_id=user.id, reason=payload.reason)
    except svc.SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    except svc.SessionNotClosedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session must be closed before it can be rejected",
        )


@router.post(
    "/sessions/{session_id}/reopen",
    response_model=ReceivingSessionRead,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def reopen_session(
    session_id: uuid.UUID,
    payload: ReopenSessionRequest,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only. Staff can never reopen a session - there is no
    Staff-reachable route for this at all."""
    try:
        return svc.reopen_session(db, session_id, actor_id=user.id, reason=payload.reason)
    except svc.SessionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    except svc.SessionAlreadyFinalizedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An approved session cannot be reopened",
        )


@router.post(
    "/direct-receive",
    response_model=ProductVariantRead,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def direct_receive(
    payload: DirectReceiveRequest,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only, session-free stock receipt - no approval step,
    updates inventory the moment this is called."""
    return svc.admin_direct_receive(
        db,
        admin_id=user.id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        price=payload.price,
        colour=payload.colour,
        size=payload.size,
    )
