# RichyKicks Inventory Management System — Development Timeline

Estimates assume one developer (part-time around coursework), working in focused sessions.
Each phase ends with something runnable/testable before moving on — no phase should be skipped or reordered, since later phases depend on earlier security/data foundations being solid.

**Total estimate: ~9–11 weeks part-time** (adjust freely once you know your actual weekly hours).

---

## Phase 0 — Design & Planning (2–3 days)
*"Measure twice, cut once" — required before writing app code per the spec.*

- Finalize DB schema & ERD (User, Category, Product, Sale, StockReceivingSession, StockReceivingItem, AuditLog)
- Define roles/permissions matrix (Admin vs Staff, endpoint by endpoint)
- Define auth/session architecture (token type, expiry, refresh strategy, cookie flags)
- Define the sales transaction flow and receiving approval flow as sequence diagrams
- Sketch report/dashboard queries (what SQL answers each number)
- Draft API endpoint list (routes/methods/roles required)
- **Output:** schema doc + endpoint list committed to the repo before Phase 1 starts

## Phase 1 — Backend Foundation & Auth (1–1.5 weeks)

- Project scaffolding (FastAPI app structure per §45 layout), config/env setup, `.env.example`
- PostgreSQL connection, Alembic migrations, base models
- Argon2id password hashing, login/logout, session/token issuance & expiration
- Password reset flow (token generation, hashing, expiry, Resend email, single-use invalidation)
- RBAC dependency/middleware (`deps.py`), applied to a couple of placeholder routes
- Rate limiting + brute-force protection on auth endpoints
- Security headers & CORS config
- **Output:** working auth system, testable via API docs (Swagger), with tests for login/logout/reset/rate-limits

## Phase 2 — Products, Categories & Inventory Core (4–6 days)

- Category seed (fixed 8 categories), admin-only category management
- Product CRUD (Admin), computed stock_status, active/inactive flag
- Staff read-only product/stock views
- Input validation on all fields (Pydantic), indexes on frequently queried columns
- **Output:** product/category endpoints + basic frontend list/detail pages, with tests

## Phase 3 — Sales Module (4–6 days)

- Atomic sale transaction: validate → create sale → decrement stock → commit/rollback
- Row-level locking / concurrency handling for simultaneous sales
- Actual-price-paid vs listed-price separation (bargaining), historical price immutability
- Staff "own sales only" endpoint with server-side ownership checks (IDOR protection)
- **Output:** sales recording UI + endpoint, with concurrency & historical-price tests

## Phase 4 — Stock Receiving Workflow (1 week)

- Admin: open/close receiving session
- Staff: enter items (product, qty, price) into an open session, submit (→ pending)
- Admin: review, correct, approve or reject (single atomic transaction on approve)
- Double-approval prevention, inventory movement history
- **Output:** full receiving lifecycle UI + endpoints, with tests for pending/approve/reject/double-approval

## Phase 5 — Reports & Dashboard (4–5 days)

- Dashboard cards (Total Products, In/Out of Stock, Today/This Month/Last Month) — all live queries
- Period filtering (Today, Yesterday, This Week, This Month, Last Month, Custom Range)
- Admin system-wide reports (by product, category, staff); Staff "My Sales" view
- Pagination for large lists
- **Output:** dashboard + reports pages, tests confirming revenue = actual amount paid per period

## Phase 6 — Staff Management & Settings (2–3 days)

- Admin-only staff create/disable, hard cap of 2 active staff enforced server-side
- Minimal settings module (shop info, session/security config surfaced read-only where sensitive)
- **Output:** staff management UI + endpoint, tests for the 2-account cap and role-escalation prevention

## Phase 7 — Audit Logging & Security Hardening Pass (3–4 days)

- Audit log wiring across all sensitive actions listed in the PRD
- Full security test pass: ID/role manipulation, invalid/expired auth, SQL injection attempts, oversized/duplicate requests, race conditions
- CSRF review if cookie-based auth is used
- Review error handling (no stack traces/secrets leaking to clients)
- **Output:** audit log viewer (Admin), security test suite green

## Phase 8 — Frontend Polish & Terms/Privacy (3–4 days)

- Apply Royal Midnight design system consistently across all screens
- Responsive pass (desktop/tablet/mobile), accessibility contrast check
- `/terms` and `/privacy` pages (honest, no fabricated claims)
- Loading/error states across forms
- **Output:** visually complete MVP

## Phase 9 — Full System Testing & Deployment (3–5 days)

- End-to-end pass through every workflow (auth → products → sales → receiving → reports) as both roles
- Load a realistic dataset, verify dashboard/report numbers against manual SQL
- Production config: HTTPS, restricted CORS, secure cookies, rate limits active, debug off, secrets rotated
- Deploy backend + frontend + database, verify migrations run cleanly on prod DB
- Final security review checklist sign-off (PRD §12)
- **Output:** deployed, tested MVP

---

## Suggested Order of Attack (if time-boxed harder)

If the timeline needs compressing, the one place you cannot cut corners is **Phase 1 (auth/RBAC) and Phase 3/4 (transactional integrity)** — those are the security- and data-integrity-critical paths the whole spec is built around. Reports/dashboard polish (Phase 5, 8) can be trimmed or simplified first if you're short on time.

---

*Next step: confirm Phase 0 deliverables (schema + endpoint list) before any code is written, per the spec's development requirement.*
