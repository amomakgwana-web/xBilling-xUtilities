-- Missed in db/011: comms.chat_sessions has no write path anywhere in the
-- platform (chatbot.ts only ever exposed GET /sessions and GET /stats —
-- the table is populated by seed data only), and CommandCentre's "Chatbot
-- Sessions" KPI reads it. db/011 left it deliberately unreadable on the
-- assumption an Edge Function would be the only consumer, but no such
-- function exists — same staff-only, unfiltered access chatbot.ts always
-- gave any admin/service caller.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'authenticated role not present — skipping chat_sessions read setup (not a Supabase-provisioned Postgres)';
    return;
  end if;

  execute $sql$
    create policy staff_read on comms.chat_sessions for select to authenticated
    using (public.jwt_persona() in ('official', 'operator'))
  $sql$;
  execute 'grant select on comms.chat_sessions to authenticated';
end $$;

create or replace view public.chat_sessions with (security_invoker = true) as
select id, user_name as "user", account_number as "accountNumber", intent, resolved, escalated, created_at as "createdAt"
from comms.chat_sessions;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on public.chat_sessions to authenticated';
  end if;
end $$;
