# Deploying to Railway (backend) + Vercel (frontends)

Neither platform has a connector this session can drive directly, so the
steps below are the dashboard clicks to do it yourself. Everything in this
repo is already set up so no extra config should be needed beyond what's
described here.

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
CORS_ORIGIN=https://<your-web-xlayer-domain>,https://<your-web-xbilling-domain>,https://<your-web-xutilities-domain>
BILLING_SERVICE_URL=http://billing-service.railway.internal:4001
PAYMENTS_SERVICE_URL=http://payments-service.railway.internal:4002
METERING_SERVICE_URL=http://metering-service.railway.internal:4003
COMMS_SERVICE_URL=http://comms-service.railway.internal:4004
COMPLIANCE_SERVICE_URL=http://compliance-service.railway.internal:4005
```

**billing-service**: `PORT=4001`, `CORS_ORIGIN=*`

**payments-service**: `PORT=4002`, `CORS_ORIGIN=*`,
`BILLING_SERVICE_URL=http://billing-service.railway.internal:4001`

**metering-service**: `PORT=4003`, `CORS_ORIGIN=*`

**comms-service**: `PORT=4004`, `CORS_ORIGIN=*`, optionally
`ANTHROPIC_API_KEY=<key>` to enable live AI insight/copy generation instead
of the canned fallback

**compliance-service**: `PORT=4005`, `CORS_ORIGIN=*`

Do **not** generate public domains for the five backend services — only
`gateway` should be internet-reachable; the rest talk to each other over
Railway's private network, same boundary as `docker-compose.yml` locally.

Once `gateway` has a public domain, note its URL
(`https://gateway-production-xxxx.up.railway.app`) — the frontends need it.

## Frontends — Vercel

Import this repo three times at [vercel.com/new](https://vercel.com/new)
(Vercel auto-detects the pnpm workspace from `pnpm-workspace.yaml`, no
extra config needed):

| Vercel project | Root Directory        |
|------------------|-------------------------|
| web-xlayer        | `apps/web-xlayer`        |
| web-xbilling      | `apps/web-xbilling`      |
| web-xutilities    | `apps/web-xutilities`    |

For each, set the environment variable:
```
VITE_API_BASE_URL=https://<your-gateway-railway-domain>/api
```

Vite inlines env vars at build time, so this must be set **before** the
first deploy of each project (or you'll need to redeploy after adding it).

Then go back to the gateway's `CORS_ORIGIN` on Railway and fill in the
three real Vercel domains once you have them (`https://web-xlayer.vercel.app`,
etc.) — the gateway will reject requests from origins not in that list.
