import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict, Field

from app.models.user import UserRole


class UserBase(BaseModel):
    name: str
    email: EmailStr


class StaffCreate(UserBase):
    password: str = Field(min_length=8)


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: UserRole
    is_active: bool
    created_at: datetime