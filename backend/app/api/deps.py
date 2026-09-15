"""
Shared FastAPI dependencies: DB session, current-user resolution, and
role-based access control. Every protected route depends on these -
role checks live here in the backend, never only in the frontend
(PRD sections 25-26).

Auth uses an httpOnly cookie rather than a JS-readable bearer token
(PRD section 22: no sensitive tokens in localStorage unless justified).
"""
import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole

ACCESS_COOKIE_NAME = "access_token"


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    token = request.cookies.get(ACCESS_COOKIE_NAME)
    if token is None:
        raise credentials_error

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise credentials_error

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_error

    try:
        user = db.get(User, uuid.UUID(user_id))
    except ValueError:
        raise credentials_error

    if user is None:
        raise credentials_error

    return user


def get_current_active_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    return user


def require_role(*allowed_roles: UserRole):
    """Dependency factory: require_role(UserRole.ADMIN) etc."""

    def _check(user: User = Depends(get_current_active_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return user

    return _check


require_admin = require_role(UserRole.ADMIN)
require_any_role = require_role(UserRole.ADMIN, UserRole.STAFF)
