-- Nanocer — Listings replace Folders.
-- A Listing is a property: it groups codes, owns a hosted page, carries a status,
-- and rolls up analytics. This migrates existing folders into listings and
-- rewires codes.folder_id -> codes.listing_id. Safe to re-run.

create table if not exists public.listings (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references auth.users (id) on delete cascade,
    name         text not null default '',
    -- coming_soon | active | under_contract | sold | other
    status       text not null default 'active',
    address      text,
    price        numeric,
    beds         numeric,
    baths        numeric,
    sqft         numeric,
    description  text,
    slug         text unique,            -- public page path /p/<slug> (set in Step 2)
    template     text not null default 'property',
    page_enabled boolean not null default false,
    page_config  jsonb not null default '{}'::jsonb,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index if not exists idx_listings_user on public.listings (user_id);

-- codes gain a listing_id (nullable = unassigned / "General").
alter table public.codes
    add column if not exists listing_id uuid references public.listings (id) on delete set null;
create index if not exists idx_codes_listing on public.codes (listing_id);

-- One-time migration from the old folders table, if it still exists. Preserve
-- folder ids as listing ids so codes.folder_id maps straight to listing_id.
do $$
begin
    if exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'folders'
    ) then
        insert into public.listings (id, user_id, name, status, created_at, updated_at)
        select id, user_id, name, 'other', created_at, now()
          from public.folders
        on conflict (id) do nothing;

        update public.codes
           set listing_id = folder_id
         where folder_id is not null and listing_id is null;
    end if;
end $$;

-- NOTE: we intentionally do NOT drop the old `folders` table or
-- `codes.folder_id` here. Leaving them keeps the previously-deployed dashboard
-- working during the deploy window (zero-downtime). The new app ignores them.
-- A later optional migration (0005) can drop them once the new app is live.

-- updated_at trigger (reuse set_updated_at from 0001_init.sql)
drop trigger if exists trg_listings_updated_at on public.listings;
create trigger trg_listings_updated_at
    before update on public.listings
    for each row execute function public.set_updated_at();

-- RLS — owner-only (mirrors codes_*_own).
alter table public.listings enable row level security;

drop policy if exists "listings_select_own" on public.listings;
create policy "listings_select_own" on public.listings
    for select using (user_id = auth.uid());

drop policy if exists "listings_insert_own" on public.listings;
create policy "listings_insert_own" on public.listings
    for insert with check (user_id = auth.uid());

drop policy if exists "listings_update_own" on public.listings;
create policy "listings_update_own" on public.listings
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "listings_delete_own" on public.listings;
create policy "listings_delete_own" on public.listings
    for delete using (user_id = auth.uid());
