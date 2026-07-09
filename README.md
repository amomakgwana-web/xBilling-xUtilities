# xBilling / xUtilities Platform

A microservices platform for South African municipal utility billing —
consumer billing (xBilling), utilities operations (xUtilities), and a unified
platform console (xLayer) sitting across billing, payments, metering and
communications.

## Architecture

Node.js/TypeScript pnpm monorepo. Each backend service owns its own data and
is only reachable through the API gateway; frontends never call a downstream
service directly.

```
apps/
  web-xlayer/       Platform console — command centre, payments, campaigns, integrations
  web-xbilling/     Consumer billing portal — dashboard, invoices, pay now
  web-xutilities/   Utilities admin — meters, faults, dispatch

services/
  gateway/              Single entry point: proxies /api/* to services below,
                         dev-mode JWT auth, aggregated /api/platform/status
  billing-service/       Accounts, invoices, billing runs
  payments-service/      Payment methods, ISO 20022-style recon, DebiCheck,
                          payment initiation (routes to gateway adapters)
  metering-service/      Meters, readings, faults, Conlog token vending
  comms-service/         SMS/email campaigns, chatbot session log,
                          optional AI insight/copy generation
  compliance-service/    Third-party integration registry, KYC checks,
                          ISO 27001 / POPIA / PCI-DSS compliance score

packages/
  shared-types/     Zod schemas + TS types shared by every service and frontend
  integrations/     Mock adapters for third parties (see below)
  ui-kit/           Shared design tokens, icons and React primitives —
                     the dark command-centre look used by all three frontends
```

Services communicate over plain HTTP with a consistent envelope
(`{ ok, data, error?, meta? }`, defined in `@xplatform/shared-types`). No
service reaches into another's data directly — `payments-service` calls
`billing-service` over HTTP to apply a settled payment to an invoice, the
same way it would in production.

## Persistence

Each service is backed by a real Postgres database — a Supabase project
("xBilling") with one **schema per service** (`billing`, `payments`,
`metering`, `comms`, `compliance`), so the microservice data-ownership
boundary holds even though it's physically one Postgres instance: no service
queries another's tables directly, and no cross-schema foreign keys exist.

Each service connects via [Drizzle ORM](https://orm.drizzle.team/)
(`src/db/schema.ts` + `src/db/client.ts`) using a dedicated `app_service`
Postgres role scoped to only those 5 schemas — not the Supabase project's
superuser. Every service needs `DATABASE_URL` set (see each
`services/*/.env.example`); get the `app_service` password from whoever
provisioned the project, or rotate it via the Supabase SQL editor:
```sql
ALTER ROLE app_service WITH PASSWORD 'new-password-here';
```

**Row Level Security is currently disabled** on all 14 tables. This is
lower-risk than usual because they live in non-`public` schemas, which
Supabase's auto-generated REST API doesn't expose unless you explicitly add
them to the exposed-schema list — and nothing in this codebase does. If you
ever query these tables via `supabase-js`/PostgREST from a browser (instead
of the Drizzle connection these services use), enable RLS with policies
first.

## What's mocked vs real

Every third-party integration named in the original product mockups
(SwiftPay, Capitec Pay, WhatsApp Pay, Samsung Pay, HANIS, SARS, TransUnion,
Deeds Registry, Conlog, MacroComm, Kafka) is implemented as a **mock
adapter** in `packages/integrations`: realistic simulated latency and
response shapes, no real credentials or network calls. Swap a mock adapter's
internals for a real HTTP client when you have production credentials — the
public method signatures are designed not to need to change.

The one genuinely optional live integration is the Claude-powered "AI
Insight" / SMS-drafting feature in `comms-service`. It calls the Anthropic
API server-side (never from the browser) only if `ANTHROPIC_API_KEY` is set
on `comms-service`; otherwise every caller gets a deterministic canned
response instead of an error.

Auth is a dev-mode JWT issuer (`POST /api/auth/dev-login`) — replace
`services/gateway/src/auth.ts` with a real IdP before production.

## Running locally

Requires Node 20+, pnpm, and the `app_service` Postgres password (see
Persistence above) set as `DATABASE_URL` in each of the 5 backend services'
`.env` files — `pnpm run setup` creates those files from `.env.example` but
you still need to fill in the real password before `dev`/`build` will run
(each service throws immediately on startup if `DATABASE_URL` is missing).

```bash
pnpm run setup     # copies every services/*/.env.example and apps/*/.env.example to .env, then installs deps
pnpm run build     # builds all packages/services/apps once (needed before first `dev` for services)
pnpm run dev       # runs every service and frontend concurrently, with file-watching
```

Ports:

| App/Service          | Port |
|-----------------------|------|
| gateway                | 4000 |
| billing-service        | 4001 |
| payments-service       | 4002 |
| metering-service       | 4003 |
| comms-service          | 4004 |
| compliance-service     | 4005 |
| web-xlayer             | 5173 |
| web-xbilling           | 5174 |
| web-xutilities         | 5175 |

All three frontends read `VITE_API_BASE_URL` (defaults to
`http://localhost:4000/api`, i.e. the gateway) and never call a backend
service directly.

## Docker

`docker-compose.yml` builds every service and frontend (frontends via a
multi-stage build that serves the static Vite bundle through nginx) and wires
them together on one bridge network:

```bash
docker compose up --build
```

Note: image builds were not exercised in this sandbox (its network policy
blocks pulling base images from Docker Hub), but the compose file has been
validated with `docker compose config` and the Dockerfiles follow the same
build steps as the verified local pnpm workflow.

## Verification performed this session

Against the original in-memory version of the backend:
- `pnpm run build` succeeds cleanly across all workspace packages from a
  fully clean state (no stale `dist`/`.tsbuildinfo`).
- All 6 backend services boot and pass `/health`.
- The gateway correctly proxies to every downstream service and aggregates
  `/api/platform/status`.
- A full cross-service payment flow was exercised end-to-end: `POST
  /api/payments/initiate` → SwiftPay mock adapter settles → payments-service
  calls billing-service over HTTP → invoice `amountPaid`/`status` updates.
- All three frontends were loaded in a real browser against the live
  backend (not just typechecked) and screenshotted: xLayer's Command
  Centre/Payments/Integrations pages, xBilling's dashboard → invoice
  drill-down → pay-now flow (including a live payment confirmation), and
  xUtilities' dashboard → meters → token-vend flow.

After migrating each service to Supabase Postgres via Drizzle:
- `pnpm run build` still succeeds cleanly across all 12 workspace packages
  from a fully clean state — every repository/route rewrite typechecks
  against the exact Drizzle schema applied to the live database.
- The schema (5 Postgres schemas, 14 tables) and seed data were applied and
  verified directly against the live Supabase project via SQL, matching the
  original in-memory seed data row-for-row.
- This sandbox's network policy blocks raw-TCP connections to Supabase
  specifically (confirmed via its proxy docs), so live verification used a
  local Postgres instance seeded with the identical schema/data instead.
  That caught a real bug: `DATABASE_URL` was being read before `.env` was
  loaded (same root cause as the earlier gateway fix — ESM imports evaluate
  before `index.ts`'s own top-level code runs), which crashed every service
  on boot. Fixed and re-verified: all 6 services passed `/health`, a
  cross-service payment settled through to a persisted invoice update, and
  all three frontends were loaded in a browser against the live stack.

## What's next

Every domain has a working, wired, end-to-end path with real persistence,
but business logic (tariff calculation, real reconciliation matching rules,
KYC risk scoring, etc.) is intentionally minimal. Natural next steps: run
the same verification against the actual Supabase project (not just a local
stand-in) from an environment with normal network access, enable RLS on the
Supabase tables if you add browser-side `supabase-js` access, add
integration tests around the cross-service HTTP calls, replace the dev-mode
JWT auth with a real IdP, and flesh out the remaining views from the
original mockups (DebiCheck mandate creation, dispute workflow, statement
PDF generation).
