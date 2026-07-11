-- Phase 1 hardening, from the architecture review.
--
-- 1. RLS was disabled on all 19 tables — Supabase's advisor flags this
--    critical because the anon/authenticated PostgREST roles could read or
--    write every row if anything ever called supabase-js from a browser.
--    Nothing in this codebase does that today (every access goes through
--    Drizzle via the backend-only app_service role), but this closes the
--    gap structurally instead of relying on that staying true. Each table
--    gets RLS enabled plus one policy granting app_service unrestricted
--    access — no policy exists for anon/authenticated, so they default to
--    denied. app_service is not the table owner, so RLS applies to it too;
--    without this policy every backend service would break outright.
-- 2. Three foreign-key columns had no index — Postgres indexes the
--    referenced side of a FK automatically, never the referencing side.
-- 3. A Supabase-managed event-trigger helper (public.rls_auto_enable, not
--    created by this codebase) was left executable by anon/authenticated —
--    via an implicit PUBLIC grant, which every role inherits regardless of
--    what's revoked from anon/authenticated specifically; the fix has to
--    target PUBLIC directly. It only does anything useful inside an actual
--    DDL event trigger, so direct RPC invocation is a no-op — but there's
--    no reason to leave it publicly callable.

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('billing','accounts'), ('billing','invoices'), ('billing','invoice_lines'),
      ('billing','billing_runs'), ('billing','tariffs'),
      ('payments','payment_methods'), ('payments','transactions'), ('payments','debicheck_mandates'),
      ('metering','meters'), ('metering','meter_faults'), ('metering','readings'),
      ('comms','campaigns'), ('comms','chat_sessions'),
      ('compliance','integrations'), ('compliance','score'), ('compliance','frameworks'),
      ('compliance','kyc_checks'), ('compliance','audit_events'),
      ('platform','users')
    ) as s(schema_name, table_name)
  loop
    execute format('alter table %I.%I enable row level security', t.schema_name, t.table_name);
    execute format(
      'create policy app_service_full_access on %I.%I for all to app_service using (true) with check (true)',
      t.schema_name, t.table_name
    );
  end loop;
end $$;

create index if not exists invoices_account_id_idx on billing.invoices (account_id);
create index if not exists invoice_lines_invoice_id_idx on billing.invoice_lines (invoice_id);
create index if not exists meter_faults_meter_id_idx on metering.meter_faults (meter_id);

-- Supabase-managed helper, not present on a plain Postgres instance (CI,
-- local dev) — only revoke its public grant where it actually exists.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public;
  end if;
end $$;
