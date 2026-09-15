from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ShopSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    shop_name: str
    address: str | None
    phone: str | None
    contact_email: str | None
    updated_at: datetime


class ShopSettingsUpdate(BaseModel):
    shop_name: str = Field(min_length=1, max_length=255)
    address: str | None = Field(default=None, max_length=500)
    phone: str | None = Field(default=None, max_length=50)
    contact_email: EmailStr | None = None
