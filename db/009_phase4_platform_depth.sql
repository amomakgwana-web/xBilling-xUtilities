-- Phase 4: platform depth — API key management (xLayer), prepaid token vend
-- history (xUtilities electricity sub-suite). Legal/handover and tariff
-- management reuse existing columns/tables (accounts.status, billing.tariffs)
-- and need no schema change; the reports and analytics pages are pure
-- read-aggregation over data that already exists.

create table platform.api_keys (
  id text primary key,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table metering.vended_tokens (
  id text primary key,
  meter_id text not null references metering.meters(id),
  serial text not null,
  account_number text not null,
  amount numeric not null,
  units numeric not null,
  token text not null,
  vended_at timestamptz not null default now()
);
create index vended_tokens_serial_idx on metering.vended_tokens (serial);
create index vended_tokens_account_number_idx on metering.vended_tokens (account_number);

alter table platform.api_keys enable row level security;
alter table metering.vended_tokens enable row level security;

create policy app_service_full_access on platform.api_keys for all to app_service using (true) with check (true);
create policy app_service_full_access on metering.vended_tokens for all to app_service using (true) with check (true);
