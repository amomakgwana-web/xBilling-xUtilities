-- Stage D prerequisite: PostgREST (what supabase-js's .from() talks to)
-- only serves the `public` schema by default — exposing another schema via
-- the API needs a dashboard/project-config change with no confirmed SQL
-- path, the same class of manual step as db/010's Auth Hook. Rather than
-- add another one, this takes the same approach db/012 already took for
-- RPC functions: everything reachable from the browser lives in `public`,
-- even though the real tables stay in their domain schema.
--
-- Each view is a straight column-mapped passthrough (snake_case -> the
-- camelCase the frontend's @xplatform/shared-types already expects) over
-- the exact set of tables db/011 granted `authenticated` SELECT on — same
-- list, same RLS. Views don't have their own row-security: a query against
-- `public.accounts` still evaluates billing.accounts' policies for
-- whatever role/JWT is asking, because auth.jwt()/auth.uid() read the
-- session's claims, not the view's owner. Confirmed no name collisions
-- with any db/012 RPC function (functions and relations share a
-- namespace, but are disambiguated by the () call syntax).
--
-- billing.banking_details is the one exception to "straight passthrough":
-- the raw bank account number is deliberately never selected here, only a
-- last-4-masked column — the same masking the old Express route applied in
-- application code (repository.ts maskAccountNumber), now enforced at the
-- one place a client can actually read this table from.

create or replace view public.municipalities with (security_invoker = true) as
select id, name, province, brand_color as "brandColor", logo_url as "logoUrl",
  contact_email as "contactEmail", contact_phone as "contactPhone", created_at as "createdAt"
from platform.municipalities;

create or replace view public.api_keys with (security_invoker = true) as
select id, name, key_prefix as "keyPrefix", created_by as "createdBy", created_at as "createdAt", revoked_at as "revokedAt"
from platform.api_keys;

create or replace view public.accounts with (security_invoker = true) as
select id, account_number as "accountNumber", consumer_name as "consumerName", municipality, erf_number as "erfNumber",
  balance, status, tariff_code as "tariffCode", email, phone, created_at as "createdAt"
from billing.accounts;

create or replace view public.tariffs with (security_invoker = true) as
select id, code, description, electricity_per_kwh as "electricityPerKwh", water_per_kl as "waterPerKl",
  refuse_monthly as "refuseMonthly", sewer_monthly as "sewerMonthly", vat_rate as "vatRate",
  valid_from as "validFrom", valid_to as "validTo"
from billing.tariffs;

create or replace view public.invoices with (security_invoker = true) as
select id, account_id as "accountId", account_number as "accountNumber", billing_period as "billingPeriod",
  issue_date as "issueDate", due_date as "dueDate", total_amount as "totalAmount", amount_paid as "amountPaid", status
from billing.invoices;

create or replace view public.invoice_lines with (security_invoker = true) as
select id, invoice_id as "invoiceId", description, category, quantity, unit_price as "unitPrice", amount
from billing.invoice_lines;

create or replace view public.banking_details with (security_invoker = true) as
select
  a.account_number as "accountNumber",
  bd.bank_name as "bankName",
  bd.account_holder as "accountHolder",
  ('••••' || right(bd.account_number, 4)) as "maskedAccountNumber",
  bd.branch_code as "branchCode",
  bd.account_type as "accountType",
  bd.debit_day as "debitDay",
  bd.updated_at as "updatedAt"
from billing.banking_details bd
join billing.accounts a on a.id = bd.account_id;

create or replace view public.disputes with (security_invoker = true) as
select id, account_number as "accountNumber", invoice_id as "invoiceId", reason, description, status,
  resolution_note as "resolutionNote", created_at as "createdAt", resolved_at as "resolvedAt"
from billing.disputes;

create or replace view public.subsidy_applications with (security_invoker = true) as
select id, account_number as "accountNumber", household_income as "householdIncome", household_size as "householdSize",
  subsidy_percent as "subsidyPercent", status, applied_at as "appliedAt"
from billing.subsidy_applications;

create or replace view public.billing_runs with (security_invoker = true) as
select id, municipality, billing_period as "billingPeriod", started_at as "startedAt", completed_at as "completedAt",
  accounts_processed as "accountsProcessed", total_billed as "totalBilled", status
from billing.billing_runs;

create or replace view public.payment_methods with (security_invoker = true) as
select id, label, provider, status, tx_day as "txDay", rev_day as "revDay"
from payments.payment_methods;

create or replace view public.transactions with (security_invoker = true) as
select ref, account_number as "accountNumber", consumer_name as "consumerName", amount, gateway, method, status,
  erp_status as "erpStatus", created_at as "createdAt"
from payments.transactions;

create or replace view public.debicheck_mandates with (security_invoker = true) as
select id, account_number as "accountNumber", consumer_name as "consumerName", amount, collection_day as "collectionDay", status
from payments.debicheck_mandates;

create or replace view public.payment_plans with (security_invoker = true) as
select id, account_number as "accountNumber", consumer_name as "consumerName", total_amount as "totalAmount",
  installments, installment_amount as "installmentAmount", start_date as "startDate", status, created_at as "createdAt"
from payments.payment_plans;

create or replace view public.meters with (security_invoker = true) as
select id, serial, account_number as "accountNumber", municipality, type, last_reading as "lastReading",
  last_reading_at as "lastReadingAt", status
from metering.meters;

create or replace view public.meter_faults with (security_invoker = true) as
select id, meter_id as "meterId", serial, description, severity, status, reported_at as "reportedAt"
from metering.meter_faults;

create or replace view public.vended_tokens with (security_invoker = true) as
select id, serial, account_number as "accountNumber", amount, units, token, vended_at as "vendedAt"
from metering.vended_tokens;

create or replace view public.campaigns with (security_invoker = true) as
select id, name, type, status, sent, opened, clicked, paid, unpaid, created_at as "createdAt", municipality
from comms.campaigns;

create or replace view public.integrations with (security_invoker = true) as
select id, name, category, status, endpoint, description
from compliance.integrations;

create or replace view public.compliance_score with (security_invoker = true) as
select id, score
from compliance.score;

create or replace view public.frameworks with (security_invoker = true) as
select id, name, status, last_audited_at as "lastAuditedAt"
from compliance.frameworks;

create or replace view public.audit_events with (security_invoker = true) as
select id, actor, actor_name as "actorName", role, action, target, prev_hash as "prevHash", hash, created_at as "createdAt"
from compliance.audit_events;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'authenticated role not present — skipping view grants (not a Supabase-provisioned Postgres)';
    return;
  end if;

  execute $sql$
    grant select on
      public.municipalities, public.api_keys,
      public.accounts, public.tariffs, public.invoices, public.invoice_lines, public.banking_details,
      public.disputes, public.subsidy_applications, public.billing_runs,
      public.payment_methods, public.transactions, public.debicheck_mandates, public.payment_plans,
      public.meters, public.meter_faults, public.vended_tokens,
      public.campaigns,
      public.integrations, public.compliance_score, public.frameworks, public.audit_events
    to authenticated
  $sql$;
end $$;
