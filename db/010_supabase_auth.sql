-- Supabase Auth migration — replaces the custom bcrypt+JWT scheme, which
-- can't run safely in a browser-only app (the JWT signing secret would sit
-- in client-side JS, readable by anyone).
--
-- UNLIKE 001-009, this migration touches Supabase-managed objects (the
-- `auth` schema, the `supabase_auth_admin`/`authenticated`/`anon` roles)
-- that don't exist on a bare Postgres instance — CI's ephemeral Postgres
-- and local dev without the Supabase CLI's local stack included. Every
-- Supabase-specific section below is guarded to no-op cleanly there,
-- rather than aborting the whole db/*.sql replay (caught in practice: CI
-- failed hard on `insert into auth.users` before this guard was added).

alter table platform.users add column if not exists auth_user_id uuid unique;

create extension if not exists pgcrypto;

-- Seeds auth.users + auth.identities for every existing platform.users row,
-- reusing the documented demo passwords (Citizen!2026 / Official!2026 /
-- Operator!2026). Idempotent — only touches rows not yet linked. No-ops if
-- the `auth` schema isn't present (not a Supabase-provisioned database).
do $$
declare
  r record;
  new_id uuid;
  pw text;
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'auth') then
    raise notice 'auth schema not present — skipping Supabase Auth user seeding (not a Supabase-provisioned Postgres)';
    return;
  end if;

  for r in select * from platform.users where auth_user_id is null loop
    pw := case r.persona
      when 'citizen' then 'Citizen!2026'
      when 'official' then 'Official!2026'
      when 'operator' then 'Operator!2026'
    end;
    new_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
      r.email, crypt(pw, gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
    values (
      gen_random_uuid(), new_id, new_id::text,
      jsonb_build_object('sub', new_id::text, 'email', r.email),
      'email', now(), now()
    );
    update platform.users set auth_user_id = new_id where id = r.id;
  end loop;
end $$;

-- Custom Access Token Hook: injects our platform's authorization claims
-- (persona, role, accountNumber, municipalityId) into every JWT Supabase
-- Auth issues — the same claims the old Express gateway used to forward as
-- x-user-* headers. Every RLS policy from db/011 onward keys off these
-- claims via auth.jwt(). Safe to create unconditionally — plpgsql function
-- bodies aren't checked against the catalog until first call, so this
-- doesn't require the `auth` schema to exist.
--
-- IMPORTANT — this function alone does nothing until it's wired up as the
-- active hook in the Supabase Dashboard: Authentication -> Hooks ->
-- "Customize Access Token (Auth) Hook" -> select
-- public.custom_access_token_hook. There is no API/CLI path to flip that
-- setting from outside the dashboard — a one-time manual step.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public, platform, pg_temp
as $$
declare
  claims jsonb;
  user_row platform.users%rowtype;
begin
  select * into user_row from platform.users where auth_user_id = (event->>'user_id')::uuid;
  claims := coalesce(event->'claims', '{}'::jsonb);
  if user_row.id is not null then
    claims := jsonb_set(claims, '{persona}', to_jsonb(user_row.persona));
    claims := jsonb_set(claims, '{role}', to_jsonb(user_row.role));
    if user_row.account_number is not null then
      claims := jsonb_set(claims, '{accountNumber}', to_jsonb(user_row.account_number));
    end if;
    if user_row.municipality_id is not null then
      claims := jsonb_set(claims, '{municipalityId}', to_jsonb(user_row.municipality_id));
    end if;
  end if;
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

revoke execute on function public.custom_access_token_hook from public;

-- Grants to Supabase-managed roles — no-op if they don't exist (bare
-- Postgres has no supabase_auth_admin/authenticated/anon roles).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant execute on function public.custom_access_token_hook to supabase_auth_admin';
    execute 'grant usage on schema platform to supabase_auth_admin';
    execute 'grant select on platform.users to supabase_auth_admin';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke execute on function public.custom_access_token_hook from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.custom_access_token_hook from anon';
  end if;
end $$;
