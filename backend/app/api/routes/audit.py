"""
Audit log viewer (Admin only, PRD section 31). Read-only - nothing in
this router ever lets a client create, edit, or delete audit rows.
Not editable by Staff via the API, and not editable by anyone at all.
"""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogRead

router = APIRouter(
    prefix="/api/audit-logs", tags=["audit"], dependencies=[Depends(require_admin)]
)


@router.get("", response_model=list[AuditLogRead])
def list_audit_logs(
    db: Session = Depends(get_db),
    event_type: str | None = Query(default=None),
    user_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    query = db.query(AuditLog)
    if event_type is not None:
        query = query.filter(AuditLog.event_type == event_type)
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)

    return (
        query.order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
