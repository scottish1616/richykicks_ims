"""
Import every model here so Alembic's autogenerate (env.py) and
Base.metadata can see the whole schema in one place.
"""
from app.core.database import Base
from app.models.user import User, UserRole  # noqa: F401
from app.models.password_reset_token import PasswordResetToken  # noqa: F401
from app.models.category import Category  # noqa: F401
from app.models.product import Product, ProductVariant  # noqa: F401
from app.models.sale import Sale  # noqa: F401
from app.models.stock_receiving import (  # noqa: F401
    StockReceivingSession,
    StockReceivingItem,
    ReceivingSessionStatus,
    ReceivingItemStatus,
)
from app.models.notification import Notification, NotificationType  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.settings import ShopSettings  # noqa: F401

__all__ = [
    "Base",
    "User",
    "UserRole",
    "PasswordResetToken",
    "Category",
    "Product",
    "ProductVariant",
    "Sale",
    "StockReceivingSession",
    "StockReceivingItem",
    "ReceivingSessionStatus",
    "ReceivingItemStatus",
    "Notification",
    "NotificationType",
    "AuditLog",
    "ShopSettings",
]
