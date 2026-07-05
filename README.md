# BYV Backend

Dedicated Express + TypeScript backend for Book Your Vibes — separate from the Next.js
frontend in `../frontend`, owning all data, auth, and business logic behind a REST API.

## Stack

- **Express 4** + **TypeScript** (strict mode)
- **MongoDB** via **Mongoose**
- **JWT** access tokens (short-lived, sent in `Authorization: Bearer`) + **rotating refresh
  tokens** (httpOnly, path-scoped cookies, hashed at rest, reuse detection)
- **zod** for request validation
- **helmet**, **cors** (allow-list), **express-rate-limit**, **express-mongo-sanitize**,
  **hpp**, **compression**, **pino** structured logging

## Getting started

```bash
cp .env.example .env   # then fill in real secrets — see below
npm install
npm run dev             # tsx watch, http://localhost:4000
```

Requires a running MongoDB instance (`MONGODB_URI` in `.env`). No Mongo instance was
available in the environment this was built in, so the app was smoke-tested for routing,
security headers, validation and error handling but **not** against a live database —
run `npm run dev` and exercise the auth flows once Mongo is reachable.

```bash
npm run build && npm start   # production build
npm run typecheck            # tsc --noEmit
npm run lint                 # eslint
npm run seed                 # creates the first super admin from SEED_ADMIN_EMAIL/PASSWORD
```

## Auth model

Three independent audiences — **customer**, **vendor**, **admin** — each with its own JWT
`aud` claim, its own refresh-token cookie (`customer_rt`, `vendor_rt`, `admin_rt`, each
path-scoped to its own `/refresh` endpoint), and its own login/refresh/logout routes. A
token minted for one audience is rejected outright on another audience's routes.

- **Vendor** audience covers three roles sharing one login endpoint
  (`POST /auth/vendor/login`): the business owner (`vendor`), and staff/sub-admin accounts
  (`staff` / `subadmin`) created by the owner under `Vendor > Staff`. Staff permissions are
  a per-module view/create/edit/delete matrix, checked **fresh from the database on every
  request** (not baked into the JWT), so revoking access takes effect immediately.
- **Admin** audience covers the super admin and admin sub-users the same way.
- Refresh tokens are rotated on every use; reuse of an already-rotated token revokes the
  entire session family for that user (theft/replay detection).

## Payments

`src/services/payment/` defines a `PaymentProvider` interface. `MockPaymentProvider` is
wired in for now (auto-approves orders) since no Cashfree credentials were available —
swap the binding in `payment.service.ts` for a real `CashfreeProvider` later; nothing in
the booking flow needs to change.

## Module layout

```
src/
  config/       env validation (zod), DB connection, logger
  models/       Mongoose schemas
  middleware/   auth guards, RBAC/permission checks, validation, rate limits, error handler
  validators/   zod request schemas
  services/     business logic (bookings, listings, tokens, payments)
  modules/
    auth/       customer / vendor / admin auth
    venues/     public listing browse (home page, venue detail, booking flow)
    listings/   vendor-scoped and admin listing CRUD
    bookings/   customer / vendor / admin booking flows
    vendor/     vendor profile, staff management, dashboard & earnings
    admin/      vendor approval, sub-admins, blog, payouts, app version, dashboard
  routes/       route aggregation, mounted at API_PREFIX (default /api/v1)
```

## Known gaps / next steps

- Payment gateway is stubbed — see above.
- `categories`, `marketing`, `user-queries`, `refund-payouts` admin pages are still
  "Coming Soon" on the frontend, so no backend module was built for them yet.
- No file/image upload endpoint yet — `coverImage`/`images` on listings currently expect
  URLs (e.g. from S3/Cloudinary uploaded elsewhere). Add an upload route once storage is
  decided.
