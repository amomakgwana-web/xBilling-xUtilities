# xBilling / xUtilities Platform

A platform for South African municipal utility billing — consumer billing
(xBilling), utilities operations (xUtilities), and a platform console
(xLayer) sitting across billing, payments, metering and communications —
delivered as **one unified web platform**: a single console with one
sign-in, where each persona (citizen, municipal official, platform
operator) sees the product areas they're entitled to.

## Architecture

A single self-contained `index.html` (Vite + `vite-plugin-singlefile`)
talking directly to [Supabase](https://supabase.com) — there is no backend
server. Everything a backend would normally do lives in Postgres:

```
apps/
  web-platform/       Unified console — one sign-in, three role-gated product areas:
                        xLayer     (operator)            command centre, payments ops, campaigns, integrations
                        xBilling   (citizen + operator)   dashboard, invoices, pay now
                        xUtilities (official + operator)  meters, token vending, faults

packages/
  shared-types/       Zod schemas + TS types shared by the frontend and the SQL comments that mirror them
  ui-kit/             Shared design tokens, icons and React primitives —
                       the dark command-centre look used across the console

db/                   Every schema migration, in order — table DDL, RLS
                       policies, RPC functions, and public.* read views.
                       Replays cleanly on both the real Supabase project
                       and a bare local Postgres (CI uses the latter).

supabase/functions/    The two pieces of business logic that need real
                        outbound HTTP (Anthropic, BulkSMS, Resend) and so
                        can't be a Postgres function:
  ai-insight/            Platform KPI briefing + SMS copy drafting
  campaign-send/         Bulk SMS/email campaign dispatch
```

- **Reads** go straight to Postgres through `public.*` views
  (`db/014_public_views.sql`) — thin camelCase-mapped passthroughs over the
  real tables in `billing`/`payments`/`metering`/`comms`/`compliance`/
  `platform` schemas, gated by [Row Level Security](#security-model).
- **Writes** go through `SECURITY DEFINER` Postgres functions
  (`db/012_business_logic_functions.sql`), called via `supabase.rpc(...)`.
  Each one re-checks ownership/scoping itself (the same rules a backend
  middleware layer would enforce) and appends to a hash-chained audit log.
- **Auth** is Supabase Auth. A Postgres function
  (`public.custom_access_token_hook`, `db/010`/`db/013`) injects
  `persona`/`accountNumber`/`municipalityId` claims into every JWT it
  issues — the frontend reads those claims client-side to decide what to
  show; RLS and the RPC functions are what actually enforce them.

## Security model

Every table `authenticated` can read at all is exposed read-only — no
`INSERT`/`UPDATE`/`DELETE` grant exists on any of them for that role, only
`SELECT`. All mutation happens through the RPC functions in `db/012`,
which run as the table owner (bypassing RLS the same way a backend's own
database role always would) and apply the real authorization logic:

- A citizen can only touch their own account (`accountNumber` from their
  JWT claim must match).
- An official is scoped to their own municipality.
- An operator reaches everything.
- Staff-only actions (billing runs, fault dispatch, tariff changes, API
  key management, KYC checks, audit verification) reject a citizen JWT
  outright.

`public.*` views default to Postgres's pre-PG15 view semantics
(permissions and RLS checked as the *view owner*, not the caller) unless
created `WITH (security_invoker = true)` — every view in `db/014` sets
this explicitly; without it, RLS would silently not apply to any read
through a view at all. `billing.banking_details` never exposes the raw
bank account number through any path, view or RPC — only a last-4-masked
column, even to the account owner who supplied it.

## Business logic

Billing is computed, not seeded: `public.run_billing_period()` pulls
per-meter consumption directly from `metering.readings` (the delta of the
two most recent readings — a cross-schema join, now that everything is one
database), prices it against the account's tariff in `billing.tariffs`
(SA-style rates: R/kWh, R/kl, fixed refuse/sewer charges, effective-dated
so a rate change never rewrites what a past invoice was billed at), adds
15% VAT, and writes invoice + lines + balance atomically per account.
Re-running a period never double-bills. Prepaid electricity is excluded
from statements (paid at vend time via `public.vend_token()`).
Reconciliation has a real matching pass too: `public.run_recon()` applies
each suspense transaction to its account's oldest open invoice.

Every KYC verification is persisted to `compliance.kyc_checks` (POPIA
requires the record to exist), and every mutating RPC call appends to a
tamper-evident, hash-chained audit log (`compliance.audit_events`) —
`public.verify_audit_chain()` recomputes the whole chain and reports
exactly where it breaks if any row was altered after the fact.

The SQL for all of this lives in `db/0*.sql`, applied in order — the real
Supabase project and CI's throwaway Postgres run the identical files (the
few genuinely Supabase-specific statements — the Auth Hook, RLS role
grants — are guarded to no-op cleanly on bare Postgres).

## What's mocked vs real

Every third-party integration named in the original product mockups
(SwiftPay, Capitec Pay, WhatsApp Pay, Samsung Pay, HANIS, SARS, TransUnion,
Deeds Registry, Conlog) is implemented as a **mock adapter directly in SQL**
inside the RPC functions that use them: realistic simulated latency
characteristics and response shapes, no real credentials or network calls
(Postgres can't make outbound HTTP calls in the first place, which is
exactly why none of these ever needed to be Edge Functions).

Two things go **live** the moment credentials are set as Edge Function
secrets (`supabase secrets set KEY=value`), with a deterministic mock/
fallback otherwise:
- **AI Insight / SMS drafting** (`ai-insight` function) — set
  `ANTHROPIC_API_KEY` for live Claude analysis.
- **SMS / Email dispatch** (`campaign-send` function) — set
  `BULKSMS_TOKEN_ID` + `BULKSMS_TOKEN_SECRET` for live SMS via BulkSMS, and/or
  `RESEND_API_KEY` (+ optional `RESEND_FROM`) for live email via Resend.

## Auth

Sign-in is Supabase Auth (`supabase.auth.signInWithPassword`) — no custom
password verification or token signing happens anywhere in this repo.
Citizens are bound to their own billing account via the `accountNumber`
JWT claim; RLS and every RPC function enforce that server-side regardless
of what the client sends.

Demo identities (seeded by `db/004_seed_real.sql`, linked to Supabase Auth
by `db/010`): `operator@xplatform.co.za` / `Operator!2026`,
`official@ekurhuleni.gov.za` / `Official!2026`, and five citizens (e.g.
`thandi.cele@example.co.za`) all with `Citizen!2026`.

## Running locally

No backend to start — local dev talks to the same Supabase project
production does.

```bash
pnpm install
cp apps/web-platform/.env.example apps/web-platform/.env   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
pnpm --filter @xplatform/web-platform run dev
```

## Deploying

See [`DEPLOY.md`](./DEPLOY.md) — one-time Supabase project setup (apply
`db/*.sql`, deploy the two Edge Functions, flip the two dashboard-only
toggles) plus the GitHub Pages workflow that builds and deploys the
single-file bundle on every push to `main`.

## Tests & CI

`.github/workflows/ci.yml` replays every `db/*.sql` migration against a
throwaway Postgres 16 on every PR — the same check this repo's own
development relies on before anything gets applied to the real Supabase
project — and builds the frontend workspace (`tsc -b` + the single-file
Vite build) to catch typecheck and bundling regressions.

## Known limitations / manual steps

- **Custom Access Token Hook** and **Edge Function secrets** are dashboard/
  CLI-only steps with no fully-scriptable path from a fresh `db/*.sql`
  apply — see `DEPLOY.md` for exactly what to click.
- End-to-end browser verification of this migration (Stages A–F: Auth →
  RLS → RPC functions/Edge Functions → frontend rewrite → single-file
  build → cleanup) was done at the SQL/RPC layer against the real Supabase
  project (every function exercised with simulated citizen/official/
  operator JWTs) and via `tsc -b`/`vite build` for the frontend, but not
  via a live browser session — the sandbox this was built in cannot reach
  the Supabase project over the network directly. Worth a manual pass
  through all three personas after the two dashboard steps above are done.
