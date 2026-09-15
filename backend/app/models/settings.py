"""
Shop settings - a single row of Admin-editable shop info (PRD section
41). Deliberately minimal: no huge settings panel, and nothing
security-sensitive lives here - session/rate-limit/CORS config stays
in env vars and is never exposed to or editable from the UI.
"""
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# There is only ever one shop, so this table is a deliberate singleton:
# exactly one row, always at id=1. The CheckConstraint makes a second
# row impossible even if application code has a bug.
SETTINGS_ROW_ID = 1


class ShopSettings(Base):
    __tablename__ = "shop_settings"
    __table_args__ = (CheckConstraint("id = 1", name="shop_settings_singleton"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=SETTINGS_ROW_ID)
    shop_name: Mapped[str] = mapped_column(String(255), nullable=False, default="RichyKicks")
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
