-- Tariffs were a flat rate table keyed by code — change a rate today and
-- every past billing run's numbers become unexplainable, since nothing
-- recorded which rate was actually in force when. Municipal tariffs change
-- annually by regulation; this makes each code effective-dated instead of
-- singular, so billing-runs.ts picks the row that was actually valid on the
-- invoice's issue date.

alter table billing.tariffs drop constraint tariffs_pkey;

alter table billing.tariffs
  add column id bigint generated always as identity,
  add column valid_from date,
  add column valid_to date;

-- Existing rows have been in force since before any seed data was billed.
update billing.tariffs set valid_from = '2020-01-01' where valid_from is null;

alter table billing.tariffs
  alter column valid_from set not null,
  add primary key (id),
  add constraint tariffs_code_valid_from_key unique (code, valid_from);

create index if not exists tariffs_code_valid_from_idx on billing.tariffs (code, valid_from desc);
