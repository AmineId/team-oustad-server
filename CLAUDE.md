# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev:full             # Start DB + server in one command (recommended)
npm run dev                  # Start server only (nodemon)
npm start                    # Start without nodemon

# Database (local Docker)
npm run db:up                # Start local PostgreSQL container
npm run db:down              # Stop local PostgreSQL container
npm run migrate              # Create and apply migrations (dev)
npm run db:seed              # Seed test data (prisma/seed.js)
npm run studio               # Open Prisma Studio GUI

# Tests
npm test                     # Run all Jest tests
npm test -- tests/routes/auth.test.js  # Run a single route's tests
npm run test:coverage        # Run tests with coverage report (threshold: 70%)

# Environments
npm run start:preprod        # Start with .env.preprod
npm run start:prod           # Start with .env.prod
npm run migrate:prod         # Apply migrations to production DB
npm run preprod:setup        # First-time preprod setup (DB + migrate + seed)
```

Tests require a running PostgreSQL instance configured in `.env.test`. Start it with `npm run db:test:up`.

## Architecture

This is an Express.js REST API for gym management with Prisma ORM (PostgreSQL). Entry point is `index.js`.

### Request flow

`routes/` → `services/` → `utils/prismaClient.js` → PostgreSQL

- Routes handle HTTP, validate inputs, call services or Prisma directly for simple queries
- `services/` holds complex business logic (subscriptions, email, push notifications, banners, store)
- `middleware/auth.js` verifies JWT and attaches `req.user` with `{ sub, email, type }` to requests

### User roles

Users have a `role` field (`owner`, `admin`, `member`) plus a matching detail table (`Owner`, `Admin`, `Member`). Role-specific capabilities live in those detail tables. The `Member` table holds fitness profile data; `Owner`/`Admin` hold permission flags.

### ID conventions

Every model has both `id` (internal integer PK) and `displayId` (unique string, e.g. `USR-123`). API responses expose `displayId`, never the raw `id`. Lookups from routes use `displayId`; internal service calls use `id`.

### Subscription system

`SubscriptionType` (template with price/quota) → `Subscription` (member's active sub) → `Payment[]` (installments). Payment frequency: 1, 3, 6, or 12 installments per year. Acknowledging a payment via `POST /subscriptions/payments/:id/acknowledge` transitions a `pending` subscription to `active`. `sessionType` is either `"limited"` (uses `sessionQuota`) or `"unlimited"`.

### Cron jobs (`jobs/` and inline in `index.js`)

| Schedule | Job |
|----------|-----|
| 23:00 daily | `dailyPaymentCheck` — marks overdue payments, pauses subscriptions |
| 06:00 daily | `dailyPlanningNotification` — FCM push for members with a workout today |
| 10:00 daily | `lowQuotaNotification` — alerts when session quota is low |
| Every hour | Banner activation/deactivation based on `startDate`/`endDate` |
| 00:01 daily | Auto-checkout of any open `GymCheckIn` from the previous day |

### External services

- **Firebase FCM** (`services/pushNotificationService.js`): requires `FIREBASE_SERVICE_ACCOUNT_PATH` env var pointing to `firebase-service-account.json`
- **Email** (`services/emailService.js`): Nodemailer/SMTP; configured via `SMTP_*` env vars
- **MCP server** (`mcp-server/`): a separate Node.js process exposing 40 tools for AI assistants to interact with the API; has its own `package.json` and `.env`

### Test setup

Jest + Supertest. `tests/setup.js` auto-mocks `emailService`, `pushNotificationService`, and `qrcode` for all tests. Test files live in `tests/routes/*.test.js` and `tests/services/*.test.js`. All tests run with `--runInBand` (sequential) to avoid DB conflicts.

### Environment files

| File | Purpose |
|------|---------|
| `.env` | Local development |
| `.env.test` | Test database |
| `.env.preprod` | Staging VPS |
| `.env.prod` | Production VPS |

Minimum required vars: `DATABASE_URL`, `JWT_SECRET`, `PORT`.

### Seed accounts (after `npm run db:seed`)

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@team-oustad.com` | `owner123` |
| Admin | `admin@team-oustad.com` | `admin123` |
| Member (pending sub) | `olivia@example.com` | `member123` |
| Member (active sub) | `bob@example.com` | `member123` |
