# Deploying to GitHub Pages + Supabase

This platform is a single self-contained `index.html` (built with
`vite-plugin-singlefile`) that talks directly to Supabase — Postgres (RLS),
Auth, RPC functions, and two Edge Functions. There is no backend server to
deploy: GitHub Pages serves the static file, Supabase does everything else.

## One-time Supabase setup

The `db/*.sql` migrations and `supabase/functions/*` Edge Functions in this
repo are already applied to the project this was built against. Setting up
a **new** Supabase project from scratch needs, in order:

1. Create a project at [supabase.com](https://supabase.com).
2. Apply every file in `db/` in order (`001_schema.sql` through the highest
   numbered file) — via the SQL Editor, `psql`, or the Supabase CLI's
   `supabase db push`. Each one is idempotent-safe to re-run.
3. Deploy both Edge Functions: `supabase functions deploy ai-insight` and
   `supabase functions deploy campaign-send` (or via the dashboard).
4. **Dashboard-only steps — no API/CLI path exists for either of these:**
   - **Authentication → Hooks → Customize Access Token (Auth) Hook** →
     select `public.custom_access_token_hook`. Without this, every login
     succeeds but carries no `persona`/`accountNumber`/`municipalityId`
     claims, and the app treats that as "no platform role found."
   - **Authentication → Providers → Email → Password Requirements** → the
     "leaked password protection" toggle is recommended but not required.
5. Optional Edge Function secrets (`supabase secrets set KEY=value`) — every
   one of these degrades to a deterministic mock/fallback if unset, not a
   failure:
   - `ANTHROPIC_API_KEY` — live AI insight/SMS-draft copy instead of canned text.
   - `BULKSMS_TOKEN_ID` / `BULKSMS_TOKEN_SECRET` — live SMS dispatch instead of a mock queue.
   - `RESEND_API_KEY` / `RESEND_FROM` — live email dispatch instead of a mock queue.

Get the project URL and anon (publishable) key from **Project Settings →
API** — both are meant to be used client-side; Row Level Security is what
actually gates access, not secrecy of this key.

## Frontend — GitHub Pages

### Automatic (recommended)

`.github/workflows/pages.yml` builds and deploys on every push to `main`
that touches `apps/web-platform`, `packages/shared-types`, or
`packages/ui-kit`. Before the first run:

1. **Settings → Pages → Source** → set to **GitHub Actions**.
2. **Settings → Secrets and variables → Actions** → add two repository secrets:
   ```
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your anon/publishable key>
   ```
   Vite inlines these at build time — the workflow fails fast with a clear
   error if either is missing, rather than shipping a build that can't
   reach any Supabase project.
3. Push to `main`, or run the workflow manually (**Actions → Deploy to
   GitHub Pages → Run workflow**).

The deployed URL appears in the workflow run's summary and under
**Settings → Pages** once the first deploy completes.

### Manual build (any static host)

```
pnpm install
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co \
VITE_SUPABASE_ANON_KEY=<your anon key> \
pnpm --filter @xplatform/web-platform run build
```

Output is `apps/web-platform/dist/index.html` — one file, no other assets.
Upload it anywhere that serves static files (GitHub Pages, any object
storage bucket, or just open it from disk — hash-based routing means it
doesn't depend on the host understanding client-side routes).

## Verifying the deploy

Open the deployed URL and sign in with one of the seeded demo identities
(see `README.md`) — citizen, official, and operator personas each land on
a different area of the app. If login succeeds but nothing loads correctly
afterward, the Custom Access Token Hook (step 4 above) almost certainly
isn't enabled yet.

## Local development

Local dev talks to the same Supabase project — there's no local backend to
start. Copy `apps/web-platform/.env.example` to `.env` and fill in the two
`VITE_SUPABASE_*` values, then:

```
pnpm install
pnpm --filter @xplatform/web-platform run dev
```
