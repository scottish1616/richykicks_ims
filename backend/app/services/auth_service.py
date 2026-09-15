"""
Auth business logic: password reset token issuance/consumption and
brute-force lockout helpers. Kept out of the route handlers so it's
independently testable.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.password_reset_token import PasswordResetToken
from app.models.user import User

RESET_TOKEN_BYTES = 32
RESET_TOKEN_EXPIRE_MINUTES = 30

MAX_FAILED_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def create_password_reset_token(db: Session, user: User) -> str:
    """Generates a random single-use reset token, stores only its hash,
    and returns the raw token (only place it ever exists in plaintext)."""
    raw_token = secrets.token_urlsafe(RESET_TOKEN_BYTES)
    record = PasswordResetToken(
        user_id=user.id,
        token_hash=_hash_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
    )
    db.add(record)
    db.commit()
    return raw_token


def consume_password_reset_token(db: Session, raw_token: str) -> User | None:
    """Validates a raw token against the stored hash, checks expiry and
    single-use, and marks it used. Returns the associated User, or None
    if the token is invalid/expired/already used."""
    token_hash = _hash_token(raw_token)
    record = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash)
        .first()
    )
    if record is None:
        return None

    now = datetime.now(timezone.utc)
    if record.used_at is not None or record.expires_at < now:
        return None

    user = db.get(User, record.user_id)
    if user is None:
        return None

    record.used_at = now
    db.commit()
    return user


def register_failed_login(db: Session, user: User) -> None:
    user.failed_login_attempts += 1
    if user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
        user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
    db.commit()


def register_successful_login(db: Session, user: User) -> None:
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()


def is_locked_out(user: User) -> bool:
    return user.locked_until is not None and user.locked_until > datetime.now(timezone.utc)
