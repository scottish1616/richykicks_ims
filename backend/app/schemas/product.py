import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


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
    is_active: bool | None = None


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
