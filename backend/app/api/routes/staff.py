"""
Staff management routes (Admin only). Hard cap of 2 ACTIVE Staff
accounts is enforced here server-side - never trust a client-side
counter (PRD sections 3, 40). Disabling a Staff account frees the slot
for a new one, since only active accounts count toward the cap.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.core.csrf import verify_csrf
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.schemas.user import StaffCreate, UserRead
from app.services import audit_service

router = APIRouter(prefix="/api/staff", tags=["staff"], dependencies=[Depends(require_admin)])

MAX_ACTIVE_STAFF = 2


def _active_staff_count(db: Session) -> int:
    return (
        db.query(User)
        .filter(User.role == UserRole.STAFF, User.is_active.is_(True))
        .count()
    )


@router.get("", response_model=list[UserRead])
def list_staff(db: Session = Depends(get_db)):
    return db.query(User).filter(User.role == UserRole.STAFF).order_by(User.created_at).all()


@router.post("", response_model=UserRead, dependencies=[Depends(verify_csrf)])
def create_staff(payload: StaffCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if _active_staff_count(db) >= MAX_ACTIVE_STAFF:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum of {MAX_ACTIVE_STAFF} active Staff accounts already exist",
        )

    if db.query(User).filter(User.email == payload.email).first() is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")

    staff = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.STAFF,
        is_active=True,
    )
    db.add(staff)
    db.flush()  # assign staff.id before the audit row references it
    audit_service.log_event(
        db,
        event_type="staff.created",
        user_id=admin.id,
        resource=f"user:{staff.id}",
        result="success",
        metadata={"email": staff.email},
        commit=False,
    )
    db.commit()
    db.refresh(staff)
    return staff


@router.post("/{staff_id}/disable", response_model=UserRead, dependencies=[Depends(verify_csrf)])
def disable_staff(
    staff_id: uuid.UUID, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    staff = db.get(User, staff_id)
    if staff is None or staff.role != UserRole.STAFF:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff account not found")

    staff.is_active = False
    audit_service.log_event(
        db,
        event_type="staff.disabled",
        user_id=admin.id,
        resource=f"user:{staff.id}",
        result="success",
        commit=False,
    )
    db.commit()
    db.refresh(staff)
    return staff


@router.post("/{staff_id}/enable", response_model=UserRead, dependencies=[Depends(verify_csrf)])
def enable_staff(
    staff_id: uuid.UUID, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    staff = db.get(User, staff_id)
    if staff is None or staff.role != UserRole.STAFF:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff account not found")

    if _active_staff_count(db) >= MAX_ACTIVE_STAFF:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum of {MAX_ACTIVE_STAFF} active Staff accounts already exist",
        )

    staff.is_active = True
    audit_service.log_event(
        db,
        event_type="staff.enabled",
        user_id=admin.id,
        resource=f"user:{staff.id}",
        result="success",
        commit=False,
    )
    db.commit()
    db.refresh(staff)
    return staff
