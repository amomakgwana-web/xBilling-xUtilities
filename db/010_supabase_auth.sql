-- Supabase Auth migration — replaces the custom bcrypt+JWT scheme, which
-- can't run safely in a browser-only app (the JWT signing secret would sit
-- in client-side JS, readable by anyone).
--
-- UNLIKE 001-009, this migration is Supabase-specific and will NOT apply to
-- a bare local Postgres instance — it depends on the `auth` schema Supabase
-- provisions (auth.users, auth.identities, the supabase_auth_admin role).
-- Local development without the Supabase CLI's local stack should keep
-- using the pre-existing seeded platform.users rows directly.

alter table platform.users add column if not exists auth_user_id uuid unique;

create extension if not exists pgcrypto;

-- Seeds auth.users + auth.identities for every existing platform.users row,
-- reusing the documented demo passwords (Citizen!2026 / Official!2026 /
-- Operator!2026). Idempotent — only touches rows not yet linked.
do $$
declare
  r record;
  new_id uuid;
  pw text;
begin
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
-- claims via auth.jwt().
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

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
grant usage on schema platform to supabase_auth_admin;
grant select on platform.users to supabase_auth_admin;
