# RichyKicks Inventory Management System — Product Requirements Document

**Version:** 1.0 (MVP)
**Status:** Planning
**Type:** Internal-only inventory & sales management platform (not ecommerce)

---

## 1. Purpose & Vision

RichyKicks Inventory Management System is an internal tool for a small physical shoe/sports shop. It lets one **Admin** and up to **two Staff** members manage products, inventory, sales, stock receiving, and reporting — accurately, securely, and with a single source of truth (PostgreSQL).

There is no customer-facing side. This is a back-office tool only.

**Priority order for every decision made during the build:**
Security > Data Integrity > Correct Business Logic > Reliability > Usability > Visual Polish > Extra Features

---

## 2. Goals

- Replace manual/paper or spreadsheet-based inventory and sales tracking with a reliable, auditable system.
- Guarantee stock counts are always correct (no negative stock, no double-deduction, no lost updates under concurrent sales).
- Let staff record real-world price negotiation ("bargaining") without corrupting the product's listed price or historical revenue.
- Give the Admin a verification gate on all incoming stock before it becomes authoritative inventory.
- Produce dashboard and report numbers that are 100% derived from real records — nothing hardcoded, nothing fake.

## 3. Non-Goals (explicitly out of scope for MVP)

Ecommerce, customer accounts/profiles, shopping cart, wishlist, online payments, product image uploads, reviews/ratings, loyalty programs, coupons, delivery tracking, AI recommendations, chatbots, crypto, social integrations, unnecessary notifications/analytics.

---

## 4. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js + TypeScript |
| Backend | Python, FastAPI |
| ORM / Migrations | SQLAlchemy + Alembic |
| Validation | Pydantic |
| Database | PostgreSQL |
| Email | Resend API (backend-only key) |
| Auth | Backend-controlled sessions, Argon2id password hashing |

---

## 5. Roles & Permissions

### Admin (exactly 1 account)
Full control: products, categories, inventory, receiving sessions (start/verify/approve/reject), all sales, staff management (create/disable, max 2), reports (system-wide), settings, own password, audit visibility.

### Staff (max 2 active accounts, backend-enforced)
Can: log in/out, view dashboard & products/stock, record sales, enter received-stock quantities/prices during an **active** receiving session, submit receiving for verification, view **only their own** sales/reports, change own password.

Cannot: manage staff/roles, approve their own (or any) receiving, delete historical sales, change categories, change auth/security settings, alter another user's data, override the system's authoritative selling price outside policy.

**Golden rule:** every permission is enforced in FastAPI, never only hidden in the UI. A raw API call from Staff must be rejected the same way a UI action would be.

---

## 6. Core Data Entities

- **User** — id, name, email, password_hash, role (admin/staff), active flag, timestamps
- **Category** — fixed seed list: Sneakers, Slides, Ladies' Shoes, Crocs, Football Boots, Mikasa Balls, Socks, High Heels
- **Product** — id, name, category_id, listed_price, stock_quantity, computed stock_status, active flag, timestamps
- **Sale** — id, product_id, quantity, listed_price_at_sale, actual_price_paid, total, staff_id, created_at
- **StockReceivingSession** — id, opened_by (admin), status (open/pending/approved/rejected), timestamps
- **StockReceivingItem** — session_id, product_id, quantity_submitted, price_submitted, quantity_approved, price_approved, status
- **AuditLog** — id, event_type, user_id, resource, result, metadata, created_at

---

## 7. Key Business Rules

1. Database is the single source of truth — no manually synced counters, no hardcoded dashboard numbers.
2. `stock_status` is always derived: `> 0` → In Stock, `= 0` → Out of Stock. Never negative.
3. A sale is one atomic transaction: validate stock → create sale row → decrement stock → commit. Any failure rolls back everything. Row locking prevents race conditions on concurrent sales.
4. Revenue always uses `actual_price_paid`, never the product's current listed price. Historical sales never change when the listed price later changes.
5. Stock receiving never touches authoritative inventory until Admin approves. Approval is one atomic transaction (update stock, apply approved price, log movement, mark session approved). Double-approval must be impossible.
6. Staff can only ever see `WHERE staff_id = current_user.id` on their own sales/report endpoints — enforced server-side, not by trusting a client-supplied ID.
7. Max 2 active Staff accounts, enforced at creation time in the backend/DB, not just the UI.

---

## 8. Authentication & Security Requirements

- Argon2id (or equivalent modern) password hashing; never plaintext, never logged, never returned in API responses.
- Short-lived session/auth tokens with expiration, secure logout, refresh handling if used (rotation + reuse detection where practical).
- Secure cookies in production: `HttpOnly`, `Secure`, appropriate `SameSite`; CSRF protection if cookie-based auth is used.
- Forgot-password flow: cryptographically random, single-use, expiring, hashed-at-rest reset tokens; generic "if an account exists…" response (no user enumeration); emails sent via Resend, key backend-only.
- Rate limiting + brute-force protection on login, password reset, and sensitive admin endpoints; configurable via env vars; `429` on limit.
- RBAC enforced on every protected endpoint (authenticated → active → correct role → correct resource ownership).
- IDOR protection — no trusting client-supplied IDs for data ownership.
- Full input validation via Pydantic; no unsafe SQL string concatenation; no raw DB errors surfaced to clients.
- Audit log for all sensitive actions (auth events, staff/role/price changes, sales, receiving lifecycle) — not editable by Staff, never contains secrets/passwords/tokens.
- Security headers (CSP, X-Content-Type-Options, Referrer-Policy, HSTS in prod), explicit CORS allow-list (no `*` in production), HTTPS + secure cookies in production, no debug mode or exposed secrets in deployment.

---

## 9. UX / Design Direction

**Brand:** RichyKicks — "Royal Midnight" visual identity. Modern, luxury, royal — premium but not complicated. Gold used as accent only.

| Token | Hex |
|---|---|
| Deep Midnight | `#0B0B10` |
| Royal Purple | `#5B21B6` |
| Rich Gold | `#D4AF37` |
| Ivory White | `#F5F5F0` |
| Soft Gray | `#A1A1AA` |
| Dark Charcoal | `#15151C` |
| Deep Purple Hover | `#4C1D95` |
| Emerald Success | `#10B981` |
| Ruby Error | `#DC2626` |

No gradients, no excessive animation, no fake stats/testimonials/stock photos, fully responsive, accessible contrast, clean tables and forms.

**Navigation (role-aware, backend still enforces everything):** Dashboard, Products, Sales, Receiving, Reports, Staff, Settings, Logout.

---

## 10. Core Screens / Modules

1. **Login** — RichyKicks-branded, email + password, forgot password, clear validation/error states, loading state.
2. **Dashboard** — Total Products, In Stock, Out of Stock, Today's Sales, This Month, Last Month — all computed live.
3. **Products** — list/search/filter by category, create/edit (Admin), stock quantity + computed status.
4. **Sales** — record a sale (product, quantity, actual price paid), staff sees only own history; Admin sees all.
5. **Receiving** — Admin opens a session → Staff enters items → Staff submits → Admin reviews/corrects → Admin approves/rejects.
6. **Reports** — Today / Yesterday / This Week / This Month / Last Month / Custom Range, by product/category/staff, admin system-wide vs staff own-sales-only.
7. **Staff (Admin only)** — create/disable staff (max 2 enforced), no role escalation possible from the UI or API.
8. **Settings (Admin only)** — minimal: shop info, relevant app preferences; security config stays server-side/env, not UI-editable.
9. **/terms, /privacy** — simple, honest, no fabricated claims.

---

## 11. Testing Requirements (minimum bar)

- **Auth:** login success/failure, expired session, logout, reset flow (incl. expired/reused token), password change.
- **AuthZ:** admin vs staff access, staff hitting admin endpoints, staff hitting another staff's data, disabled account access.
- **Products:** create/update, invalid values, category validation.
- **Sales:** success path, correct stock decrement, insufficient stock, zero/negative quantity, bargained price, historical price preservation, concurrent sales (race condition).
- **Receiving:** submission, pending state, admin correction, approval, rejection, double-approval prevention, inventory updates only post-approval.
- **Reports:** all periods, staff-only filtering, revenue = actual amount paid.
- **Security:** ID/role manipulation, invalid/expired auth, rate limits, SQL injection attempts, oversized/duplicate requests, race conditions, unauthorized staff creation/password change, audit log access control.

---

## 12. Success Criteria for MVP Sign-off

- All rules in §7 hold under manual and automated testing, including concurrent-sale and double-approval edge cases.
- A Staff account cannot perform any Admin-only action via direct API calls (verified by security tests, not just UI).
- Dashboard and report numbers match manual SQL queries against the same data.
- No secrets present in frontend bundle, git history, or API responses.
- Production deployment runs HTTPS-only, restricted CORS, secure cookies, rate limiting active, debug mode off.
