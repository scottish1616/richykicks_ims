"""
Audit log for sensitive security/business events (PRD section 31).
Never contains passwords, reset tokens, API keys, or other secrets.
Not editable by Staff via the API.
"""
import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, JSON, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    resource: Mapped[str | None] = mapped_column(String(150), nullable=True)
    result: Mapped[str] = mapped_column(String(50), nullable=False)
    log_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
