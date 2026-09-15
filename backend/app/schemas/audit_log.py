import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_type: str
    user_id: uuid.UUID | None
    resource: str | None
    result: str
    log_metadata: dict | None
    created_at: datetime
