"""Seed category names stored in the database, not hardcoded in the UI."""
import uuid

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

SEED_CATEGORY_NAMES = [
    "Sneakers",
    "Slides",
    "Ladies' Shoes",
    "Crocs",
    "Football Boots",
    "Mikasa Balls",
    "Socks",
    "High Heels",
    "Sports Wear",
]


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    products: Mapped[list["Product"]] = relationship(back_populates="category")
