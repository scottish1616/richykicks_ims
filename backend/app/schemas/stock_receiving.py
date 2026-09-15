import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.stock_receiving import ReceivingItemStatus, ReceivingSessionStatus


class ReceivingSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    opened_by: uuid.UUID
    status: ReceivingSessionStatus
    opened_at: datetime
    completed_at: datetime | None
    completed_by: uuid.UUID | None
    closed_at: datetime | None
    verified_at: datetime | None
    rejection_reason: str | None
    reopened_at: datetime | None
    reopened_by: uuid.UUID | None
    reopen_reason: str | None


class ReceivingItemCreate(BaseModel):
    product_id: uuid.UUID
    # Both optional - leave blank for products with no colour/size
    # breakdown (e.g. plain socks). Normalized to "" server-side.
    colour: str | None = Field(default=None, max_length=50)
    size: str | None = Field(default=None, max_length=10)
    quantity_submitted: int = Field(gt=0)
    price_submitted: Decimal = Field(ge=0)


class ReceivingItemCorrection(BaseModel):
    quantity_approved: int = Field(ge=0)
    price_approved: Decimal = Field(ge=0)


class ReceivingItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    product_id: uuid.UUID
    product_variant_id: uuid.UUID | None
    submitted_by: uuid.UUID
    colour: str
    size: str
    quantity_submitted: int
    price_submitted: Decimal
    quantity_approved: int | None
    price_approved: Decimal | None
    status: ReceivingItemStatus
    created_at: datetime


class RejectSessionRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class ReopenSessionRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)
