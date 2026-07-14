-- Stage C of the Supabase-direct architecture migration: the business logic
-- that used to live in the 6 Express services' routes/repositories, ported
-- to Postgres functions callable via supabase.rpc() (PostgREST exposes the
-- `public` schema by default — every function below lives there, even
-- though the tables it touches stay in their domain schema, so nothing
-- extra needs enabling in the Supabase dashboard the way the Auth Hook did).
--
-- Every function is SECURITY DEFINER: it runs as the migration owner, the
-- same way `app_service` used to bypass RLS for the old Express services.
-- RLS from db/011 only ever covered reads — every write still goes through
-- one of these, which is what makes it safe to grant `authenticated` direct
-- SELECT on the tables without also granting INSERT/UPDATE/DELETE.
--
-- Authorization that used to live in Express middleware (forbidForeignAccount,
-- forbidConsumers, officialMunicipalityScope, forbidNonOperators) is
-- re-checked at the top of every function using the same jwt_persona() /
-- jwt_account_number() / jwt_municipality_id() helpers db/011 introduced for
-- RLS policies — one set of claim readers, two consumers (row filters here,
-- explicit checks there).
--
-- Unlike db/010 and db/011, nothing here needs guarding for bare Postgres:
-- PL/pgSQL function bodies are opaque strings that Postgres does not resolve
-- against the catalog until first call, so `auth.jwt()`/`auth.uid()` calls
-- inside them are safe to create unconditionally (CI's bare ephemeral
-- Postgres never calls any of these, so they simply sit unused). Only a
-- SQL-language function body would be checked at CREATE time — everything
-- below is plpgsql specifically to keep that property.
--
-- Every function that used to trigger the gateway's automatic
-- "audit every mutating request" behaviour (services/gateway/src/index.ts,
-- auditMutation()) now calls public._append_audit_event() itself at the end
-- of a successful write, extending the same hash chain compliance-service
-- used to own — see db/002/009 for the rows already in that chain.

create extension if not exists pgcrypto;

-- ============================================================================
-- Internal helpers (leading underscore = not exposed to `authenticated`,
-- only ever called from inside another SECURITY DEFINER function in this
-- file, which executes as the owner and so always retains EXECUTE
-- regardless of what's revoked from PUBLIC below).
-- ============================================================================

-- Next `<prefix>-<n>` id derived from the highest numeric suffix already
-- stored in `<schema>.<table>.<id_column>` — the fixed, max-based pattern
-- Phase 4 already established in TS (repository.ts nextSequentialId /
-- nextVendId / nextPlanId), ported so a cold-start Edge Function / RPC call
-- can never collide with rows a previous invocation already wrote the way an
-- in-memory counter seeded at 100 on every process start would.
create or replace function public._next_seq(p_schema text, p_table text, p_id_column text default 'id')
returns integer
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_max integer;
begin
  execute format(
    'select max(cast(substring(%I from ''[0-9]+$'') as integer)) from %I.%I',
    p_id_column, p_schema, p_table
  ) into v_max;
  return coalesce(v_max, 99) + 1;
end;
$$;
revoke execute on function public._next_seq(text, text, text) from public;

-- The tariff row for `p_code` that was actually in force on `p_on_date` —
-- direct port of billing-service/src/repository.ts getTariff().
create or replace function public._tariff_in_force(p_code text, p_on_date date)
returns billing.tariffs
language sql
stable
security definer
set search_path = billing, pg_catalog, pg_temp
as $$
  select * from billing.tariffs
  where code = p_code
    and valid_from <= p_on_date
    and (valid_to is null or valid_to >= p_on_date)
  order by valid_from desc
  limit 1;
$$;
revoke execute on function public._tariff_in_force(text, date) from public;

-- billing.accounts.balance adjustment + status flip — direct port of
-- billing-service/src/repository.ts adjustAccountBalance().
create or replace function public._adjust_account_balance(p_account_number text, p_delta numeric)
returns void
language plpgsql
security definer
set search_path = billing, pg_catalog, pg_temp
as $$
declare
  v_balance numeric;
begin
  select greatest(0, balance - p_delta) into v_balance from billing.accounts where account_number = p_account_number;
  if v_balance is null then return; end if;
  update billing.accounts
  set balance = v_balance, status = case when v_balance = 0 then 'paid' else 'pending' end
  where account_number = p_account_number;
end;
$$;
revoke execute on function public._adjust_account_balance(text, numeric) from public;

-- Direct port of billing-service/src/repository.ts applyPaymentToInvoice().
create or replace function public._apply_payment_to_invoice(p_invoice_id text, p_amount numeric)
returns billing.invoices
language plpgsql
security definer
set search_path = billing, pg_catalog, pg_temp
as $$
declare
  v_invoice billing.invoices;
  v_amount_paid numeric;
  v_status text;
begin
  select * into v_invoice from billing.invoices where id = p_invoice_id;
  if v_invoice.id is null then return null; end if;

  v_amount_paid := least(v_invoice.total_amount, v_invoice.amount_paid + p_amount);
  v_status := case when v_amount_paid >= v_invoice.total_amount then 'paid' else 'pending' end;
  update billing.invoices set amount_paid = v_amount_paid, status = v_status where id = p_invoice_id;
  perform public._adjust_account_balance(v_invoice.account_number, p_amount);

  select * into v_invoice from billing.invoices where id = p_invoice_id;
  return v_invoice;
end;
$$;
revoke execute on function public._apply_payment_to_invoice(text, numeric) from public;

-- Direct port of payments-service/src/billingClient.ts
-- applyPaymentToOldestInvoice() — the two services no longer talk over HTTP,
-- so this can join straight to billing.invoices instead of round-tripping
-- through billing-service's API. "Oldest" is now actually enforced by
-- issue_date (the old HTTP version took whatever order the API happened to
-- return, despite the name) — same intent, more literally correct.
create or replace function public._apply_payment_to_oldest_invoice(p_account_number text, p_amount numeric)
returns boolean
language plpgsql
security definer
set search_path = billing, pg_catalog, pg_temp
as $$
declare
  v_target_id text;
begin
  select id into v_target_id
  from billing.invoices
  where account_number = p_account_number and status <> 'paid'
  order by issue_date asc, id asc
  limit 1;
  if v_target_id is null then return false; end if;

  perform public._apply_payment_to_invoice(v_target_id, p_amount);
  return true;
end;
$$;
revoke execute on function public._apply_payment_to_oldest_invoice(text, numeric) from public;

-- Appends one row to the hash-chained audit log — direct port of
-- compliance-service/src/audit.ts appendAuditEvent(), continuing the exact
-- same chain (SHA-256 of prevHash|actor|role|action|target|createdAtISO)
-- rows already written by the old Express gateway carry. An advisory lock
-- serialises concurrent appends within the calling transaction so two
-- simultaneous writers can't read the same prevHash — tighter than the old
-- code's plain `db.transaction()`, which had the same race under
-- READ COMMITTED.
create or replace function public._append_audit_event(p_action text, p_target text default null)
returns compliance.audit_events
language plpgsql
security definer
set search_path = compliance, platform, extensions, public, pg_catalog, pg_temp
as $$
declare
  v_actor text;
  v_actor_name text;
  v_role text;
  v_prev_hash text;
  v_created_at timestamptz := clock_timestamp();
  v_created_at_iso text;
  v_hash text;
  v_row compliance.audit_events;
begin
  perform pg_advisory_xact_lock(hashtext('compliance.audit_events'));

  v_actor := coalesce(auth.uid()::text, 'anonymous');
  v_role := nullif(auth.jwt() ->> 'role', '');
  select name into v_actor_name from platform.users where auth_user_id = auth.uid();

  select hash into v_prev_hash from compliance.audit_events order by id desc limit 1;
  v_prev_hash := coalesce(v_prev_hash, repeat('0', 64));

  v_created_at_iso := to_char(v_created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_hash := encode(
    digest(v_prev_hash || '|' || v_actor || '|' || coalesce(v_role, '') || '|' || p_action || '|' || coalesce(p_target, '') || '|' || v_created_at_iso, 'sha256'),
    'hex'
  );

  insert into compliance.audit_events (actor, actor_name, role, action, target, prev_hash, hash, created_at)
  values (v_actor, v_actor_name, v_role, p_action, p_target, v_prev_hash, v_hash, v_created_at)
  returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public._append_audit_event(text, text) from public;

-- ============================================================================
-- billing
-- ============================================================================

-- Direct port of billing-service/src/routes/billingRuns.ts POST / — the real
-- billing engine. Now reads consumption from metering.readings directly
-- (a cross-schema join, since everything is one Postgres database) instead
-- of an HTTP call to a metering-service that no longer exists.
create or replace function public.run_billing_period(p_municipality text, p_billing_period text default null)
returns billing.billing_runs
language plpgsql
security definer
set search_path = billing, metering, pg_catalog, pg_temp
as $$
declare
  v_persona text := public.jwt_persona();
  v_period text := coalesce(p_billing_period, to_char(now(), 'YYYY-MM'));
  v_seq integer;
  v_run_id text;
  v_run billing.billing_runs;
  v_issue_date date := current_date;
  v_due_date date := current_date + 1;
  v_account record;
  v_tariff billing.tariffs;
  v_meter record;
  v_consumption numeric;
  v_lines jsonb;
  v_subtotal numeric;
  v_vat numeric;
  v_total numeric;
  v_accounts_processed integer := 0;
  v_total_billed numeric := 0;
  v_invoice_id text;
begin
  if v_persona = 'citizen' then
    raise exception 'This operation is restricted to municipal staff' using errcode = '42501';
  end if;
  if v_persona = 'official' and public.jwt_municipality_id() <> p_municipality then
    raise exception 'This municipality is outside your scope' using errcode = '42501';
  end if;

  select coalesce(max(cast(substring(id from '-([0-9]+)-[A-Za-z]+$') as integer)), 99) + 1 into v_seq
  from billing.billing_runs;
  v_run_id := 'BJ-' || v_period || '-' || lpad(v_seq::text, 3, '0') || '-' || upper(left(p_municipality, 3));

  insert into billing.billing_runs (id, municipality, billing_period, started_at, accounts_processed, total_billed, status)
  values (v_run_id, p_municipality, v_period, now(), 0, 0, 'running')
  returning * into v_run;

  begin
    for v_account in select * from billing.accounts where municipality = p_municipality loop
      if exists (select 1 from billing.invoices where account_number = v_account.account_number and billing_period = v_period) then
        continue;
      end if;

      v_tariff := public._tariff_in_force(v_account.tariff_code, v_issue_date);
      if v_tariff.id is null then continue; end if;

      v_lines := '[]'::jsonb;

      for v_meter in select * from metering.meters where account_number = v_account.account_number loop
        select case when latest.reading is not null and previous.reading is not null
                 then greatest(0, latest.reading - previous.reading)
                 else 0
               end
        into v_consumption
        from (select reading from metering.readings where serial = v_meter.serial order by id desc limit 1) latest,
             (select reading from metering.readings where serial = v_meter.serial order by id desc offset 1 limit 1) previous;
        v_consumption := coalesce(v_consumption, 0);
        if v_consumption <= 0 then continue; end if;

        if v_meter.type = 'water' then
          v_lines := v_lines || jsonb_build_object(
            'description', 'Water consumption (' || v_meter.serial || ')', 'category', 'water',
            'quantity', v_consumption, 'unitPrice', v_tariff.water_per_kl, 'amount', round(v_consumption * v_tariff.water_per_kl, 2)
          );
        elsif v_meter.type <> 'prepaid_electricity' then
          v_lines := v_lines || jsonb_build_object(
            'description', 'Electricity consumption (' || v_meter.serial || ')', 'category', 'electricity',
            'quantity', v_consumption, 'unitPrice', v_tariff.electricity_per_kwh, 'amount', round(v_consumption * v_tariff.electricity_per_kwh, 2)
          );
        end if;
      end loop;

      v_lines := v_lines
        || jsonb_build_object('description', 'Refuse removal', 'category', 'refuse', 'quantity', 1, 'unitPrice', v_tariff.refuse_monthly, 'amount', v_tariff.refuse_monthly)
        || jsonb_build_object('description', 'Sewerage', 'category', 'sewer', 'quantity', 1, 'unitPrice', v_tariff.sewer_monthly, 'amount', v_tariff.sewer_monthly);

      select round(sum((l->>'amount')::numeric), 2) into v_subtotal from jsonb_array_elements(v_lines) l;
      v_vat := round(v_subtotal * v_tariff.vat_rate, 2);
      v_lines := v_lines || jsonb_build_object(
        'description', 'VAT @ ' || round(v_tariff.vat_rate * 100) || '%', 'category', 'other', 'quantity', 1, 'unitPrice', v_vat, 'amount', v_vat
      );
      v_total := round(v_subtotal + v_vat, 2);

      v_invoice_id := 'INV-' || v_period || '-' || v_account.account_number;
      insert into billing.invoices (id, account_id, account_number, billing_period, issue_date, due_date, total_amount, amount_paid, status)
      values (v_invoice_id, v_account.id, v_account.account_number, v_period, v_issue_date, v_due_date, v_total, 0, 'pending');

      insert into billing.invoice_lines (invoice_id, description, category, quantity, unit_price, amount)
      select v_invoice_id, l->>'description', l->>'category', (l->>'quantity')::numeric, (l->>'unitPrice')::numeric, (l->>'amount')::numeric
      from jsonb_array_elements(v_lines) l;

      update billing.accounts set balance = balance + v_total, status = case when balance + v_total > 0 then 'pending' else status end
      where account_number = v_account.account_number;

      v_accounts_processed := v_accounts_processed + 1;
      v_total_billed := round(v_total_billed + v_total, 2);
    end loop;

    update billing.billing_runs
    set completed_at = now(), accounts_processed = v_accounts_processed, total_billed = v_total_billed, status = 'completed'
    where id = v_run_id
    returning * into v_run;
  exception when others then
    update billing.billing_runs set completed_at = now(), accounts_processed = 0, total_billed = 0, status = 'failed' where id = v_run_id;
    raise;
  end;

  perform public._append_audit_event('POST /billing/billing-runs', p_municipality);
  return v_run;
end;
$$;
revoke execute on function public.run_billing_period(text, text) from public;

-- Direct port of billing-service/src/routes/banking.ts PUT /:accountNumber.
create or replace function public.upsert_banking_details(
  p_account_number text, p_bank_name text, p_account_holder text, p_branch_code text,
  p_account_type text, p_debit_day integer, p_bank_account_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = billing, pg_catalog, pg_temp
as $$
declare
  v_account_id text;
  v_row billing.banking_details;
begin
  if not (public.jwt_persona() in ('official', 'operator') or public.jwt_account_number() = p_account_number) then
    raise exception 'Consumers may only access their own account' using errcode = '42501';
  end if;
  if p_account_type not in ('cheque', 'savings') then
    raise exception 'accountType must be cheque or savings' using errcode = '22023';
  end if;
  if p_debit_day < 1 or p_debit_day > 31 then
    raise exception 'debitDay must be 1-31' using errcode = '22023';
  end if;

  select id into v_account_id from billing.accounts where account_number = p_account_number;
  if v_account_id is null then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;

  if p_bank_account_number is null and not exists (select 1 from billing.banking_details where account_id = v_account_id) then
    raise exception 'accountNumber is required for a first-time save' using errcode = '22023';
  end if;

  insert into billing.banking_details (account_id, bank_name, account_holder, account_number, branch_code, account_type, debit_day, updated_at)
  values (v_account_id, p_bank_name, p_account_holder, coalesce(p_bank_account_number, (select account_number from billing.banking_details where account_id = v_account_id)), p_branch_code, p_account_type, p_debit_day, now())
  on conflict (account_id) do update set
    bank_name = excluded.bank_name, account_holder = excluded.account_holder,
    account_number = excluded.account_number, branch_code = excluded.branch_code,
    account_type = excluded.account_type, debit_day = excluded.debit_day, updated_at = now()
  returning * into v_row;

  perform public._append_audit_event('PUT /billing/banking/:accountNumber', p_account_number);
  -- Mirrors public.banking_details (db/014): the raw bank account number
  -- is never returned, even to the account owner who just supplied it —
  -- same defense-in-depth the old Express route applied in every response.
  return jsonb_build_object(
    'accountNumber', p_account_number,
    'bankName', v_row.bank_name,
    'accountHolder', v_row.account_holder,
    'maskedAccountNumber', '••••' || right(v_row.account_number, 4),
    'branchCode', v_row.branch_code,
    'accountType', v_row.account_type,
    'debitDay', v_row.debit_day,
    'updatedAt', v_row.updated_at
  );
end;
$$;
revoke execute on function public.upsert_banking_details(text, text, text, text, text, integer, text) from public;

-- Direct port of billing-service/src/routes/disputes.ts POST /.
create or replace function public.create_dispute(p_account_number text, p_invoice_id text, p_reason text, p_description text)
returns billing.disputes
language plpgsql
security definer
set search_path = billing, pg_catalog, pg_temp
as $$
declare
  v_id text;
  v_row billing.disputes;
begin
  if not (public.jwt_persona() in ('official', 'operator') or public.jwt_account_number() = p_account_number) then
    raise exception 'Consumers may only access their own account' using errcode = '42501';
  end if;
  if not exists (select 1 from billing.invoices where id = p_invoice_id and account_number = p_account_number) then
    raise exception 'Invoice not found on this account' using errcode = 'P0002';
  end if;

  v_id := 'DSP-' || public._next_seq('billing', 'disputes');
  insert into billing.disputes (id, account_number, invoice_id, reason, description, status)
  values (v_id, p_account_number, p_invoice_id, p_reason, p_description, 'open')
  returning * into v_row;

  perform public._append_audit_event('POST /billing/disputes', p_account_number);
  return v_row;
end;
$$;
revoke execute on function public.create_dispute(text, text, text, text) from public;

-- Direct port of billing-service/src/routes/disputes.ts POST /:id/resolve.
create or replace function public.resolve_dispute(p_id text, p_status text, p_resolution_note text)
returns billing.disputes
language plpgsql
security definer
set search_path = billing, pg_catalog, pg_temp
as $$
declare
  v_persona text := public.jwt_persona();
  v_dispute billing.disputes;
  v_row billing.disputes;
begin
  if v_persona = 'citizen' then
    raise exception 'This operation is restricted to municipal staff' using errcode = '42501';
  end if;
  if p_status not in ('resolved', 'rejected') then
    raise exception 'status must be resolved or rejected' using errcode = '22023';
  end if;

  select * into v_dispute from billing.disputes where id = p_id;
  if v_dispute.id is null then
    raise exception 'Dispute not found' using errcode = 'P0002';
  end if;

  if v_persona = 'official' and not exists (
    select 1 from billing.accounts where account_number = v_dispute.account_number and municipality = public.jwt_municipality_id()
  ) then
    raise exception 'This dispute belongs to another municipality' using errcode = '42501';
  end if;

  update billing.disputes set status = p_status, resolution_note = p_resolution_note, resolved_at = now()
  where id = p_id
  returning * into v_row;

  perform public._append_audit_event('POST /billing/disputes/:id/resolve', p_id);
  return v_row;
end;
$$;
revoke execute on function public.resolve_dispute(text, text, text) from public;

-- Direct port of billing-service/src/routes/subsidy.ts POST /apply — tiers
-- copied verbatim from repository.ts calculateSubsidyPercent().
create or replace function public.apply_for_subsidy(p_account_number text, p_household_income numeric, p_household_size integer)
returns billing.subsidy_applications
language plpgsql
security definer
set search_path = billing, pg_catalog, pg_temp
as $$
declare
  v_percent numeric;
  v_id text;
  v_row billing.subsidy_applications;
begin
  if not (public.jwt_persona() in ('official', 'operator') or public.jwt_account_number() = p_account_number) then
    raise exception 'Consumers may only access their own account' using errcode = '42501';
  end if;
  if p_household_income < 0 or p_household_size < 1 then
    raise exception 'householdIncome must be >= 0 and householdSize a positive integer' using errcode = '22023';
  end if;

  v_percent := case
    when p_household_income <= 3500 then 100
    when p_household_income <= 5500 then 50
    when p_household_income <= 7000 then 25
    else 0
  end;
  v_id := 'SUB-' || public._next_seq('billing', 'subsidy_applications');

  insert into billing.subsidy_applications (id, account_number, household_income, household_size, subsidy_percent, status)
  values (v_id, p_account_number, p_household_income, p_household_size, v_percent, case when v_percent > 0 then 'approved' else 'rejected' end)
  returning * into v_row;

  perform public._append_audit_event('POST /billing/subsidy/apply', p_account_number);
  return v_row;
end;
$$;
revoke execute on function public.apply_for_subsidy(text, numeric, integer) from public;

-- Direct port of billing-service/src/routes/tariffs.ts POST / +
-- repository.ts createTariff() (closes any open-ended prior row).
create or replace function public.create_tariff(
  p_code text, p_description text, p_electricity_per_kwh numeric, p_water_per_kl numeric,
  p_refuse_monthly numeric, p_sewer_monthly numeric, p_valid_from date, p_vat_rate numeric default 0.15
)
returns billing.tariffs
language plpgsql
security definer
set search_path = billing, pg_catalog, pg_temp
as $$
declare
  v_previous billing.tariffs;
  v_row billing.tariffs;
begin
  if public.jwt_persona() <> 'operator' then
    raise exception 'This operation is restricted to platform operators' using errcode = '42501';
  end if;
  if p_electricity_per_kwh < 0 or p_water_per_kl < 0 or p_refuse_monthly < 0 or p_sewer_monthly < 0 or p_vat_rate < 0 then
    raise exception 'tariff rates must be non-negative numbers' using errcode = '22023';
  end if;

  select * into v_previous from billing.tariffs where code = p_code and valid_to is null order by valid_from desc limit 1;
  if v_previous.id is not null and v_previous.valid_from < p_valid_from then
    update billing.tariffs set valid_to = p_valid_from - 1 where id = v_previous.id;
  end if;

  insert into billing.tariffs (code, description, electricity_per_kwh, water_per_kl, refuse_monthly, sewer_monthly, vat_rate, valid_from)
  values (p_code, p_description, p_electricity_per_kwh, p_water_per_kl, p_refuse_monthly, p_sewer_monthly, p_vat_rate, p_valid_from)
  returning * into v_row;

  perform public._append_audit_event('POST /billing/tariffs', p_code);
  return v_row;
end;
$$;
revoke execute on function public.create_tariff(text, text, numeric, numeric, numeric, numeric, date, numeric) from public;

-- Direct port of billing-service/src/routes/accounts.ts POST /:accountNumber/handover.
create or replace function public.toggle_handover(p_account_number text)
returns billing.accounts
language plpgsql
security definer
set search_path = billing, pg_catalog, pg_temp
as $$
declare
  v_persona text := public.jwt_persona();
  v_account billing.accounts;
  v_row billing.accounts;
begin
  if v_persona = 'citizen' then
    raise exception 'This operation is restricted to municipal staff' using errcode = '42501';
  end if;

  select * into v_account from billing.accounts where account_number = p_account_number;
  if v_account.id is null then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  if v_persona = 'official' and v_account.municipality <> public.jwt_municipality_id() then
    raise exception 'This account belongs to another municipality' using errcode = '42501';
  end if;

  update billing.accounts set status = case when v_account.status = 'handover' then 'overdue' else 'handover' end
  where account_number = p_account_number
  returning * into v_row;

  perform public._append_audit_event('POST /billing/accounts/:accountNumber/handover', p_account_number);
  return v_row;
end;
$$;
revoke execute on function public.toggle_handover(text) from public;

-- ============================================================================
-- payments
-- ============================================================================

-- Direct port of payments-service/src/routes/initiate.ts + the SwiftPay /
-- CapitecPay / WhatsAppPay / SamsungPay mocks from packages/integrations —
-- none of those adapters ever made a real HTTP call (see packages/integrations/
-- src/*.ts), so the whole gateway-routing simulation can run in plain SQL
-- with no Edge Function needed.
create or replace function public.initiate_payment(p_account_number text, p_amount numeric, p_method text)
returns payments.transactions
language plpgsql
security definer
set search_path = payments, billing, pg_catalog, pg_temp
as $$
declare
  v_consumer_name text;
  v_ref text;
  v_status text;
  v_gateway text;
  v_settled_at timestamptz := clock_timestamp();
  v_row payments.transactions;
begin
  if not (public.jwt_persona() in ('official', 'operator') or public.jwt_account_number() = p_account_number) then
    raise exception 'Consumers may only access their own account' using errcode = '42501';
  end if;

  select consumer_name into v_consumer_name from billing.accounts where account_number = p_account_number;
  v_consumer_name := coalesce(v_consumer_name, 'Unknown');

  if p_method = 'capitec' then
    v_gateway := 'CapitecPay';
    v_ref := 'CAP-PAY-' || floor(1000000 + random() * 9000000)::bigint;
    v_status := 'matched';
  elsif p_method = 'wapay' then
    raise exception 'WhatsApp Pay is under compliance review and cannot accept live payments yet' using errcode = 'XX000';
  elsif p_method = 'samsung' then
    raise exception 'Samsung Pay integration is pending configuration' using errcode = 'XX000';
  else
    if p_amount <= 0 then
      raise exception 'Amount must be positive' using errcode = '22023';
    end if;
    v_gateway := 'SwiftPay';
    v_ref := 'SP-PAY-' || floor(1000000 + random() * 9000000)::bigint;
    v_status := case when random() < 0.02 then 'failed' else 'matched' end;
  end if;

  insert into payments.transactions (ref, account_number, consumer_name, amount, gateway, method, status, erp_status, created_at)
  values (v_ref, p_account_number, v_consumer_name, p_amount, v_gateway, p_method, v_status, case when v_status = 'matched' then 'posted' else 'pending' end, v_settled_at)
  returning * into v_row;

  if v_status = 'matched' then
    perform public._apply_payment_to_oldest_invoice(p_account_number, p_amount);
  end if;

  perform public._append_audit_event('POST /payments/initiate', p_account_number);
  return v_row;
end;
$$;
revoke execute on function public.initiate_payment(text, numeric, text) from public;

-- Direct port of payments-service/src/routes/recon.ts POST /run.
create or replace function public.run_recon()
returns jsonb
language plpgsql
security definer
set search_path = payments, billing, pg_catalog, pg_temp
as $$
declare
  v_tx record;
  v_scanned integer := 0;
  v_matched integer := 0;
begin
  if public.jwt_persona() = 'citizen' then
    raise exception 'This operation is restricted to municipal staff' using errcode = '42501';
  end if;

  for v_tx in select * from payments.transactions where status = 'suspense' loop
    v_scanned := v_scanned + 1;
    if public._apply_payment_to_oldest_invoice(v_tx.account_number, v_tx.amount) then
      update payments.transactions set status = 'matched', erp_status = 'posted' where ref = v_tx.ref;
      v_matched := v_matched + 1;
    end if;
  end loop;

  perform public._append_audit_event('POST /payments/recon/run', null);
  return jsonb_build_object('scanned', v_scanned, 'matched', v_matched, 'remaining', v_scanned - v_matched);
end;
$$;
revoke execute on function public.run_recon() from public;

-- Direct port of payments-service/src/routes/recon.ts POST /:ref/resolve.
create or replace function public.resolve_recon(p_ref text)
returns payments.transactions
language plpgsql
security definer
set search_path = payments, pg_catalog, pg_temp
as $$
declare
  v_row payments.transactions;
begin
  if public.jwt_persona() = 'citizen' then
    raise exception 'This operation is restricted to municipal staff' using errcode = '42501';
  end if;

  update payments.transactions set status = 'matched', erp_status = 'posted' where ref = p_ref returning * into v_row;
  if v_row.ref is null then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;

  perform public._append_audit_event('POST /payments/recon/:ref/resolve', p_ref);
  return v_row;
end;
$$;
revoke execute on function public.resolve_recon(text) from public;

-- Direct port of payments-service/src/routes/plans.ts POST /.
create or replace function public.create_payment_plan(p_account_number text, p_consumer_name text, p_total_amount numeric, p_installments integer)
returns payments.payment_plans
language plpgsql
security definer
set search_path = payments, pg_catalog, pg_temp
as $$
declare
  v_id text;
  v_installment_amount numeric;
  v_row payments.payment_plans;
begin
  if not (public.jwt_persona() in ('official', 'operator') or public.jwt_account_number() = p_account_number) then
    raise exception 'Consumers may only access their own account' using errcode = '42501';
  end if;
  if p_total_amount <= 0 or p_installments < 1 then
    raise exception 'totalAmount must be > 0 and installments a positive integer' using errcode = '22023';
  end if;
  if exists (select 1 from payments.payment_plans where account_number = p_account_number and status = 'active') then
    raise exception 'An active payment plan already exists for this account' using errcode = '23505';
  end if;

  v_id := 'PLN-' || public._next_seq('payments', 'payment_plans');
  v_installment_amount := round(p_total_amount / p_installments, 2);

  insert into payments.payment_plans (id, account_number, consumer_name, total_amount, installments, installment_amount, start_date, status)
  values (v_id, p_account_number, p_consumer_name, p_total_amount, p_installments, v_installment_amount, current_date, 'active')
  returning * into v_row;

  perform public._append_audit_event('POST /payments/plans', p_account_number);
  return v_row;
end;
$$;
revoke execute on function public.create_payment_plan(text, text, numeric, integer) from public;

-- ============================================================================
-- metering
-- ============================================================================

-- Direct port of metering-service/src/routes/meters.ts POST /vend-token +
-- the ConlogAdapter mock (packages/integrations/src/conlog.ts — also never
-- made a real HTTP call).
create or replace function public.vend_token(p_serial text, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = metering, pg_catalog, pg_temp
as $$
declare
  v_meter metering.meters;
  v_units numeric;
  v_token text;
  v_ref text;
  v_id text;
  v_tariff_per_unit constant numeric := 2.1;
begin
  select * into v_meter from metering.meters where serial = p_serial;
  if v_meter.id is null then
    raise exception 'Meter not found' using errcode = 'P0002';
  end if;
  if not (public.jwt_persona() in ('official', 'operator') or public.jwt_account_number() = v_meter.account_number) then
    raise exception 'Consumers may only access their own account' using errcode = '42501';
  end if;

  v_units := round(p_amount / v_tariff_per_unit, 2);
  v_token := lpad(floor(1000 + random() * 9000)::text, 4, '0') || ' ' || lpad(floor(1000 + random() * 9000)::text, 4, '0')
    || ' ' || lpad(floor(1000 + random() * 9000)::text, 4, '0') || ' ' || lpad(floor(1000 + random() * 9000)::text, 4, '0');
  v_ref := 'STS-TOK-' || floor(1000000 + random() * 9000000)::bigint;
  v_id := 'vnd-' || public._next_seq('metering', 'vended_tokens');

  insert into metering.vended_tokens (id, meter_id, serial, account_number, amount, units, token)
  values (v_id, v_meter.id, v_meter.serial, v_meter.account_number, p_amount, v_units, v_token);

  perform public._append_audit_event('POST /metering/vend-token', v_meter.account_number);
  return jsonb_build_object('token', v_token, 'units', v_units, 'ref', v_ref);
end;
$$;
revoke execute on function public.vend_token(text, numeric) from public;

-- Direct port of metering-service/src/routes/meters.ts POST /ingest.
create or replace function public.ingest_meter_reading(p_serial text, p_reading numeric, p_read_at timestamptz default now())
returns metering.meters
language plpgsql
security definer
set search_path = metering, pg_catalog, pg_temp
as $$
declare
  v_row metering.meters;
begin
  if public.jwt_persona() = 'citizen' then
    raise exception 'This operation is restricted to municipal staff' using errcode = '42501';
  end if;

  update metering.meters set last_reading = p_reading, last_reading_at = p_read_at where serial = p_serial returning * into v_row;
  if v_row.id is null then
    raise exception 'Meter not found' using errcode = 'P0002';
  end if;
  insert into metering.readings (meter_id, serial, reading, read_at) values (v_row.id, p_serial, p_reading, p_read_at);

  perform public._append_audit_event('POST /metering/ingest', p_serial);
  return v_row;
end;
$$;
revoke execute on function public.ingest_meter_reading(text, numeric, timestamptz) from public;

-- Direct port of metering-service/src/routes/faults.ts POST / (staff-only
-- for the whole router, per faultsRouter.use()).
create or replace function public.create_fault(p_serial text, p_description text default 'Fault reported', p_severity text default 'medium')
returns metering.meter_faults
language plpgsql
security definer
set search_path = metering, pg_catalog, pg_temp
as $$
declare
  v_meter metering.meters;
  v_id text;
  v_row metering.meter_faults;
begin
  if public.jwt_persona() = 'citizen' then
    raise exception 'This operation is restricted to municipal staff' using errcode = '42501';
  end if;

  select * into v_meter from metering.meters where serial = p_serial;
  if v_meter.id is null then
    raise exception 'Meter not found' using errcode = 'P0002';
  end if;

  v_id := 'flt-' || public._next_seq('metering', 'meter_faults');
  insert into metering.meter_faults (id, meter_id, serial, description, severity, status, reported_at)
  values (v_id, v_meter.id, v_meter.serial, p_description, p_severity, 'reported', now())
  returning * into v_row;
  update metering.meters set status = 'fault' where id = v_meter.id;

  perform public._append_audit_event('POST /metering/faults', p_serial);
  return v_row;
end;
$$;
revoke execute on function public.create_fault(text, text, text) from public;

-- Direct port of metering-service/src/routes/faults.ts POST /:id/dispatch.
create or replace function public.dispatch_fault(p_id text)
returns metering.meter_faults
language plpgsql
security definer
set search_path = metering, pg_catalog, pg_temp
as $$
declare
  v_row metering.meter_faults;
begin
  if public.jwt_persona() = 'citizen' then
    raise exception 'This operation is restricted to municipal staff' using errcode = '42501';
  end if;
  update metering.meter_faults set status = 'dispatched' where id = p_id returning * into v_row;
  if v_row.id is null then
    raise exception 'Fault not found' using errcode = 'P0002';
  end if;
  perform public._append_audit_event('POST /metering/faults/:id/dispatch', p_id);
  return v_row;
end;
$$;
revoke execute on function public.dispatch_fault(text) from public;

-- Direct port of metering-service/src/routes/faults.ts POST /:id/resolve.
create or replace function public.resolve_fault(p_id text)
returns metering.meter_faults
language plpgsql
security definer
set search_path = metering, pg_catalog, pg_temp
as $$
declare
  v_row metering.meter_faults;
begin
  if public.jwt_persona() = 'citizen' then
    raise exception 'This operation is restricted to municipal staff' using errcode = '42501';
  end if;
  update metering.meter_faults set status = 'resolved' where id = p_id returning * into v_row;
  if v_row.id is null then
    raise exception 'Fault not found' using errcode = 'P0002';
  end if;
  update metering.meters set status = 'normal' where id = v_row.meter_id;
  perform public._append_audit_event('POST /metering/faults/:id/resolve', p_id);
  return v_row;
end;
$$;
revoke execute on function public.resolve_fault(text) from public;

-- ============================================================================
-- platform (municipalities + api keys — always lived in the gateway's own
-- Postgres schema, not a dedicated service, per services/gateway/src/index.ts)
-- ============================================================================

-- Direct port of services/gateway/src/index.ts PATCH /api/platform/municipalities/:id.
create or replace function public.edit_municipality(p_id text, p_patch jsonb)
returns platform.municipalities
language plpgsql
security definer
set search_path = platform, pg_catalog, pg_temp
as $$
declare
  v_persona text := public.jwt_persona();
  v_is_operator boolean := (v_persona = 'operator' or v_persona is null);
  v_is_own boolean := (v_persona = 'official' and public.jwt_municipality_id() = p_id);
  v_touched integer := 0;
  v_row platform.municipalities;
begin
  if not (v_is_operator or v_is_own) then
    raise exception 'You may only edit your own municipality' using errcode = '42501';
  end if;

  if v_is_operator then
    if p_patch ? 'name' then v_touched := v_touched + 1; end if;
    if p_patch ? 'province' then v_touched := v_touched + 1; end if;
    if p_patch ? 'brandColor' then v_touched := v_touched + 1; end if;
    if p_patch ? 'logoUrl' then v_touched := v_touched + 1; end if;
  end if;
  if p_patch ? 'contactEmail' then v_touched := v_touched + 1; end if;
  if p_patch ? 'contactPhone' then v_touched := v_touched + 1; end if;
  if v_touched = 0 then
    raise exception 'No editable fields were provided' using errcode = '22023';
  end if;

  update platform.municipalities set
    name = case when v_is_operator and p_patch ? 'name' then p_patch ->> 'name' else name end,
    province = case when v_is_operator and p_patch ? 'province' then p_patch ->> 'province' else province end,
    brand_color = case when v_is_operator and p_patch ? 'brandColor' then p_patch ->> 'brandColor' else brand_color end,
    logo_url = case when v_is_operator and p_patch ? 'logoUrl' then p_patch ->> 'logoUrl' else logo_url end,
    contact_email = case when p_patch ? 'contactEmail' then p_patch ->> 'contactEmail' else contact_email end,
    contact_phone = case when p_patch ? 'contactPhone' then p_patch ->> 'contactPhone' else contact_phone end
  where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Municipality not found' using errcode = 'P0002';
  end if;

  perform public._append_audit_event('PATCH /platform/municipalities/:id', p_id);
  return v_row;
end;
$$;
revoke execute on function public.edit_municipality(text, jsonb) from public;

-- Direct port of services/gateway/src/apiKeys.ts createApiKey().
create or replace function public.create_api_key(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = platform, extensions, public, pg_catalog, pg_temp
as $$
declare
  v_secret text;
  v_key text;
  v_id text;
  v_created_by text;
  v_row platform.api_keys;
begin
  if public.jwt_persona() <> 'operator' then
    raise exception 'This operation is restricted to platform operators' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name is required' using errcode = '22023';
  end if;

  select name into v_created_by from platform.users where auth_user_id = auth.uid();
  v_created_by := coalesce(v_created_by, auth.uid()::text, 'unknown');

  v_secret := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
  v_key := 'xpk_' || v_secret;
  v_id := 'key-' || encode(gen_random_bytes(6), 'hex');

  insert into platform.api_keys (id, name, key_prefix, key_hash, created_by)
  values (v_id, p_name, left(v_key, 12), encode(digest(v_key, 'sha256'), 'hex'), v_created_by)
  returning * into v_row;

  perform public._append_audit_event('POST /platform/api-keys', v_id);
  return jsonb_build_object(
    'id', v_row.id, 'name', v_row.name, 'keyPrefix', v_row.key_prefix,
    'createdBy', v_row.created_by, 'createdAt', v_row.created_at, 'key', v_key
  );
end;
$$;
revoke execute on function public.create_api_key(text) from public;

-- Direct port of services/gateway/src/apiKeys.ts revokeApiKey().
create or replace function public.revoke_api_key(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = platform, pg_catalog, pg_temp
as $$
declare
  v_row platform.api_keys;
begin
  if public.jwt_persona() <> 'operator' then
    raise exception 'This operation is restricted to platform operators' using errcode = '42501';
  end if;
  update platform.api_keys set revoked_at = now() where id = p_id returning * into v_row;
  if v_row.id is null then
    raise exception 'API key not found' using errcode = 'P0002';
  end if;
  perform public._append_audit_event('POST /platform/api-keys/:id/revoke', p_id);
  -- Mirrors public.api_keys (db/014): key_hash never leaves the database,
  -- same as every other read/write path for this table.
  return jsonb_build_object(
    'id', v_row.id, 'name', v_row.name, 'keyPrefix', v_row.key_prefix,
    'createdBy', v_row.created_by, 'createdAt', v_row.created_at, 'revokedAt', v_row.revoked_at
  );
end;
$$;
revoke execute on function public.revoke_api_key(text) from public;

-- ============================================================================
-- compliance
-- ============================================================================

-- Direct port of compliance-service/src/routes/kyc.ts POST /verify + the
-- HANIS / SARS / TransUnion / DeedsRegistry mocks (packages/integrations —
-- none of them ever made a real HTTP call either).
create or replace function public.kyc_verify(p_id_number text, p_erf_number text default null)
returns jsonb
language plpgsql
security definer
set search_path = compliance, pg_catalog, pg_temp
as $$
declare
  v_identity jsonb;
  v_tax jsonb;
  v_credit jsonb;
  v_ownership jsonb;
  v_outcome text;
  v_requested_by text;
begin
  if public.jwt_persona() = 'citizen' then
    raise exception 'This operation is restricted to municipal staff' using errcode = '42501';
  end if;
  if coalesce(p_id_number, '') = '' then
    raise exception 'idNumber is required' using errcode = '22023';
  end if;

  v_identity := jsonb_build_object(
    'provider', 'HANIS', 'idNumber', p_id_number,
    'result', case when p_id_number ~ '^[0-9]{13}$' then 'verified' else 'not_found' end,
    'checkedAt', now()
  );
  v_tax := jsonb_build_object('provider', 'SARS', 'idNumber', p_id_number, 'result', 'verified', 'checkedAt', now());
  v_credit := jsonb_build_object(
    'provider', 'TransUnion', 'idNumber', p_id_number, 'result', 'verified', 'checkedAt', now(),
    'score', 550 + floor(random() * 300)
  );
  if coalesce(p_erf_number, '') <> '' then
    v_ownership := jsonb_build_object('provider', 'DeedsRegistry', 'idNumber', p_id_number, 'result', 'verified', 'checkedAt', now());
  end if;

  v_outcome := case when v_identity ->> 'result' = 'verified' and v_tax ->> 'result' = 'verified'
                      and v_credit ->> 'result' = 'verified' and (v_ownership is null or v_ownership ->> 'result' = 'verified')
                 then 'verified' else 'review' end;

  v_requested_by := coalesce(auth.uid()::text, 'unknown');
  insert into compliance.kyc_checks (id_number, erf_number, requested_by, outcome, detail)
  values (p_id_number, nullif(p_erf_number, ''), v_requested_by, v_outcome,
    jsonb_build_object('identity', v_identity, 'taxClearance', v_tax, 'credit', v_credit, 'ownership', v_ownership));

  perform public._append_audit_event('POST /compliance/kyc/verify', null);
  return jsonb_build_object('outcome', v_outcome, 'identity', v_identity, 'taxClearance', v_tax, 'credit', v_credit, 'ownership', v_ownership);
end;
$$;
revoke execute on function public.kyc_verify(text, text) from public;

-- Direct port of compliance-service/src/audit.ts verifyAuditChain() — same
-- operator-only scope as the compliance.audit_events RLS policy in db/011
-- (the Audit UI that calls this is xLayer/operator-only).
create or replace function public.verify_audit_chain()
returns jsonb
language plpgsql
security definer
set search_path = compliance, extensions, public, pg_catalog, pg_temp
as $$
declare
  v_row record;
  v_prev_hash text := repeat('0', 64);
  v_expected text;
  v_broken_at bigint := null;
  v_count integer := 0;
begin
  if public.jwt_persona() <> 'operator' then
    raise exception 'This operation is restricted to platform operators' using errcode = '42501';
  end if;

  for v_row in select * from compliance.audit_events order by id loop
    v_count := v_count + 1;
    v_expected := encode(
      digest(v_prev_hash || '|' || v_row.actor || '|' || coalesce(v_row.role, '') || '|' || v_row.action || '|' || coalesce(v_row.target, '')
        || '|' || to_char(v_row.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'sha256'),
      'hex'
    );
    if v_row.prev_hash <> v_prev_hash or v_row.hash <> v_expected then
      v_broken_at := v_row.id;
      exit;
    end if;
    v_prev_hash := v_row.hash;
  end loop;

  return jsonb_build_object('intact', v_broken_at is null, 'brokenAtId', v_broken_at, 'events', v_count);
end;
$$;
revoke execute on function public.verify_audit_chain() from public;

-- ============================================================================
-- comms — DB half only. The actual SMS/email dispatch needs outbound HTTP
-- (BulkSMS / Resend), which Postgres can't do here — that's what the
-- campaign-send Edge Function is for. These two functions are what it calls
-- before and after making the HTTP request, so the campaign row and the
-- audit trail stay the single source of truth either way.
-- ============================================================================

create or replace function public.create_campaign(p_name text, p_type text, p_municipality text default 'All')
returns comms.campaigns
language plpgsql
security definer
set search_path = comms, pg_catalog, pg_temp
as $$
declare
  v_id text;
  v_row comms.campaigns;
begin
  if public.jwt_persona() not in ('official', 'operator') then
    raise exception 'This operation is restricted to municipal staff' using errcode = '42501';
  end if;

  v_id := 'CMP-' || lpad(public._next_seq('comms', 'campaigns')::text, 3, '0');
  insert into comms.campaigns (id, name, type, status, sent, opened, clicked, paid, unpaid, created_at, municipality)
  values (v_id, p_name, p_type, 'scheduled', 0, case when p_type = 'Email' then 0 else null end, 0, 0, 0, current_date, p_municipality)
  returning * into v_row;

  perform public._append_audit_event('POST /comms/campaigns', v_id);
  return v_row;
end;
$$;
revoke execute on function public.create_campaign(text, text, text) from public;

create or replace function public.mark_campaign_sent(p_id text, p_sent integer)
returns comms.campaigns
language plpgsql
security definer
set search_path = comms, pg_catalog, pg_temp
as $$
declare
  v_row comms.campaigns;
begin
  if public.jwt_persona() not in ('official', 'operator') then
    raise exception 'This operation is restricted to municipal staff' using errcode = '42501';
  end if;
  update comms.campaigns set status = 'running', sent = p_sent where id = p_id returning * into v_row;
  if v_row.id is null then
    raise exception 'Campaign not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;
revoke execute on function public.mark_campaign_sent(text, integer) from public;

-- ============================================================================
-- Grants — RPC functions are unreachable through PostgREST without EXECUTE,
-- same as every table in db/011 needed a GRANT SELECT before its policy did
-- anything. Guarded exactly like db/010/011: no-op on bare Postgres, where
-- the `authenticated` role doesn't exist.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'authenticated role not present — skipping RPC grants (not a Supabase-provisioned Postgres)';
    return;
  end if;

  execute 'grant execute on function public.run_billing_period(text, text) to authenticated';
  execute 'grant execute on function public.upsert_banking_details(text, text, text, text, text, integer, text) to authenticated';
  execute 'grant execute on function public.create_dispute(text, text, text, text) to authenticated';
  execute 'grant execute on function public.resolve_dispute(text, text, text) to authenticated';
  execute 'grant execute on function public.apply_for_subsidy(text, numeric, integer) to authenticated';
  execute 'grant execute on function public.create_tariff(text, text, numeric, numeric, numeric, numeric, date, numeric) to authenticated';
  execute 'grant execute on function public.toggle_handover(text) to authenticated';

  execute 'grant execute on function public.initiate_payment(text, numeric, text) to authenticated';
  execute 'grant execute on function public.run_recon() to authenticated';
  execute 'grant execute on function public.resolve_recon(text) to authenticated';
  execute 'grant execute on function public.create_payment_plan(text, text, numeric, integer) to authenticated';

  execute 'grant execute on function public.vend_token(text, numeric) to authenticated';
  execute 'grant execute on function public.ingest_meter_reading(text, numeric, timestamptz) to authenticated';
  execute 'grant execute on function public.create_fault(text, text, text) to authenticated';
  execute 'grant execute on function public.dispatch_fault(text) to authenticated';
  execute 'grant execute on function public.resolve_fault(text) to authenticated';

  execute 'grant execute on function public.edit_municipality(text, jsonb) to authenticated';
  execute 'grant execute on function public.create_api_key(text) to authenticated';
  execute 'grant execute on function public.revoke_api_key(text) to authenticated';

  execute 'grant execute on function public.kyc_verify(text, text) to authenticated';
  execute 'grant execute on function public.verify_audit_chain() to authenticated';

  execute 'grant execute on function public.create_campaign(text, text, text) to authenticated';
  execute 'grant execute on function public.mark_campaign_sent(text, integer) to authenticated';
end $$;
