"""
audit_service.py — write AuditLog rows for sensitive security/business
events (PRD section 31).

log_event() never logs passwords, tokens, or API keys - callers must
only pass safe, non-secret metadata. By default it commits
immediately; pass commit=False when a caller wants the audit row to
land in the SAME atomic transaction as the business action it
describes (e.g. sales_service.record_sale commits the sale and its
audit row together, so one can never exist without the other).
"""
import uuid

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log_event(
    db: Session,
    *,
    event_type: str,
    user_id: uuid.UUID | None,
    resource: str | None = None,
    result: str = "success",
    metadata: dict | None = None,
    commit: bool = True,
) -> AuditLog:
    entry = AuditLog(
        event_type=event_type,
        user_id=user_id,
        resource=resource,
        result=result,
        log_metadata=metadata,
    )
    db.add(entry)
    if commit:
        db.commit()
    return entry
