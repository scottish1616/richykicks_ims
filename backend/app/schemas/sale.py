import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class SaleCreate(BaseModel):
    product_variant_id: uuid.UUID
    quantity: int = Field(gt=0)
    actual_price_paid: Decimal = Field(ge=0)


class SaleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_variant_id: uuid.UUID
    staff_id: uuid.UUID
    quantity: int
    listed_price_at_sale: Decimal
    actual_price_paid: Decimal
    total_amount: Decimal
    created_at: datetime
    # Denormalized via Sale model properties so the frontend doesn't
    # need a separate products/variants lookup just to label a row.
    product_name: str
    colour: str
    size: str