-- Nanocer — Team roles + lead escalation. Keeps single-owner (user_id) intact
-- and layers portfolio-scoped membership on top: a lead's listing → portfolio →
-- members. Lead access extends to members; an SLA timer escalates uncontacted
-- leads to senior staff. Additive; behavior is identical for listings with no
-- portfolio/members.

do $$ begin
  create type public.team_role as enum
    ('leasing_agent', 'senior_staff', 'property_manager');
exception when duplicate_object then null; end $$;

create table if not exists public.portfolio_members (
    portfolio_id uuid not null references public.portfolios (id) on delete cascade,
    user_id      uuid not null references auth.users (id) on delete cascade,
    role         public.team_role not null default 'leasing_agent',
    created_at   timestamptz not null default now(),
    primary key (portfolio_id, user_id)
);

alter table public.portfolio_members enable row level security;

-- The portfolio owner manages members; a member can see their own membership.
drop policy if exists "pm_owner_all" on public.portfolio_members;
create policy "pm_owner_all" on public.portfolio_members
    for all using (
        exists (select 1 from public.portfolios p
                where p.id = portfolio_members.portfolio_id and p.user_id = auth.uid())
    ) with check (
        exists (select 1 from public.portfolios p
                where p.id = portfolio_members.portfolio_id and p.user_id = auth.uid())
    );
drop policy if exists "pm_self_select" on public.portfolio_members;
create policy "pm_self_select" on public.portfolio_members
    for select using (user_id = auth.uid());

-- Central access gate: owner OR a member of the listing's portfolio. Used by the
-- leads policies below. SECURITY DEFINER + STABLE; references only intended tables.
create or replace function public.can_access_listing(l_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.listings l
    where l.id = l_id and (
      l.user_id = auth.uid()
      or exists (
        select 1 from public.portfolio_members m
        where m.portfolio_id = l.portfolio_id and m.user_id = auth.uid()
      )
    )
  );
$$;

-- Extend lead access from owner-only to owner-or-member. Replaces the 0005
-- select and 0011 update policies.
drop policy if exists "leads_select_own" on public.leads;
drop policy if exists "leads_select_team" on public.leads;
create policy "leads_select_team" on public.leads
    for select using (public.can_access_listing(leads.listing_id));

drop policy if exists "leads_update_own" on public.leads;
drop policy if exists "leads_update_team" on public.leads;
create policy "leads_update_team" on public.leads
    for update using (public.can_access_listing(leads.listing_id))
            with check (public.can_access_listing(leads.listing_id));

-- Escalation bookkeeping.
alter table public.leads
    add column if not exists escalated_at timestamptz,
    add column if not exists escalated_to uuid references auth.users (id) on delete set null;

-- Per-portfolio SLA window (minutes) before an uncontacted lead escalates.
alter table public.portfolios
    add column if not exists escalation_sla_minutes integer not null default 240;

-- ---------------------------------------------------------------------------
-- Scheduling the escalation sweep (manual, run once in the Supabase dashboard).
-- The sweep itself lives in the web app at POST /api/escalate (guarded by
-- CRON_SECRET). Enable the extensions, then schedule pg_net to call it. Replace
-- <SITE_URL> and <CRON_SECRET> with your values.
--
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--
--   select cron.schedule('nanocer-escalate', '*/15 * * * *', $$
--     select net.http_post(
--       url     := '<SITE_URL>/api/escalate',
--       headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
--     );
--   $$);
--
-- Alternatively, use Vercel Cron (vercel.json) to hit the same route.
-- ---------------------------------------------------------------------------
