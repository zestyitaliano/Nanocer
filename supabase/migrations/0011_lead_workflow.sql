-- Nanocer — Lead workflow: status pipeline + assignment + follow-up timestamps.
-- All columns are additive with defaults, so the existing service-role insert
-- (which omits them) keeps working unchanged. Adds the first UPDATE policy on
-- leads (owners only) so the dashboard can mark contacted / change status.

do $$ begin
  create type public.lead_status as enum
    ('uncontacted', 'contacted', 'touring', 'applied', 'leased', 'lost');
exception when duplicate_object then null; end $$;

alter table public.leads
  add column if not exists status             public.lead_status not null default 'uncontacted',
  add column if not exists assigned_to        uuid references auth.users (id) on delete set null,
  add column if not exists contacted_at       timestamptz,
  add column if not exists status_updated_at  timestamptz not null default now(),
  add column if not exists notes              text;

-- status_updated_at is the SLA clock the escalation phase reads.
create index if not exists idx_leads_status   on public.leads (status, status_updated_at);
create index if not exists idx_leads_assigned on public.leads (assigned_to);

-- Owners can update their own leads. Mirrors the listings-join used by the
-- existing select/delete policies exactly.
drop policy if exists "leads_update_own" on public.leads;
create policy "leads_update_own" on public.leads
    for update using (
        exists (
            select 1 from public.listings l
            where l.id = leads.listing_id and l.user_id = auth.uid()
        )
    ) with check (
        exists (
            select 1 from public.listings l
            where l.id = leads.listing_id and l.user_id = auth.uid()
        )
    );
