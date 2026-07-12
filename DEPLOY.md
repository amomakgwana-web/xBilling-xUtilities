# Deploying to Railway (backend) + Vercel (frontend)

Neither platform has a connector this session can drive directly, so the
steps below are the dashboard clicks to do it yourself. Everything in this
repo is already set up so no extra config should be needed beyond what's
described here.

## Secrets checklist

Gather these before starting — one pass, no cross-referencing individual
`.env.example` files. "Where" is the Railway service (or Vercel project)
that needs it; every backend service also needs its own `PORT` (see the
port table below) and `CORS_ORIGIN` (see the per-service section).

| Variable | Where | Required? | Notes |
|---|---|---|---|
| `DATABASE_URL` | all 6 backend services | **Required** | Same Supabase `app_service` connection string everywhere — only the schema each service reads/writes differs. Never the project's `postgres` superuser. |
| `JWT_SECRET` | gateway only | **Required** | Generate a real secret (e.g. `openssl rand -hex 32`) — do not reuse the local dev value `dev-secret-change-me`. |
| `CORS_ORIGIN` | gateway | **Required** | The Vercel `web-platform` domain, once you have it. The 5 backend services can stay `*` — Railway's private network is the actual boundary, not their CORS check. |
| `BILLING_SERVICE_URL` | gateway, payments-service | **Required** | Railway private-network DNS: `http://billing-service.railway.internal:4001`. |
| `PAYMENTS_SERVICE_URL` | gateway | **Required** | `http://payments-service.railway.internal:4002`. |
| `METERING_SERVICE_URL` | gateway | **Required** | `http://metering-service.railway.internal:4003`. |
| `COMMS_SERVICE_URL` | gateway | **Required** | `http://comms-service.railway.internal:4004`. |
| `COMPLIANCE_SERVICE_URL` | gateway | **Required** | `http://compliance-service.railway.internal:4005`. |
| `VITE_API_BASE_URL` | web-platform (Vercel) | **Required** | `https://<gateway-railway-domain>/api`. Vite inlines this at build time — set it *before* the first deploy. |
| `ANTHROPIC_API_KEY` | comms-service | Optional | Enables real Claude-generated AI insight/chatbot copy. Without it: canned deterministic fallback, not a failure. |
| `BULKSMS_TOKEN_ID` / `BULKSMS_TOKEN_SECRET` | comms-service | Optional | Live SMS dispatch. Without it: mock SMS gateway, not a failure. |
| `RESEND_API_KEY` / `RESEND_FROM` | comms-service | Optional | Live email dispatch. Without it: mock email gateway, not a failure. |

Every backend service fails loudly and refuses to boot if `DATABASE_URL`
is missing (throws on startup, so Railway's health check — and its
restart-on-failure policy — catches it immediately rather than the
service hanging half-configured). The optional comms-service vars degrade
to mocked behavior instead of crashing, by design — the same fallback this
repo already uses for local dev without API keys.

## Backend — Railway

Create **one Railway project**, then add **six services** to it, all
pointed at this GitHub repo (`amomakgwana-web/xBilling-xUtilities`,
branch `main` once this PR merges). For each service:

1. "Deploy from GitHub repo" → select this repo
2. Leave **Root Directory** as `/` (repo root) — the pnpm workspace needs to
   install from the root
3. Under Settings → Config-as-code, set the **Config File Path** to the
   service's own `railway.json` (already committed, so Railway will pick up
   the right build/start command automatically):

| Railway service name | Config File Path                              | PORT |
|-----------------------|------------------------------------------------|------|
| `gateway`              | `services/gateway/railway.json`                 | 4000 |
| `billing-service`      | `services/billing-service/railway.json`         | 4001 |
| `payments-service`     | `services/payments-service/railway.json`        | 4002 |
| `metering-service`     | `services/metering-service/railway.json`        | 4003 |
| `comms-service`        | `services/comms-service/railway.json`           | 4004 |
| `compliance-service`   | `services/compliance-service/railway.json`      | 4005 |

Name each Railway service exactly as in the table above — the env vars
below depend on Railway's private networking DNS, which is
`<service-name>.railway.internal`.

### Environment variables per service

Set `PORT` explicitly on every service (Railway's private networking
targets whatever port the service actually listens on, so this must match
the table above). Then:

**gateway** (the only service that needs a public domain — click "Generate
Domain" on this one only):
```
PORT=4000
JWT_SECRET=<generate a real secret, not the local dev one>
CORS_ORIGIN=https://<your-web-platform-domain>
DATABASE_URL=<same Supabase app_service URL as the other services — the gateway reads platform.users for login>
BILLING_SERVICE_URL=http://billing-service.railway.internal:4001
PAYMENTS_SERVICE_URL=http://payments-service.railway.internal:4002
METERING_SERVICE_URL=http://metering-service.railway.internal:4003
COMMS_SERVICE_URL=http://comms-service.railway.internal:4004
COMPLIANCE_SERVICE_URL=http://compliance-service.railway.internal:4005
```

The 5 backend services (everything except `gateway`) also each need
`DATABASE_URL` — same Supabase project ("xBilling"), same `app_service`
role, only the schema each one reads/writes differs:

```
DATABASE_URL=postgresql://app_service:<password>@db.unkkskpfvrejjfgrjyab.supabase.co:5432/postgres
```

Get the `app_service` password from whoever provisioned the project, or
rotate it via the Supabase SQL editor: `ALTER ROLE app_service WITH
PASSWORD '...';`. Do not use the project's `postgres` superuser here —
`app_service` is scoped to only the 5 schemas these services touch.

**billing-service**: `PORT=4001`, `CORS_ORIGIN=*`, `DATABASE_URL=...`

**payments-service**: `PORT=4002`, `CORS_ORIGIN=*`, `DATABASE_URL=...`,
`BILLING_SERVICE_URL=http://billing-service.railway.internal:4001`

**metering-service**: `PORT=4003`, `CORS_ORIGIN=*`, `DATABASE_URL=...`

**comms-service**: `PORT=4004`, `CORS_ORIGIN=*`, `DATABASE_URL=...`,
optionally `ANTHROPIC_API_KEY=<key>` to enable live AI insight/copy
generation instead of the canned fallback

**compliance-service**: `PORT=4005`, `CORS_ORIGIN=*`, `DATABASE_URL=...`

Do **not** generate public domains for the five backend services — only
`gateway` should be internet-reachable; the rest talk to each other over
Railway's private network, same boundary as `docker-compose.yml` locally.

Once `gateway` has a public domain, note its URL
(`https://gateway-production-xxxx.up.railway.app`) — the frontend needs it.

## Frontend — Vercel

Import this repo once at [vercel.com/new](https://vercel.com/new)
(Vercel auto-detects the pnpm workspace from `pnpm-workspace.yaml`, no
extra config needed):

| Vercel project | Root Directory        |
|------------------|-------------------------|
| web-platform      | `apps/web-platform`      |

Set the environment variable:
```
VITE_API_BASE_URL=https://<your-gateway-railway-domain>/api
```

Vite inlines env vars at build time, so this must be set **before** the
first deploy (or you'll need to redeploy after adding it).

Then go back to the gateway's `CORS_ORIGIN` on Railway and fill in the
real Vercel domain once you have it (`https://web-platform.vercel.app`) —
the gateway will reject requests from origins not in that list.

## Verifying the deploy

Once the gateway has a public domain and all 6 Railway services are up,
run the smoke test against it from your own machine (needs this repo
cloned, no other setup):

```
API_BASE_URL=https://<your-gateway-railway-domain>/api pnpm run smoke-test
```

This is read-only by default — it logs in as a seeded citizen and a seeded
operator and confirms every service answers correctly through the gateway
(platform status, ownership enforcement, staff-only routes rejected for a
citizen, all 5 backend domains reachable for an operator). It uses the
demo identities documented in the PR/README; override with
`SMOKE_CITIZEN_EMAIL` / `SMOKE_CITIZEN_PASSWORD` / `SMOKE_CITIZEN_ACCOUNT`
/ `SMOKE_OPERATOR_EMAIL` / `SMOKE_OPERATOR_PASSWORD` if this deployment's
Supabase project has different seed data. Add `--with-write` to also
exercise one real cross-service payment and confirm it settles — skip that
flag on a deploy you don't want to write test data into.

Exits non-zero with a list of exactly which checks failed, so it's safe to
wire into a post-deploy CI step later if you want one (this repo's own CI
is test-only today — see `.github/workflows/ci.yml`).
