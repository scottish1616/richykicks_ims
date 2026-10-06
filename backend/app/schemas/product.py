import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

class ProductBase(BaseModel):
    name: str
    category_id: uuid.UUID
    listed_price: Decimal = Field(ge=0)


class ProductCreate(ProductBase):
    # No initial stock here on purpose - stock only ever enters the
    # system through the receiving-approval workflow, which is also
    # what creates the first colour/size variant(s) for a new product.
    pass


class ProductUpdate(BaseModel):
    name: str | None = None
    category_id: uuid.UUID | None = None
    listed_price: Decimal | None = Field(default=None, ge=0)


class StockAdjustmentRequest(BaseModel):
    adjustment: int
    reason: str = Field(min_length=3, max_length=500)

    @field_validator("reason")
    @classmethod
    def reason_must_not_be_blank(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 3:
            raise ValueError("A reason of at least 3 characters is required")
        return normalized

    @field_validator("adjustment")
    @classmethod
    def adjustment_must_be_nonzero(cls, value: int) -> int:
        if value == 0:
            raise ValueError("Stock adjustment must not be zero")
        return value


class ProductVariantAdjustmentRequest(StockAdjustmentRequest):
    colour: str | None = Field(default=None, max_length=50)
    size: str | None = Field(default=None, max_length=10)


class ProductVariantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    colour: str
    size: str
    stock_quantity: int


class ProductRead(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    total_stock: int
    stock_status: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    variants: list[ProductVariantRead] = []


class CategoryRead(BaseModel):
    id: uuid.UUID
    name: str
    # Standard sizes for the receiving-entry checkbox grid (empty for
    # non-sized categories, e.g. Mikasa Balls, Socks). Not an ORM
    # column - computed from app.core.product_sizes at request time,
    # so this is built explicitly in the route rather than read via
    # from_attributes.
    sizes: list[str] = []
