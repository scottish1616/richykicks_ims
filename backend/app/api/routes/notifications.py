"""
Notification routes. Every read/write is scoped to the authenticated
user - a Staff member can only ever see their own notifications, Admin
only Admin's, regardless of what id appears in the URL or body
(there isn't one to manipulate: the recipient is always
current_user.id, never client input).
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.core.csrf import verify_csrf
from app.models.user import User
from app.schemas.notification import NotificationRead
from app.services import notification_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
def list_my_notifications(
    unread_only: bool = Query(default=False),
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return notification_service.list_for_user(db, user.id, unread_only=unread_only)


@router.get("/unread-count")
def get_unread_count(user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    return {"count": notification_service.unread_count(db, user.id)}


@router.post(
    "/{notification_id}/read", response_model=NotificationRead, dependencies=[Depends(verify_csrf)]
)
def mark_read(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    try:
        return notification_service.mark_read(db, notification_id, user.id)
    except notification_service.NotificationNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")


@router.post("/read-all", dependencies=[Depends(verify_csrf)])
def mark_all_read(user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    updated = notification_service.mark_all_read(db, user.id)
    return {"marked_read": updated}
