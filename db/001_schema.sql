create schema if not exists billing;
create schema if not exists payments;
create schema if not exists metering;
create schema if not exists comms;
create schema if not exists compliance;

create table billing.accounts (
  id text primary key,
  account_number text not null unique,
  consumer_name text not null,
  municipality text not null,
  erf_number text,
  balance numeric not null default 0,
  status text not null,
  tariff_code text not null,
  created_at timestamptz not null default now()
);

create table billing.invoices (
  id text primary key,
  account_id text not null references billing.accounts(id),
  account_number text not null,
  billing_period text not null,
  issue_date date not null,
  due_date date not null,
  total_amount numeric not null,
  amount_paid numeric not null default 0,
  status text not null
);

create table billing.invoice_lines (
  id bigint primary key generated always as identity,
  invoice_id text not null references billing.invoices(id) on delete cascade,
  description text not null,
  category text not null,
  quantity numeric not null,
  unit_price numeric not null,
  amount numeric not null
);

create table billing.billing_runs (
  id text primary key,
  municipality text not null,
  billing_period text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  accounts_processed integer not null default 0,
  total_billed numeric not null default 0,
  status text not null
);

create table payments.payment_methods (
  id text primary key,
  label text not null,
  provider text not null,
  status text not null,
  tx_day integer not null default 0,
  rev_day numeric not null default 0
);

create table payments.transactions (
  ref text primary key,
  account_number text not null,
  consumer_name text not null,
  amount numeric not null,
  gateway text not null,
  method text not null,
  status text not null,
  erp_status text not null,
  created_at timestamptz not null default now()
);

create table payments.debicheck_mandates (
  id text primary key,
  account_number text not null,
  consumer_name text not null,
  amount numeric not null,
  collection_day integer not null,
  status text not null
);

create table metering.meters (
  id text primary key,
  serial text not null unique,
  account_number text not null,
  municipality text not null,
  type text not null,
  last_reading numeric not null default 0,
  last_reading_at timestamptz not null default now(),
  status text not null
);

create table metering.meter_faults (
  id text primary key,
  meter_id text not null references metering.meters(id),
  serial text not null,
  description text not null,
  severity text not null,
  status text not null,
  reported_at timestamptz not null default now()
);

create table comms.campaigns (
  id text primary key,
  name text not null,
  type text not null,
  status text not null,
  sent integer not null default 0,
  opened integer,
  clicked integer not null default 0,
  paid integer not null default 0,
  unpaid integer not null default 0,
  created_at date not null default now(),
  municipality text not null
);

create table comms.chat_sessions (
  id text primary key,
  user_name text not null,
  account_number text not null,
  intent text not null,
  resolved boolean not null default false,
  escalated boolean not null default false,
  created_at timestamptz not null default now()
);

create table compliance.integrations (
  id text primary key,
  name text not null,
  category text not null,
  status text not null,
  endpoint text not null,
  description text not null
);

create table compliance.score (
  id integer primary key default 1,
  score integer not null
);

create table compliance.frameworks (
  id bigint primary key generated always as identity,
  name text not null,
  status text not null,
  last_audited_at date not null
);
