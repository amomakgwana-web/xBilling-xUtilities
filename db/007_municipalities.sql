-- Multi-tenancy foundation: municipalities as a first-class table instead
-- of a bare enum string repeated across five schemas. `id` is deliberately
-- the exact string already used everywhere (billing.accounts.municipality,
-- metering.meters.municipality, etc.) so this needs no data migration on
-- those existing soft references — they now resolve to a real row.

create table platform.municipalities (
  id text primary key,
  name text not null,
  province text not null,
  brand_color text not null default '#F05A00',
  logo_url text,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now()
);

alter table platform.users
  add column municipality_id text references platform.municipalities(id);

alter table platform.municipalities enable row level security;
create policy app_service_full_access on platform.municipalities
  for all to app_service using (true) with check (true);

insert into platform.municipalities (id, name, province, brand_color, contact_email, contact_phone) values
('Ekurhuleni', 'City of Ekurhuleni Metropolitan Municipality', 'Gauteng', '#F05A00', 'billing@ekurhuleni.gov.za', '+27 11 999 0000'),
('Tshwane', 'City of Tshwane Metropolitan Municipality', 'Gauteng', '#1F6FEB', 'billing@tshwane.gov.za', '+27 12 999 0000'),
('eThekwini', 'eThekwini Metropolitan Municipality', 'KwaZulu-Natal', '#14B8A6', 'billing@ethekwini.gov.za', '+27 31 999 0000'),
('CoJ', 'City of Johannesburg Metropolitan Municipality', 'Gauteng', '#8B5CF6', 'billing@joburg.org.za', '+27 11 888 0000');

update platform.users set municipality_id = 'Ekurhuleni' where email = 'official@ekurhuleni.gov.za';
