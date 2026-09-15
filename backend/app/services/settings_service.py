"""
settings_service.py — the single shop-settings row (PRD section 41).

The migration seeds row id=1 up front, so get_settings() should always
find it. get_or_create() defensively creates it if it's somehow
missing (e.g. a hand-rolled test DB that skipped the seed insert),
rather than letting every caller special-case a None settings row.
"""
import uuid

from sqlalchemy.orm import Session

from app.models.settings import SETTINGS_ROW_ID, ShopSettings
from app.services import audit_service


def get_settings(db: Session) -> ShopSettings:
    settings = db.get(ShopSettings, SETTINGS_ROW_ID)
    if settings is None:
        settings = ShopSettings(id=SETTINGS_ROW_ID)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def update_settings(
    db: Session,
    *,
    shop_name: str,
    address: str | None,
    phone: str | None,
    contact_email: str | None,
    actor_id: uuid.UUID | None = None,
) -> ShopSettings:
    settings = get_settings(db)
    settings.shop_name = shop_name
    settings.address = address
    settings.phone = phone
    settings.contact_email = contact_email

    audit_service.log_event(
        db,
        event_type="settings.updated",
        user_id=actor_id,
        resource="shop_settings",
        result="success",
        commit=False,
    )
    db.commit()
    db.refresh(settings)
    return settings
