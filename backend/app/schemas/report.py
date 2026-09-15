from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_products: int
    in_stock: int
    out_of_stock: int
    todays_sales: Decimal
    this_month: Decimal
    last_month: Decimal


class StaffDashboardSummary(BaseModel):
    """Personal-only numbers for the authenticated Staff member - never
    shop-wide totals. Derived entirely from Sale.staff_id = current
    user, never a client-supplied id (mirrors PRD section 16)."""

    todays_sales: Decimal
    todays_items_sold: int
    this_month_sales: Decimal
    this_month_items_sold: int


class PeriodReportRequest(BaseModel):
    period: str  # "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom"
    start_date: date | None = None
    end_date: date | None = None


class PeriodReportResponse(BaseModel):
    period: str
    start: datetime
    end: datetime
    revenue: Decimal
    quantity_sold: int
    sale_count: int


class RevenueByBucket(BaseModel):
    label: str
    revenue: Decimal
    quantity_sold: int
