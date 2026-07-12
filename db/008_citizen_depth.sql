-- Phase 3: citizen self-service depth — banking details, payment plans,
-- indigent subsidy, and disputes. All four are new tables in schemas that
-- already exist, so this only needs RLS + the app_service policy added
-- explicitly (005's blanket enable ran before these tables existed).

create table billing.banking_details (
  account_id text primary key references billing.accounts(id),
  bank_name text not null,
  account_holder text not null,
  account_number text not null,
  branch_code text not null,
  account_type text not null,
  debit_day integer not null,
  updated_at timestamptz not null default now()
);

create table billing.disputes (
  id text primary key,
  account_number text not null,
  invoice_id text not null references billing.invoices(id),
  reason text not null,
  description text not null,
  status text not null,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index disputes_account_number_idx on billing.disputes (account_number);
create index disputes_invoice_id_idx on billing.disputes (invoice_id);

create table billing.subsidy_applications (
  id text primary key,
  account_number text not null,
  household_income numeric not null,
  household_size integer not null,
  subsidy_percent numeric not null,
  status text not null,
  applied_at timestamptz not null default now()
);
create index subsidy_applications_account_number_idx on billing.subsidy_applications (account_number);

create table payments.payment_plans (
  id text primary key,
  account_number text not null,
  consumer_name text not null,
  total_amount numeric not null,
  installments integer not null,
  installment_amount numeric not null,
  start_date date not null,
  status text not null,
  created_at timestamptz not null default now()
);
create index payment_plans_account_number_idx on payments.payment_plans (account_number);

alter table billing.banking_details enable row level security;
alter table billing.disputes enable row level security;
alter table billing.subsidy_applications enable row level security;
alter table payments.payment_plans enable row level security;

create policy app_service_full_access on billing.banking_details for all to app_service using (true) with check (true);
create policy app_service_full_access on billing.disputes for all to app_service using (true) with check (true);
create policy app_service_full_access on billing.subsidy_applications for all to app_service using (true) with check (true);
create policy app_service_full_access on payments.payment_plans for all to app_service using (true) with check (true);
