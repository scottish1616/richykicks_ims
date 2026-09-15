"""
Double-submit-cookie CSRF protection (PRD section 35: "Do not assume
SameSite alone is sufficient for every deployment architecture").

At login, a random CSRF token is issued in a JS-readable cookie
alongside the httpOnly access-token cookie. The frontend echoes that
token back as a header on every mutating request; verify_csrf()
compares the two. A cross-site attacker can force a browser to send
cookies automatically, but cannot read the CSRF cookie's value to
reproduce it in a header (same-origin policy), so a forged request
fails this check even though the auth cookie itself would be sent.
"""
import secrets

from fastapi import Header, HTTPException, Request, status

CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def verify_csrf(
    request: Request,
    x_csrf_token: str | None = Header(default=None, alias=CSRF_HEADER_NAME),
) -> None:
    cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
    if not cookie_token or not x_csrf_token or not secrets.compare_digest(cookie_token, x_csrf_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="CSRF token missing or invalid"
        )
