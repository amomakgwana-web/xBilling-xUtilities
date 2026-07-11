-- Provisioned identities. Demo passwords (bcrypt, cost 10):
--   operator@xplatform.co.za        Operator!2026
--   official@ekurhuleni.gov.za      Official!2026
--   <citizen>@example.co.za         Citizen!2026
insert into platform.users (id, email, name, password_hash, persona, role, account_number) values
('usr-op-1','operator@xplatform.co.za','Platform Operator','$2b$10$5l3WV4woTXU0TDCFkZw7X.tZTl8adoy97w8ooq1RA23mU1FQ8Jim6','operator','admin',null),
('usr-of-1','official@ekurhuleni.gov.za','Ops Official','$2b$10$asNDF5JlBwIL71gRF5x3e.0wRZADmAovhHAjdDFJcBEUfJao5KB.a','official','admin',null),
('usr-c-1','thandi.cele@example.co.za','Thandi Cele','$2b$10$Y38v.Tulpq4.uQnfgNYLJOsod9mlRqBMIvxdMXGc0PdqrvIW.DWTG','citizen','consumer','WE-2024-00421'),
('usr-c-2','wynand.engelbrecht@example.co.za','W. Engelbrecht','$2b$10$Y38v.Tulpq4.uQnfgNYLJOsod9mlRqBMIvxdMXGc0PdqrvIW.DWTG','citizen','consumer','WE-2024-00887'),
('usr-c-3','naledi.mokoena@example.co.za','Naledi Mokoena','$2b$10$Y38v.Tulpq4.uQnfgNYLJOsod9mlRqBMIvxdMXGc0PdqrvIW.DWTG','citizen','consumer','TSH-2025-00012'),
('usr-c-4','ravi.pillay@example.co.za','Ravi Pillay','$2b$10$Y38v.Tulpq4.uQnfgNYLJOsod9mlRqBMIvxdMXGc0PdqrvIW.DWTG','citizen','consumer','ETH-2024-00566'),
('usr-c-5','sipho.dlamini@example.co.za','Sipho Dlamini','$2b$10$Y38v.Tulpq4.uQnfgNYLJOsod9mlRqBMIvxdMXGc0PdqrvIW.DWTG','citizen','consumer','COJ-2024-01133');

-- Contact details for the seeded accounts (SA-format demo MSISDNs).
update billing.accounts set email = 'thandi.cele@example.co.za',        phone = '+27821110421' where account_number = 'WE-2024-00421';
update billing.accounts set email = 'wynand.engelbrecht@example.co.za', phone = '+27821110887' where account_number = 'WE-2024-00887';
update billing.accounts set email = 'ravi.pillay@example.co.za',        phone = '+27831110566' where account_number = 'ETH-2024-00566';
update billing.accounts set email = 'naledi.mokoena@example.co.za',     phone = '+27841110012' where account_number = 'TSH-2025-00012';
update billing.accounts set email = 'sipho.dlamini@example.co.za',      phone = '+27851111133' where account_number = 'COJ-2024-01133';
update billing.accounts set email = 't.dlamini@example.co.za',          phone = '+27861114209' where account_number = 'EKR-4401-209';

-- Municipal tariff book (SA-style residential/commercial rates, VAT 15%).
insert into billing.tariffs (code, description, electricity_per_kwh, water_per_kl, refuse_monthly, sewer_monthly, vat_rate) values
('RES-STD',  'Residential standard', 2.35, 28.50, 210.50, 185.00, 0.15),
('RES-PREM', 'Residential premium',  2.75, 32.00, 245.00, 210.00, 0.15),
('COM-STD',  'Commercial standard',  3.10, 41.20, 480.00, 390.00, 0.15);

-- Reading history: a previous + current reading per meter, so the billing
-- engine has a real consumption delta to price.
insert into metering.readings (meter_id, serial, reading, read_at) values
('mtr-1','MTR-TSH-007812',4300,'2026-06-08T06:00:00+00'),
('mtr-1','MTR-TSH-007812',4820,'2026-07-08T06:00:00+00'),
('mtr-2','MTR-WE-004421',11620,'2026-06-08T06:00:00+00'),
('mtr-2','MTR-WE-004421',12040,'2026-07-08T06:00:00+00'),
('mtr-3','MTR-WE-004887',794,'2026-06-08T06:00:00+00'),
('mtr-3','MTR-WE-004887',812,'2026-07-08T06:00:00+00'),
('mtr-4','MTR-ETH-009566',231,'2026-06-08T06:00:00+00'),
('mtr-4','MTR-ETH-009566',240,'2026-07-08T06:00:00+00'),
('mtr-5','MTR-COJ-011133',3210,'2026-06-08T06:00:00+00'),
('mtr-5','MTR-COJ-011133',3320,'2026-07-08T06:00:00+00');
