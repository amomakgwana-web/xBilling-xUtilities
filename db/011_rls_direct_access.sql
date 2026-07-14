-- Stage B of the Supabase-direct architecture migration: real per-row RLS
-- for the `authenticated` role, replacing the ownership/scoping logic that
-- used to live in Express middleware (forbidForeignAccount,
-- officialMunicipalityScope, forbidConsumers, forbidNonOperators).
--
-- Design: these policies cover READS only. Every write that needs
-- validation or computation (which is nearly everything — see Stage C)
-- goes through a Supabase Edge Function running as `service_role`, which
-- bypasses RLS entirely the same way `app_service` did for the old Express
-- services. No INSERT/UPDATE/DELETE policy is granted to `authenticated`
-- anywhere in this file — that's deliberate, not an oversight.
--
-- Like db/010, every Supabase-specific reference here (auth.jwt(),
-- `authenticated` role) is guarded to no-op on bare Postgres (CI, local
-- dev without the Supabase CLI stack).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'authenticated role not present — skipping RLS-for-direct-access setup (not a Supabase-provisioned Postgres)';
    return;
  end if;

  -- JWT claim helpers — thin wrappers so policies read like the ownership
  -- checks they replace, instead of repeating auth.jwt() ->> '...' everywhere.
  execute $sql$
    create or replace function public.jwt_persona() returns text
    language sql stable security invoker set search_path = pg_catalog, pg_temp
    as $f$ select nullif(auth.jwt() ->> 'persona', '') $f$;
  $sql$;
  execute $sql$
    create or replace function public.jwt_account_number() returns text
    language sql stable security invoker set search_path = pg_catalog, pg_temp
    as $f$ select nullif(auth.jwt() ->> 'accountNumber', '') $f$;
  $sql$;
  execute $sql$
    create or replace function public.jwt_municipality_id() returns text
    language sql stable security invoker set search_path = pg_catalog, pg_temp
    as $f$ select nullif(auth.jwt() ->> 'municipalityId', '') $f$;
  $sql$;
  execute 'grant execute on function public.jwt_persona() to authenticated';
  execute 'grant execute on function public.jwt_account_number() to authenticated';
  execute 'grant execute on function public.jwt_municipality_id() to authenticated';

  -- ===== platform =====

  execute $sql$
    create policy authenticated_read on platform.municipalities for select to authenticated
    using (true)
  $sql$;

  execute $sql$
    create policy operator_read on platform.api_keys for select to authenticated
    using (public.jwt_persona() = 'operator')
  $sql$;
  -- platform.users: no authenticated policy — contains legacy password
  -- hashes and other users' PII; only supabase_auth_admin (the hook) reads it.

  -- ===== billing =====

  execute $sql$
    create policy scoped_read on billing.accounts for select to authenticated
    using (
      public.jwt_persona() = 'operator'
      or account_number = public.jwt_account_number()
      or (public.jwt_persona() = 'official' and municipality = public.jwt_municipality_id())
    )
  $sql$;

  execute $sql$
    create policy authenticated_read on billing.tariffs for select to authenticated
    using (true)
  $sql$;

  execute $sql$
    create policy scoped_read on billing.invoices for select to authenticated
    using (
      public.jwt_persona() = 'operator'
      or account_number = public.jwt_account_number()
      or (public.jwt_persona() = 'official' and exists (
        select 1 from billing.accounts a
        where a.account_number = billing.invoices.account_number
          and a.municipality = public.jwt_municipality_id()
      ))
    )
  $sql$;

  execute $sql$
    create policy scoped_read on billing.invoice_lines for select to authenticated
    using (exists (
      select 1 from billing.invoices i
      where i.id = billing.invoice_lines.invoice_id
        and (
          public.jwt_persona() = 'operator'
          or i.account_number = public.jwt_account_number()
          or (public.jwt_persona() = 'official' and exists (
            select 1 from billing.accounts a
            where a.account_number = i.account_number
              and a.municipality = public.jwt_municipality_id()
          ))
        )
    ))
  $sql$;

  -- Own-account-only, no staff access at all — same design as the old
  -- banking.ts route: nobody on staff has an operational reason to see a
  -- citizen's bank account number.
  execute $sql$
    create policy own_only_read on billing.banking_details for select to authenticated
    using (exists (
      select 1 from billing.accounts a
      where a.id = billing.banking_details.account_id
        and a.account_number = public.jwt_account_number()
    ))
  $sql$;

  execute $sql$
    create policy scoped_read on billing.disputes for select to authenticated
    using (
      public.jwt_persona() = 'operator'
      or account_number = public.jwt_account_number()
      or (public.jwt_persona() = 'official' and exists (
        select 1 from billing.accounts a
        where a.account_number = billing.disputes.account_number
          and a.municipality = public.jwt_municipality_id()
      ))
    )
  $sql$;

  execute $sql$
    create policy scoped_read on billing.subsidy_applications for select to authenticated
    using (
      public.jwt_persona() = 'operator'
      or account_number = public.jwt_account_number()
      or (public.jwt_persona() = 'official' and exists (
        select 1 from billing.accounts a
        where a.account_number = billing.subsidy_applications.account_number
          and a.municipality = public.jwt_municipality_id()
      ))
    )
  $sql$;

  -- Staff-only — no citizen-facing billing-run view exists.
  execute $sql$
    create policy staff_scoped_read on billing.billing_runs for select to authenticated
    using (
      public.jwt_persona() = 'operator'
      or (public.jwt_persona() = 'official' and municipality = public.jwt_municipality_id())
    )
  $sql$;

  -- ===== payments =====

  -- Non-sensitive gateway/rail metadata — matches the old route's loose
  -- enforcement (no persona restriction beyond "not a consumer" was ever
  -- actually applied server-side to the read).
  execute $sql$
    create policy authenticated_read on payments.payment_methods for select to authenticated
    using (true)
  $sql$;

  -- Recon and DebiCheck only ever had an operator-facing view (xLayer
  -- Payments page) — scoped to operator, least privilege over what's
  -- actually used today.
  execute $sql$
    create policy operator_read on payments.transactions for select to authenticated
    using (public.jwt_persona() = 'operator')
  $sql$;

  execute $sql$
    create policy operator_read on payments.debicheck_mandates for select to authenticated
    using (public.jwt_persona() = 'operator')
  $sql$;

  execute $sql$
    create policy scoped_read on payments.payment_plans for select to authenticated
    using (
      public.jwt_persona() = 'operator'
      or account_number = public.jwt_account_number()
    )
  $sql$;

  -- ===== metering =====

  execute $sql$
    create policy scoped_read on metering.meters for select to authenticated
    using (
      public.jwt_persona() = 'operator'
      or account_number = public.jwt_account_number()
      or (public.jwt_persona() = 'official' and municipality = public.jwt_municipality_id())
    )
  $sql$;
  -- metering.readings: no authenticated policy — internal to the billing
  -- engine Edge Function only, never read directly by any frontend page.

  -- Staff-only — no citizen-facing fault-reporting page exists.
  execute $sql$
    create policy staff_scoped_read on metering.meter_faults for select to authenticated
    using (
      public.jwt_persona() = 'operator'
      or (public.jwt_persona() = 'official' and exists (
        select 1 from metering.meters m
        where m.id = metering.meter_faults.meter_id
          and m.municipality = public.jwt_municipality_id()
      ))
    )
  $sql$;

  execute $sql$
    create policy scoped_read on metering.vended_tokens for select to authenticated
    using (
      public.jwt_persona() = 'operator'
      or account_number = public.jwt_account_number()
      or (public.jwt_persona() = 'official' and exists (
        select 1 from billing.accounts a
        where a.account_number = metering.vended_tokens.account_number
          and a.municipality = public.jwt_municipality_id()
      ))
    )
  $sql$;

  -- ===== comms =====

  -- Campaigns are a staff-only feature (Arrears reminder blasts); citizens
  -- never read this table. 'All' is the sentinel operators use for a
  -- platform-wide blast.
  execute $sql$
    create policy staff_scoped_read on comms.campaigns for select to authenticated
    using (
      public.jwt_persona() = 'operator'
      or (public.jwt_persona() = 'official' and municipality in (public.jwt_municipality_id(), 'All'))
    )
  $sql$;
  -- comms.chat_sessions: no authenticated policy — internal to the
  -- chatbot/insight Edge Functions only.

  -- ===== compliance =====

  -- Staff-only across the board — matches the old services' forbidConsumers
  -- (citizens were never allowed into compliance-service at all).
  execute $sql$
    create policy staff_read on compliance.integrations for select to authenticated
    using (public.jwt_persona() in ('official', 'operator'))
  $sql$;

  execute $sql$
    create policy staff_read on compliance.score for select to authenticated
    using (public.jwt_persona() in ('official', 'operator'))
  $sql$;

  execute $sql$
    create policy staff_read on compliance.frameworks for select to authenticated
    using (public.jwt_persona() in ('official', 'operator'))
  $sql$;
  -- compliance.kyc_checks: no authenticated policy — no frontend page reads
  -- it directly today; internal to whichever flow triggers a KYC check.

  -- Audit trail viewer (xLayer, operator-only) is the only reader.
  execute $sql$
    create policy operator_read on compliance.audit_events for select to authenticated
    using (public.jwt_persona() = 'operator')
  $sql$;

  -- RLS restricts *rows*, but Postgres still requires the object-level
  -- privilege to touch the table/schema at all — without these grants every
  -- policy above is unreachable and every query 42501s before RLS is even
  -- evaluated. Deliberately excludes the 4 tables with no policy above
  -- (platform.users, metering.readings, comms.chat_sessions,
  -- compliance.kyc_checks) so they stay inaccessible to `authenticated` by
  -- default, not just policy-empty.
  execute 'grant usage on schema platform, billing, payments, metering, comms, compliance to authenticated';
  execute 'grant select on platform.municipalities, platform.api_keys to authenticated';
  execute $sql$
    grant select on billing.accounts, billing.tariffs, billing.invoices, billing.invoice_lines,
      billing.banking_details, billing.disputes, billing.subsidy_applications, billing.billing_runs
      to authenticated
  $sql$;
  execute $sql$
    grant select on payments.payment_methods, payments.transactions, payments.debicheck_mandates,
      payments.payment_plans to authenticated
  $sql$;
  execute 'grant select on metering.meters, metering.meter_faults, metering.vended_tokens to authenticated';
  execute 'grant select on comms.campaigns to authenticated';
  execute $sql$
    grant select on compliance.integrations, compliance.score, compliance.frameworks, compliance.audit_events
      to authenticated
  $sql$;
end $$;
