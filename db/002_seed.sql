insert into billing.accounts (id, account_number, consumer_name, municipality, erf_number, balance, status, tariff_code, created_at) values
('acc-1','WE-2024-00421','Thandi Cele','Ekurhuleni','ERF-40421',2130.5,'overdue','RES-STD','2024-02-11T00:00:00+00'),
('acc-2','WE-2024-00887','W. Engelbrecht','Ekurhuleni','ERF-40887',1380,'pending','RES-STD','2024-03-02T00:00:00+00'),
('acc-3','ETH-2024-00566','Ravi Pillay','eThekwini','ERF-90566',0,'paid','RES-PREM','2024-01-19T00:00:00+00'),
('acc-4','TSH-2025-00012','Naledi Mokoena','Tshwane','ERF-10012',640.25,'pending','RES-STD','2025-01-05T00:00:00+00'),
('acc-5','COJ-2024-01133','Sipho Dlamini','CoJ','ERF-71133',0,'paid','COM-STD','2024-06-30T00:00:00+00'),
('acc-6','EKR-4401-209','T. Dlamini','Ekurhuleni','ERF-44209',0,'paid','RES-STD','2024-05-14T00:00:00+00');

insert into billing.invoices (id, account_id, account_number, billing_period, issue_date, due_date, total_amount, amount_paid, status) values
('inv-1001','acc-1','WE-2024-00421','2026-05','2026-05-01','2026-05-25',2130.5,0,'overdue'),
('inv-1002','acc-2','WE-2024-00887','2026-05','2026-05-01','2026-05-25',1380,0,'pending'),
('inv-1003','acc-4','TSH-2025-00012','2026-05','2026-05-01','2026-05-25',640.25,0,'pending');

insert into billing.invoice_lines (invoice_id, description, category, quantity, unit_price, amount) values
('inv-1001','Electricity consumption','electricity',420,2.35,987),
('inv-1001','Water consumption','water',18,28.5,513),
('inv-1001','Refuse removal','refuse',1,210.5,210.5),
('inv-1001','Sewerage','sewer',1,420,420),
('inv-1002','Electricity consumption','electricity',310,2.35,728.5),
('inv-1002','Water consumption','water',12,28.5,342),
('inv-1002','Refuse removal','refuse',1,210.5,210.5),
('inv-1002','Sewerage','sewer',1,99,99),
('inv-1003','Water consumption','water',9,28.5,256.5),
('inv-1003','Rates & taxes','rates',1,383.75,383.75);

insert into billing.billing_runs (id, municipality, billing_period, started_at, completed_at, accounts_processed, total_billed, status) values
('BJ-2026-05-001','Ekurhuleni','2026-05','2026-05-01T05:00:00+00','2026-05-01T05:42:11+00',118420,84210300,'completed'),
('BJ-2026-05-002','Tshwane','2026-05','2026-05-01T07:00:00+00',null,62110,41200000,'running');

insert into payments.payment_methods (id, label, provider, status, tx_day, rev_day) values
('eft','EFT / Instant EFT','SwiftPay / NPS','active',142,248400),
('card','Visa / Mastercard','SwiftPay','active',284,311200),
('debi','DebiCheck','SwiftPay / PASA','active',8402,4201000),
('gpay','Google Pay','SwiftPay SDK','active',48,72400),
('apay','Apple Pay','SwiftPay SDK','active',32,58000),
('samsung','Samsung Pay','Samsung SDK','pending',0,0),
('capitec','Capitec Pay','Capitec API','active',210,189000),
('wapay','WhatsApp Pay','Meta WABA','review',0,0),
('ussd','USSD *120#','NexCore','active',1840,1920000);

insert into payments.transactions (ref, account_number, consumer_name, amount, gateway, method, status, erp_status, created_at) values
('SP-PAY-7403821','WE-2024-00421','Thandi Cele',1240.5,'SwiftPay','card','matched','posted','2026-07-08T08:14:00+00'),
('SP-PAY-9900312','WE-2024-00421','Thandi Cele',890,'SwiftPay','gpay','matched','posted','2026-07-08T08:15:00+00'),
('NX-PAY-9912044','WE-2024-00887','W. Engelbrecht',500,'xPayments','eft','suspense','pending','2026-07-08T07:55:00+00'),
('XP-PAY-3301122','COJ-2024-01133','Sipho Dlamini',620,'xPayments','apay','matched','posted','2026-07-07T23:41:00+00'),
('CAP-PAY-1100234','EKR-4401-209','T. Dlamini',1200,'CapitecPay','capitec','matched','posted','2026-07-08T11:03:00+00');

insert into payments.debicheck_mandates (id, account_number, consumer_name, amount, collection_day, status) values
('DC-0001','WE-2024-00421','Thandi Cele',1240.5,1,'active'),
('DC-0002','WE-2024-00887','W. Engelbrecht',890,15,'active'),
('DC-0003','TSH-2025-00012','Naledi Mokoena',640.25,25,'pending');

insert into metering.meters (id, serial, account_number, municipality, type, last_reading, last_reading_at, status) values
('mtr-1','MTR-TSH-007812','TSH-2025-00012','Tshwane','prepaid_electricity',4820,'2026-07-08T06:00:00+00','alert'),
('mtr-2','MTR-WE-004421','WE-2024-00421','Ekurhuleni','conventional_electricity',12040,'2026-07-08T06:00:00+00','normal'),
('mtr-3','MTR-WE-004887','WE-2024-00887','Ekurhuleni','water',812,'2026-07-08T06:00:00+00','fault'),
('mtr-4','MTR-ETH-009566','ETH-2024-00566','eThekwini','water',240,'2026-07-08T06:00:00+00','normal'),
('mtr-5','MTR-COJ-011133','COJ-2024-01133','CoJ','prepaid_electricity',3320,'2026-07-08T06:00:00+00','normal');

insert into metering.meter_faults (id, meter_id, serial, description, severity, status, reported_at) values
('flt-1','mtr-1','MTR-TSH-007812','520 kWh anomaly flagged — possible tamper','medium','dispatched','2026-07-08T08:15:00+00'),
('flt-2','mtr-3','MTR-WE-004887','Meter offline — no readings for 48h','high','dispatched','2026-07-08T08:55:00+00');

insert into comms.campaigns (id, name, type, status, sent, opened, clicked, paid, unpaid, created_at, municipality) values
('CMP-001','May 2026 Overdue Reminder','SMS','completed',18420,null,8210,3841,14579,'2026-05-01','Tshwane'),
('CMP-002','Water Tariff Increase Notice','Email','completed',42100,31200,18900,12400,29700,'2026-04-15','All'),
('CMP-003','Final Demand — 90+ Days','SMS','running',4200,null,2100,840,3360,'2026-05-18','eThekwini'),
('CMP-004','June Statement Dispatch','Email','scheduled',0,0,0,0,0,'2026-05-20','CoJ');

insert into comms.chat_sessions (id, user_name, account_number, intent, resolved, escalated, created_at) values
('CB-001','Thandi Cele','WE-2024-00421','payment_plan',true,false,'2026-07-08T09:14:00+00'),
('CB-002','W. Engelbrecht','WE-2024-00887','meter_fault',false,true,'2026-07-08T08:55:00+00'),
('CB-003','Ravi Pillay','ETH-2024-00566','dispute',true,false,'2026-07-08T08:41:00+00'),
('CB-004','Naledi Mokoena','TSH-2025-00012','balance_query',true,false,'2026-07-08T08:22:00+00'),
('CB-005','Sipho Dlamini','COJ-2024-01133','payment_options',true,false,'2026-07-08T08:10:00+00');

insert into compliance.integrations (id, name, category, status, endpoint, description) values
('conlog','Conlog','Metering','connected','api.conlog.co.za/v2','Prepaid STS meter management & token vending'),
('deeds','Deeds Registry','Compliance','connected','ws.deeds.go.za/soap','Property ownership verification via deeds.go.za'),
('macro','MacroComm','Comms','connected','api.macrocomm.co.za','Bulk SMS gateway — 10,000 msg/min'),
('sars','SARS','Compliance','review','secure.sars.gov.za','Tax clearance certificate verification'),
('treasury','Treasury','Finance','pending','api.treasury.gov.za','Government payment instruction & audit'),
('swiftpay','SwiftPay','Payments','connected','api.swiftpay.co.za','Card, EFT, DebiCheck, Google Pay, Apple Pay'),
('capitec','Capitec Pay','Payments','connected','api.capitecpay.co.za','Capitec bank real-time payment rail'),
('wapay','WhatsApp Pay','Payments','review','api.wa.business','WhatsApp Business payments via Meta'),
('samsung','Samsung Pay','Payments','pending','api.samsungpay.com','Samsung Pay tokenised payments'),
('hanis','HANIS','Identity','connected','api.dha.gov.za','SA ID biometric verification — Home Affairs'),
('credit','TransUnion','Credit','connected','api.transunion.co.za','Consumer credit bureau queries'),
('kafka','Apache Kafka','Infra','connected','kafka.internal:9092','Event streaming — metering & billing events');

insert into compliance.score (id, score) values (1, 74);

insert into compliance.frameworks (name, status, last_audited_at) values
('ISO27001','in_progress','2026-03-14'),
('POPIA','compliant','2026-05-02'),
('PCI-DSS','compliant','2026-06-01');
