-- Nanocer — Floor-plan pricing/availability sync. Lets an external source (a
-- PMS export, middleware, or a manual CSV/JSON import) feed pricing & availability
-- instead of hand-editing. Additive + idempotent; manual plans are untouched.
--
-- Safety model: a sync only ever writes the whitelisted columns (synced_fields)
-- of rows it owns (source='sync') and that are still sync_enabled. Manual rows
-- (source='manual', null external_id) are invisible to the merge.

alter table public.floor_plans
  add column if not exists source         text not null default 'manual',  -- 'manual' | 'sync'
  add column if not exists external_id    text,        -- stable id from the source system
  add column if not exists sync_enabled   boolean not null default true,   -- false = pin / stop syncing this row
  add column if not exists last_synced_at timestamptz,
  add column if not exists synced_fields  text[] not null default '{}';

-- A source row maps to exactly one plan per listing. Partial so manual rows
-- (null external_id) never collide and upsert-on-conflict is safe.
create unique index if not exists uq_floor_plans_listing_external
  on public.floor_plans (listing_id, external_id)
  where external_id is not null;

-- One sync config per listing.
create table if not exists public.listing_sync_sources (
    id             uuid primary key default gen_random_uuid(),
    listing_id     uuid not null unique references public.listings (id) on delete cascade,
    user_id        uuid not null references auth.users (id) on delete cascade,
    kind           text not null default 'webhook',   -- 'webhook' | 'csv_url' (later)
    enabled        boolean not null default true,
    webhook_secret text not null,                      -- inbound auth token
    feed_url       text,                               -- for scheduled pull (later)
    synced_fields  text[] not null default '{price,price_max,price_unit,availability,available_text}',
    last_synced_at timestamptz,
    last_status    text,                               -- 'ok' | 'partial' | 'error'
    last_error     text,
    last_row_count integer,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);
create index if not exists idx_listing_sync_sources_user on public.listing_sync_sources (user_id);

drop trigger if exists trg_listing_sync_sources_updated_at on public.listing_sync_sources;
create trigger trg_listing_sync_sources_updated_at
    before update on public.listing_sync_sources
    for each row execute function public.set_updated_at();

alter table public.listing_sync_sources enable row level security;

-- Owner-only. The inbound webhook reads/writes via the service-role admin client
-- (bypasses RLS), authenticated by the per-listing webhook_secret instead.
drop policy if exists "listing_sync_sources_select_own" on public.listing_sync_sources;
create policy "listing_sync_sources_select_own" on public.listing_sync_sources
    for select using (user_id = auth.uid());
drop policy if exists "listing_sync_sources_insert_own" on public.listing_sync_sources;
create policy "listing_sync_sources_insert_own" on public.listing_sync_sources
    for insert with check (user_id = auth.uid());
drop policy if exists "listing_sync_sources_update_own" on public.listing_sync_sources;
create policy "listing_sync_sources_update_own" on public.listing_sync_sources
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "listing_sync_sources_delete_own" on public.listing_sync_sources;
create policy "listing_sync_sources_delete_own" on public.listing_sync_sources
    for delete using (user_id = auth.uid());
