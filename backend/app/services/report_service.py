"""
Dashboard and report queries. Every number here is computed live from
sales/product records via SQL aggregates - nothing hardcoded, nothing
manually synced (PRD sections 12-17).

Day/month boundaries use UTC. If RichyKicks needs a specific local
timezone for "today" to line up with the shop's actual business day,
that's a one-line change here (swap timezone.utc for a configured
zoneinfo) - flagged as a TODO rather than guessed at.
"""
import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.product import Product, ProductVariant
from app.models.sale import Sale

# TODO: replace timezone.utc with the shop's local timezone once known.


def _day_bounds(d: date) -> tuple[datetime, datetime]:
    start = datetime.combine(d, time.min, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


def _month_bounds(year: int, month: int) -> tuple[datetime, datetime]:
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) if month == 12 else datetime(
        year, month + 1, 1, tzinfo=timezone.utc
    )
    return start, end


def _revenue_between(
    db: Session, start: datetime, end: datetime, staff_id: uuid.UUID | None = None
) -> Decimal:
    query = db.query(func.coalesce(func.sum(Sale.total_amount), 0)).filter(
        Sale.created_at >= start, Sale.created_at < end
    )
    if staff_id is not None:
        query = query.filter(Sale.staff_id == staff_id)
    return query.scalar() or Decimal("0")


def _sales_summary_between(
    db: Session, start: datetime, end: datetime, staff_id: uuid.UUID
) -> tuple[Decimal, int]:
    """(revenue, items sold) for one staff member in one window - used
    by the Staff dashboard, which must never see shop-wide figures."""
    revenue, items_sold = (
        db.query(
            func.coalesce(func.sum(Sale.total_amount), 0),
            func.coalesce(func.sum(Sale.quantity), 0),
        )
        .filter(Sale.created_at >= start, Sale.created_at < end, Sale.staff_id == staff_id)
        .one()
    )
    return revenue, items_sold


def get_dashboard_summary(db: Session) -> dict:
    """Admin-only, shop-wide dashboard numbers (PRD-equivalent section
    3). Never call this for a Staff-facing view - see
    get_staff_dashboard_summary for the personal-only equivalent."""
    now = datetime.now(timezone.utc)
    today = now.date()

    total_products = (
        db.query(func.count(Product.id)).filter(Product.is_active.is_(True)).scalar() or 0
    )
    # A product counts as "in stock" if ANY of its colour/size variants
    # has stock - stock no longer lives on Product itself (PRD section 7,
    # updated for the colour/size variant model).
    in_stock = (
        db.query(func.count(func.distinct(Product.id)))
        .join(ProductVariant, ProductVariant.product_id == Product.id)
        .filter(Product.is_active.is_(True), ProductVariant.stock_quantity > 0)
        .scalar()
        or 0
    )
    out_of_stock = total_products - in_stock

    today_start, today_end = _day_bounds(today)
    todays_sales = _revenue_between(db, today_start, today_end)

    month_start, month_end = _month_bounds(now.year, now.month)
    this_month = _revenue_between(db, month_start, month_end)

    if now.month == 1:
        last_month_year, last_month_num = now.year - 1, 12
    else:
        last_month_year, last_month_num = now.year, now.month - 1
    last_month_start, last_month_end = _month_bounds(last_month_year, last_month_num)
    last_month = _revenue_between(db, last_month_start, last_month_end)

    return {
        "total_products": total_products,
        "in_stock": in_stock,
        "out_of_stock": out_of_stock,
        "todays_sales": todays_sales,
        "this_month": this_month,
        "last_month": last_month,
    }


def get_staff_dashboard_summary(db: Session, staff_id: uuid.UUID) -> dict:
    """Personal-only numbers for one Staff member - never shop-wide
    totals. staff_id must always come from the authenticated user
    (current_user.id), never client input (PRD section 16 / IDOR)."""
    now = datetime.now(timezone.utc)

    today_start, today_end = _day_bounds(now.date())
    todays_sales, todays_items_sold = _sales_summary_between(db, today_start, today_end, staff_id)

    month_start, month_end = _month_bounds(now.year, now.month)
    this_month_sales, this_month_items_sold = _sales_summary_between(
        db, month_start, month_end, staff_id
    )

    return {
        "todays_sales": todays_sales,
        "todays_items_sold": todays_items_sold,
        "this_month_sales": this_month_sales,
        "this_month_items_sold": this_month_items_sold,
    }


def _period_bounds(
    period: str, start_date: date | None, end_date: date | None
) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    today = now.date()

    if period == "today":
        return _day_bounds(today)
    if period == "yesterday":
        return _day_bounds(today - timedelta(days=1))
    if period == "this_week":
        start_of_week = today - timedelta(days=today.weekday())
        start, _ = _day_bounds(start_of_week)
        return start, start + timedelta(days=7)
    if period == "this_month":
        return _month_bounds(today.year, today.month)
    if period == "last_month":
        if today.month == 1:
            return _month_bounds(today.year - 1, 12)
        return _month_bounds(today.year, today.month - 1)
    if period == "last_7_days":
        start, _ = _day_bounds(today - timedelta(days=6))
        _, end = _day_bounds(today)
        return start, end
    if period == "last_3_months":
        # Rolling 3-calendar-month window ending with the current
        # month (e.g. in September: July 1 -> now).
        month_index = today.month - 3
        year = today.year
        while month_index <= 0:
            month_index += 12
            year -= 1
        start, _ = _month_bounds(year, month_index)
        _, end = _month_bounds(today.year, today.month)
        return start, end
    if period == "this_year":
        start = datetime(today.year, 1, 1, tzinfo=timezone.utc)
        end = datetime(today.year + 1, 1, 1, tzinfo=timezone.utc)
        return start, end
    if period == "last_year":
        start = datetime(today.year - 1, 1, 1, tzinfo=timezone.utc)
        end = datetime(today.year, 1, 1, tzinfo=timezone.utc)
        return start, end
    if period == "custom":
        if start_date is None or end_date is None:
            raise ValueError("start_date and end_date are required for a custom period")
        start, _ = _day_bounds(start_date)
        _, end = _day_bounds(end_date)
        return start, end

    raise ValueError(f"Unknown period: {period}")


def get_period_report(
    db: Session,
    period: str,
    start_date: date | None = None,
    end_date: date | None = None,
    staff_id: uuid.UUID | None = None,
) -> dict:
    start, end = _period_bounds(period, start_date, end_date)

    query = db.query(
        func.coalesce(func.sum(Sale.total_amount), 0),
        func.coalesce(func.sum(Sale.quantity), 0),
        func.count(Sale.id),
    ).filter(Sale.created_at >= start, Sale.created_at < end)

    if staff_id is not None:
        query = query.filter(Sale.staff_id == staff_id)

    revenue, quantity_sold, sale_count = query.one()

    return {
        "period": period,
        "start": start,
        "end": end,
        "revenue": revenue,
        "quantity_sold": quantity_sold,
        "sale_count": sale_count,
    }
