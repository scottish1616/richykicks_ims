"""
Persistent, database-backed in-app notifications. Never a
frontend-only toast - if the recipient is offline when the event
happens, the row is still here when they next log in and load
GET /api/notifications.

Only ever created server-side, from inside the receiving workflow's
own transaction (services/receiving_service.py) - never something a
client can create directly.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class NotificationType(str, enum.Enum):
    RECEIVING_COMPLETED = "receiving_completed"  # to Admin, when Staff completes a session
    RECEIVING_APPROVED = "receiving_approved"  # to Staff, when Admin approves
    RECEIVING_REJECTED = "receiving_rejected"  # to Staff, when Admin rejects


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(String(1000), nullable=False)
    receiving_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stock_receiving_sessions.id"), nullable=True
    )
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
