"""
Shop settings routes (Admin only, PRD section 41). Nothing
security-sensitive lives here - session/rate-limit/CORS config stays
server-side in env vars and is intentionally never exposed here.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.core.csrf import verify_csrf
from app.models.user import User
from app.schemas.settings import ShopSettingsRead, ShopSettingsUpdate
from app.services import settings_service

router = APIRouter(
    prefix="/api/settings", tags=["settings"], dependencies=[Depends(require_admin)]
)


@router.get("", response_model=ShopSettingsRead)
def get_settings(db: Session = Depends(get_db)):
    return settings_service.get_settings(db)


@router.put("", response_model=ShopSettingsRead, dependencies=[Depends(verify_csrf)])
def update_settings(
    payload: ShopSettingsUpdate, user: User = Depends(require_admin), db: Session = Depends(get_db)
):
    return settings_service.update_settings(
        db,
        shop_name=payload.shop_name,
        address=payload.address,
        phone=payload.phone,
        contact_email=payload.contact_email,
        actor_id=user.id,
    )
