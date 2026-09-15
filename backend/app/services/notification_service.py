"""
notification_service.py — persistent in-app notifications.

Every read/write here is scoped to a specific recipient_id, and that
id always comes from the authenticated user, never from client input
(the equivalent of PRD section 16's IDOR protection, applied to
notifications). mark_read() returns NotFoundError - not a 403 - when
a notification exists but belongs to someone else, so a client can't
even confirm another user's notification IDs exist.
"""
import uuid

from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType


class NotificationNotFoundError(Exception):
    pass


def notify(
    db: Session,
    *,
    recipient_id: uuid.UUID,
    type: NotificationType,
    title: str,
    message: str,
    receiving_session_id: uuid.UUID | None = None,
    commit: bool = True,
) -> Notification:
    entry = Notification(
        recipient_id=recipient_id,
        type=type,
        title=title,
        message=message,
        receiving_session_id=receiving_session_id,
    )
    db.add(entry)
    if commit:
        db.commit()
    return entry


def list_for_user(db: Session, user_id: uuid.UUID, unread_only: bool = False) -> list[Notification]:
    query = db.query(Notification).filter(Notification.recipient_id == user_id)
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    return query.order_by(Notification.created_at.desc()).all()


def unread_count(db: Session, user_id: uuid.UUID) -> int:
    return (
        db.query(Notification)
        .filter(Notification.recipient_id == user_id, Notification.is_read.is_(False))
        .count()
    )


def mark_read(db: Session, notification_id: uuid.UUID, user_id: uuid.UUID) -> Notification:
    entry = db.get(Notification, notification_id)
    if entry is None or entry.recipient_id != user_id:
        raise NotificationNotFoundError()

    entry.is_read = True
    db.commit()
    db.refresh(entry)
    return entry


def mark_all_read(db: Session, user_id: uuid.UUID) -> int:
    updated = (
        db.query(Notification)
        .filter(Notification.recipient_id == user_id, Notification.is_read.is_(False))
        .update({"is_read": True})
    )
    db.commit()
    return updated
