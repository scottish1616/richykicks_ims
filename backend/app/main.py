"""
RichyKicks Inventory Management System - FastAPI entrypoint.

Wires up CORS (explicit allow-list, no wildcard), security headers,
every route module, and a catch-all exception handler so unhandled
errors never leak stack traces, queries, or internal paths to a client
(PRD section 36) - the real detail still goes to the server logs.
"""
import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.limiter import limiter
from app.api.routes import (
    audit,
    auth,
    notifications,
    products,
    sales,
    stock,
    reports,
    staff,
    settings as settings_routes,
)

logger = logging.getLogger("richykicks")

app = FastAPI(
    title="RichyKicks Inventory Management System",
    version="0.1.0",
    docs_url="/api/docs" if not settings.is_production else None,
    redoc_url=None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # The real exception (with traceback) still goes to the server log
    # for debugging - only a generic, safe message reaches the client.
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred"},
    )


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


app.include_router(auth.router)
app.include_router(products.router)
app.include_router(sales.router)
app.include_router(stock.router)
app.include_router(reports.router)
app.include_router(staff.router)
app.include_router(settings_routes.router)
app.include_router(audit.router)
app.include_router(notifications.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "richykicks-backend"}
