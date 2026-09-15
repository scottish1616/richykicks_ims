# RichyKicks Inventory Management System

Internal inventory & sales management platform for a small physical shoe/sports shop.
Not ecommerce — one Admin, up to two Staff. See `PRD.md` and `TIMELINE.md` for the
full spec and phased build plan.

This is the **Phase 0/1 scaffold**: folder structure, configs, base SQLAlchemy models,
Pydantic schemas, route stubs with RBAC wiring, and a Next.js/Tailwind frontend shell
with the Royal Midnight design tokens. Business logic (auth flows, sales transactions,
receiving approval, reports) is intentionally left as `TODO` / `NotImplementedError` —
that's Phases 1–5 in `TIMELINE.md`.

```
richykicks/
├── backend/     FastAPI + SQLAlchemy + Alembic + PostgreSQL
├── frontend/    Next.js + TypeScript + Tailwind
├── PRD.md
└── TIMELINE.md
```

---

## Backend setup

Requires Python 3.11+ and a running PostgreSQL instance.

```bash
cd backend
python -m venv venv
source venv/bin/activate        # on Windows Git Bash: source venv/Scripts/activate
pip install -r requirements.txt

cp .env.example .env
# then edit .env: set DATABASE_URL, SECRET_KEY, etc.
```

Create the database (adjust to your local Postgres setup):

```bash
createdb richykicks
```

Generate and run the first migration once you're ready to create tables
(models already exist in `app/models/`):

```bash
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

Run the dev server:

```bash
uvicorn app.main:app --reload
```

- API root: http://localhost:8000
- Swagger docs: http://localhost:8000/api/docs (disabled automatically when `ENVIRONMENT=production`)
- Health check: http://localhost:8000/health

Run tests:

```bash
pytest
```

---

## Frontend setup

Requires Node.js 18+.

```bash
cd frontend
npm install

cp .env.example .env.local
# NEXT_PUBLIC_API_URL should point at your backend, e.g. http://localhost:8000
```

Run the dev server:

```bash
npm run dev
```

- App: http://localhost:3000

---

## What's already wired up

- **Backend:** FastAPI app with CORS locked to `FRONTEND_ORIGIN`, basic security
  headers middleware, all 7 SQLAlchemy models (User, Category, Product, Sale,
  StockReceivingSession, StockReceivingItem, AuditLog) with the constraints from
  the PRD (non-negative stock/price, positive sale quantity, etc.), Pydantic
  schemas for every entity, Argon2id password hashing + JWT helpers, a
  `require_role()` RBAC dependency used across every route file, and route
  files for auth/products/sales/stock/reports/staff with the correct
  role-gating already in place.
- **Frontend:** Next.js App Router with all 10 screens from the PRD's navigation
  as routed placeholder pages, Tailwind configured with the exact Royal
  Midnight color tokens, a typed `apiFetch()` wrapper, and shared TypeScript
  types mirroring the backend schemas.

## What's next (per TIMELINE.md)

1. **Phase 1 remainder:** finish auth (`auth_service.py`), password reset via
   Resend, rate limiting/brute-force protection on auth endpoints, refresh
   token rotation.
2. **Phase 2:** category seed script, product CRUD business logic.
3. **Phase 3:** `sales_service.py` — the atomic sale transaction with row
   locking.
4. **Phase 4:** `receiving_service.py` — the atomic approval transaction.
5. **Phase 5:** `report_service.py` — dashboard/report live queries.
6. **Phase 6+:** staff cap enforcement, audit log wiring, security hardening
   pass, design polish, terms/privacy copy, deployment config.

Nothing here should be reordered — later phases depend on the auth/RBAC and
transactional foundations from Phases 1, 3, and 4 being solid first.
