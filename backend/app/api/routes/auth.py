"""
Authentication routes. Login sets an httpOnly cookie rather than
returning the JWT in the response body (PRD section 22), is rate
limited per-IP, and locks an account out temporarily after repeated
failed attempts (PRD section 24). Password reset issues a random
single-use hashed token and emails it via Resend (PRD section 20).

A CSRF token cookie is issued alongside the access-token cookie at
login (PRD section 35) - the frontend must echo it back as an
X-CSRF-Token header on every mutating request.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import ACCESS_COOKIE_NAME, get_current_active_user, get_db
from app.core.config import settings
from app.core.csrf import CSRF_COOKIE_NAME, generate_csrf_token, verify_csrf
from app.core.limiter import limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import (
    GenericMessageResponse,
    LoginRequest,
    PasswordChangeRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
)
from app.schemas.user import UserRead
from app.services import audit_service
from app.services.auth_service import (
    consume_password_reset_token,
    create_password_reset_token,
    is_locked_out,
    register_failed_login,
    register_successful_login,
)
from app.utils.email import send_password_reset_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

ACCESS_COOKIE_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


def _set_access_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.is_production,
        samesite="none" if settings.is_production else "lax",
        max_age=ACCESS_COOKIE_MAX_AGE,
        path="/",
    )


def _set_csrf_cookie(response: Response, token: str) -> None:
    # NOT httponly - the frontend JS must be able to read this to echo
    # it back as a header. It is not a secret on its own; it only has
    # value paired with the httpOnly access-token cookie.
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=token,
        httponly=False,
        secure=settings.is_production,
        samesite="none" if settings.is_production else "lax",
        max_age=ACCESS_COOKIE_MAX_AGE,
        path="/",
    )


@router.post("/login", response_model=UserRead)
@limiter.limit(settings.LOGIN_RATE_LIMIT)
def login(request: Request, payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    # Same generic error whether the email doesn't exist or the password
    # is wrong - never reveal which one it was (PRD section 24).
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
    )

    if user is not None and is_locked_out(user):
        audit_service.log_event(
            db,
            event_type="auth.login",
            user_id=user.id,
            resource=f"user:{user.id}",
            result="locked_out",
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Try again later.",
        )

    if user is None or not verify_password(payload.password, user.password_hash):
        if user is not None:
            register_failed_login(db, user)
            audit_service.log_event(
                db,
                event_type="auth.login",
                user_id=user.id,
                resource=f"user:{user.id}",
                result="failure",
            )
        raise invalid_credentials

    if not user.is_active:
        audit_service.log_event(
            db,
            event_type="auth.login",
            user_id=user.id,
            resource=f"user:{user.id}",
            result="disabled_account",
        )
        raise invalid_credentials

    register_successful_login(db, user)
    audit_service.log_event(
        db, event_type="auth.login", user_id=user.id, resource=f"user:{user.id}", result="success"
    )

    token = create_access_token(str(user.id), user.role.value)
    _set_access_cookie(response, token)
    _set_csrf_cookie(response, generate_csrf_token())

    # TODO: issue + store a refresh token once rotation/reuse-detection
    # is implemented.
    return user


@router.post("/logout", response_model=GenericMessageResponse)
def logout(response: Response, user: User = Depends(get_current_active_user)):
    response.delete_cookie(ACCESS_COOKIE_NAME, path="/")
    response.delete_cookie(CSRF_COOKIE_NAME, path="/")
    # TODO: revoke the refresh token once refresh-token storage exists.
    return GenericMessageResponse(message="Logged out")


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_active_user)):
    return user


@router.post("/password-reset/request", response_model=GenericMessageResponse)
@limiter.limit(settings.PASSWORD_RESET_RATE_LIMIT)
def request_password_reset(request: Request, payload: PasswordResetRequest, db: Session = Depends(get_db)):
    # Always the same response, whether or not the email exists - never
    # reveal account existence through response differences (PRD section 20).
    generic_response = GenericMessageResponse(
        message="If an account exists for this email, a password reset link has been sent."
    )

    user = db.query(User).filter(User.email == payload.email).first()
    if user is not None and user.is_active:
        raw_token = create_password_reset_token(db, user)
        reset_url = f"{settings.FRONTEND_ORIGIN}/reset-password?token={raw_token}"
        send_password_reset_email(user.email, reset_url)
        audit_service.log_event(
            db,
            event_type="auth.password_reset_requested",
            user_id=user.id,
            resource=f"user:{user.id}",
            result="success",
        )

    return generic_response


@router.post("/password-reset/confirm", response_model=GenericMessageResponse)
def confirm_password_reset(payload: PasswordResetConfirm, db: Session = Depends(get_db)):
    user = consume_password_reset_token(db, payload.token)
    if user is None:
        audit_service.log_event(
            db,
            event_type="auth.password_reset_confirmed",
            user_id=None,
            result="invalid_or_expired_token",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token"
        )

    user.password_hash = hash_password(payload.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    audit_service.log_event(
        db,
        event_type="auth.password_reset_confirmed",
        user_id=user.id,
        resource=f"user:{user.id}",
        result="success",
        commit=False,
    )
    db.commit()

    return GenericMessageResponse(message="Password has been reset. You can now log in.")


@router.post(
    "/password-change", response_model=GenericMessageResponse, dependencies=[Depends(verify_csrf)]
)
def change_password(
    payload: PasswordChangeRequest,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        audit_service.log_event(
            db,
            event_type="auth.password_change",
            user_id=user.id,
            resource=f"user:{user.id}",
            result="failure",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect"
        )

    user.password_hash = hash_password(payload.new_password)
    audit_service.log_event(
        db,
        event_type="auth.password_change",
        user_id=user.id,
        resource=f"user:{user.id}",
        result="success",
        commit=False,
    )
    db.commit()

    return GenericMessageResponse(message="Password changed successfully")
