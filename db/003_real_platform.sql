-- Real-platform upgrade: provisioned identities, contactable accounts,
-- municipal tariff book, meter reading history, persisted KYC checks and a
-- tamper-evident audit chain.

create schema if not exists platform;

create table platform.users (
  id text primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  persona text not null, -- citizen | official | operator
  role text not null,    -- consumer | admin
  account_number text,   -- citizens only: their own billing account
  created_at timestamptz not null default now()
);

alter table billing.accounts add column if not exists email text;
alter table billing.accounts add column if not exists phone text;

create table billing.tariffs (
  code text primary key,
  description text not null,
  electricity_per_kwh numeric not null,
  water_per_kl numeric not null,
  refuse_monthly numeric not null,
  sewer_monthly numeric not null,
  vat_rate numeric not null default 0.15
);

create table metering.readings (
  id bigint primary key generated always as identity,
  meter_id text not null references metering.meters(id),
  serial text not null,
  reading numeric not null,
  read_at timestamptz not null default now()
);
create index readings_serial_idx on metering.readings (serial, id desc);

create table compliance.kyc_checks (
  id bigint primary key generated always as identity,
  id_number text not null,
  erf_number text,
  requested_by text not null,
  outcome text not null, -- verified | review
  detail jsonb not null,
  created_at timestamptz not null default now()
);

create table compliance.audit_events (
  id bigint primary key generated always as identity,
  actor text not null,
  actor_name text,
  role text,
  action text not null,
  target text,
  prev_hash text not null,
  hash text not null,
  created_at timestamptz not null default now()
);

-- app_service needs the new schema + tables (it is scoped, not superuser).
grant usage on schema platform to app_service;
grant select, insert, update, delete on all tables in schema platform to app_service;
grant select, insert, update, delete on billing.tariffs, metering.readings, compliance.kyc_checks, compliance.audit_events to app_service;
grant usage, select on all sequences in schema metering to app_service;
grant usage, select on all sequences in schema compliance to app_service;
