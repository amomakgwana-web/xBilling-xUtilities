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
(`{ ok, data, error?, meta? }`, defined in `@xplatform/shared-types`). Nothing
shares a database — `payments-service` calls `billing-service` over HTTP to
apply a settled payment to an invoice, the same way it would in production.

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

Requires Node 20+ and pnpm.

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

- `pnpm run build` succeeds cleanly across all 12 workspace packages from a
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

## What's next

This is a breadth-first scaffold — every domain has a working, wired,
end-to-end path, but each service's business logic (tariff calculation,
real reconciliation matching rules, KYC risk scoring, etc.) is intentionally
minimal and backed by in-memory data rather than a persisted database.
Natural next steps: give each service its own Postgres schema, add
integration tests around the cross-service HTTP calls, replace the dev-mode
JWT auth with a real IdP, and flesh out the remaining views from the
original mockups (DebiCheck mandate creation, dispute workflow, statement
PDF generation).
