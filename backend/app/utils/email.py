"""
Resend integration for transactional email. The API key lives only in
backend env config (PRD section 21) - never passed to or read from the
frontend. Falls back to printing the link in dev if no key is set yet,
so local development isn't blocked on having a Resend account.
"""
import resend

from app.core.config import settings

resend.api_key = settings.RESEND_API_KEY


def send_password_reset_email(to_email: str, reset_url: str) -> None:
    if not settings.RESEND_API_KEY:
        print(f"[dev-only] Password reset link for {to_email}: {reset_url}")
        return

    resend.Emails.send(
        {
            "from": "RichyKicks <no-reply@richykicks.example>",
            "to": [to_email],
            "subject": "Reset your RichyKicks password",
            "html": (
                "<p>Click the link below to reset your RichyKicks password. "
                "This link expires in 30 minutes and can only be used once.</p>"
                f"<p><a href='{reset_url}'>{reset_url}</a></p>"
                "<p>If you didn't request this, you can safely ignore this email.</p>"
            ),
        }
    )
