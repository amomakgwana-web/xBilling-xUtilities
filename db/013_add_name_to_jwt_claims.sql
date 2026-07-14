-- Stage D needs a display name for the signed-in user (the top-right "Hi,
-- <name>" the old gateway's /auth/login response used to return alongside
-- the JWT) and there's no RLS policy on platform.users granting
-- `authenticated` read access to it (db/011 deliberately left it
-- unreadable — legacy password hashes live there). Cheaper to add one more
-- claim to the token than to carve out a narrower read policy just for a
-- name. CREATE OR REPLACE on the same hook from db/010 — no new dashboard
-- step, the hook is already wired up.
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
    claims := jsonb_set(claims, '{name}', to_jsonb(user_row.name));
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
