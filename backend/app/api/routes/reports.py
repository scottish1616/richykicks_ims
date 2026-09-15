"""
Dashboard & report routes. Every number here comes from a live query
against sales/products via report_service - never hardcoded
(PRD sections 12-16).

/dashboard is shop-wide and Admin-only - Staff must never see total
shop revenue (this was previously open to any authenticated user,
which was a real bug: Staff logging in saw shop-wide sales on their
dashboard). /dashboard/staff is the personal-only equivalent, scoped
to whoever is calling it via current_user.id.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db, require_admin
from app.models.user import User
from app.schemas.report import (
    DashboardSummary,
    PeriodReportRequest,
    PeriodReportResponse,
    StaffDashboardSummary,
)
from app.services import report_service

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/dashboard", response_model=DashboardSummary, dependencies=[Depends(require_admin)])
def dashboard(db: Session = Depends(get_db)):
    return report_service.get_dashboard_summary(db)


@router.get("/dashboard/staff", response_model=StaffDashboardSummary)
def staff_dashboard(
    user: User = Depends(get_current_active_user), db: Session = Depends(get_db)
):
    # Always the caller's own id - never a client-supplied staff id
    # (PRD section 16 / IDOR protection).
    return report_service.get_staff_dashboard_summary(db, user.id)


@router.post(
    "/system-wide", response_model=PeriodReportResponse, dependencies=[Depends(require_admin)]
)
def system_wide_report(payload: PeriodReportRequest, db: Session = Depends(get_db)):
    try:
        return report_service.get_period_report(
            db=db, period=payload.period, start_date=payload.start_date, end_date=payload.end_date
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/my-sales", response_model=PeriodReportResponse)
def my_sales_report(
    payload: PeriodReportRequest,
    user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    # Staff can only ever run this against their own sales - staff_id
    # comes from current_user, never from client input (PRD section 16).
    try:
        return report_service.get_period_report(
            db=db,
            period=payload.period,
            start_date=payload.start_date,
            end_date=payload.end_date,
            staff_id=user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
