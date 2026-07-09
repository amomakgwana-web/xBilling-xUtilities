# Deploying this platform

Two documented paths, depending on what you're hosting on:

- **Railway (backend) + Vercel (frontends)** — the 6 backend services stay
  separate, matching how they run locally. Needs both platforms to support
  long-running Node processes, which Railway does and Vercel's serverless
  frontends don't need to.
- **Afrihost shared hosting (cPanel) + GitHub** — for hosts where you can't
  run 6 separate long-lived Node processes. Everything backend-side is
  consolidated into **one process** (`services/cpanel-server`) that mounts
  all 5 domains' routers directly — same routes, same Postgres schemas, same
  business logic, just one deployable file instead of six.

No connector in this session can drive either Railway, Vercel, or a cPanel
account directly, so both sections below are the manual steps to do it
yourself.

## Option A — Railway (backend) + Vercel (frontends)

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

## Option B — Afrihost shared hosting (cPanel) + GitHub

### Why this differs from Option A

Shared cPanel hosting typically can't run 6 separate long-lived Node
processes, has no Docker, and has no Postgres. `services/cpanel-server`
solves the first two by mounting all 5 domains' existing routers (billing,
payments, metering, comms, compliance) into **one Express process** —
same routes, same business logic, same Postgres schemas, just one thing to
deploy. The database stays on Supabase either way (Afrihost's actual server
has normal outbound internet access, unlike some sandboxed CI/dev
environments, so it reaches Supabase over the public internet with no
special networking needed).

### Backend — one bundled file, zero npm install on the host

cPanel's Node.js Selector runs its own `npm install` inside whatever
"Application Root" you point it at — it has no concept of a pnpm monorepo.
So instead of uploading the repo, build a single self-contained file and
upload just that:

```bash
pnpm install
pnpm --filter @xplatform/billing-service --filter @xplatform/payments-service \
  --filter @xplatform/metering-service --filter @xplatform/comms-service \
  --filter @xplatform/compliance-service --filter @xplatform/shared-types run build
pnpm --filter @xplatform/cpanel-server run bundle
```

This produces `services/cpanel-server/dist-bundle/server.mjs` — every
dependency (workspace packages and npm packages alike) is inlined via
esbuild, since none of them use native addons. The only thing the host needs
is a Node.js runtime; there's no `node_modules` to install at all. Verified
locally in this session: copied just `server.mjs` + a `.env` into an empty
directory with zero `node_modules` and it ran correctly, including a real
cross-service payment settling through to a persisted invoice update.

**On Afrihost:**
1. cPanel → **Setup Node.js App** → create a new application
   - Node.js version: 20 or later
   - Application mode: Production
   - Application root: e.g. `xbilling-api` (any folder name)
   - Application startup file: `server.mjs`
2. Upload `server.mjs` into that application root (via the File Manager or
   `scp`/`rsync` over SSH) — nothing else needs to go there
3. In the same "Setup Node.js App" screen, add environment variables (or
   create a `.env` file alongside `server.mjs` — either works, since
   `env.ts` calls `process.loadEnvFile()`):
```
PORT=<cPanel assigns this automatically — check what it filled in>
CORS_ORIGIN=https://<your-frontend-domain>
JWT_SECRET=<generate a real secret>
DATABASE_URL=postgresql://app_service:<password>@db.unkkskpfvrejjfgrjyab.supabase.co:5432/postgres
```
   (`ANTHROPIC_API_KEY` optional, same as the Railway path — see comms-service)
4. Click "Start App" / restart. cPanel's Passenger process manager keeps it
   running and restarts it if it crashes — no separate process manager
   (pm2, systemd) needed.
5. Note the URL cPanel gives this app (either a subdomain, or a path proxied
   through your main domain, depending on how you configured it) — the
   frontends need it as their API base URL.

If your plan's Node.js Selector doesn't allow re-running `npm install`
after upload, that's fine — the bundle has no dependencies to install; just
point the startup file at `server.mjs` and start it.

### Frontends — static upload, no Node needed

The 3 frontends are plain static sites once built — no different from any
other static site on shared hosting:

```bash
pnpm --filter @xplatform/shared-types --filter @xplatform/ui-kit run build
VITE_API_BASE_URL=https://<your-cpanel-server-domain>/api pnpm --filter @xplatform/web-xlayer run build
VITE_API_BASE_URL=https://<your-cpanel-server-domain>/api pnpm --filter @xplatform/web-xbilling run build
VITE_API_BASE_URL=https://<your-cpanel-server-domain>/api pnpm --filter @xplatform/web-xutilities run build
```

Each produces a `dist/` folder (`index.html` + `assets/`). Upload each one
to wherever you want it served from — e.g. `public_html/` for your main
domain, or a subdomain's document root for each (`app.yourdomain.co.za`,
`admin.yourdomain.co.za`, etc.) via cPanel's File Manager or:

```bash
rsync -avz apps/web-xlayer/dist/ user@yourserver:~/public_html/app/
rsync -avz apps/web-xbilling/dist/ user@yourserver:~/public_html/billing/
rsync -avz apps/web-xutilities/dist/ user@yourserver:~/public_html/utilities/
```

Since these are client-side-routed single-page apps (`react-router-dom`),
add a rewrite rule so deep links (e.g. refreshing on `/invoices`) don't
404 — a `.htaccess` in each frontend's upload directory:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

Once the backend has a real domain, go back and rebuild the 3 frontends
with the correct `VITE_API_BASE_URL` (Vite bakes it in at build time, so
this can't be changed after the fact without rebuilding), and update the
backend's `CORS_ORIGIN` to list the real frontend domain(s).
