-- Nanocer — Hosted property pages: leads, floor plans, public read, media bucket.
-- A Listing can publish a public page at /p/<slug> (page_enabled). The page is
-- anonymous: visitors read enabled listings + their floor plans, and submit a
-- lead only through submit_lead() (security definer) — the leads table itself
-- has no INSERT policy, exactly like scan_events, so leads can't be forged.
-- Idempotent: safe to paste into the Supabase SQL editor or run via the CLI.

-- ---------------------------------------------------------------------------
-- leads — captured from the public page's questionnaire / contact form.
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
    id          uuid primary key default gen_random_uuid(),
    listing_id  uuid not null references public.listings (id) on delete cascade,
    name        text,
    email       text,
    phone       text,
    message     text,
    answers     jsonb not null default '{}'::jsonb,  -- questionnaire answers + recommended plan
    created_at  timestamptz not null default now()
);

create index if not exists idx_leads_listing
    on public.leads (listing_id, created_at desc);

alter table public.leads enable row level security;

-- Owner may READ leads for their own listings. There is deliberately NO insert
-- policy — leads are only ever written by submit_lead() below, so an anonymous
-- visitor cannot forge rows or write to arbitrary listings.
drop policy if exists "leads_select_own" on public.leads;
create policy "leads_select_own" on public.leads
    for select using (
        exists (
            select 1 from public.listings l
            where l.id = leads.listing_id
              and l.user_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- floor_plans — units a listing offers; the questionnaire ranks these.
-- user_id is denormalized so owner write policies are a cheap auth.uid() check
-- (matching codes/listings), not a subquery on every write.
-- ---------------------------------------------------------------------------
create table if not exists public.floor_plans (
    id          uuid primary key default gen_random_uuid(),
    listing_id  uuid not null references public.listings (id) on delete cascade,
    user_id     uuid not null references auth.users (id) on delete cascade,
    name        text not null default '',
    beds        numeric,
    baths       numeric,
    sqft        numeric,
    price       numeric,
    available   boolean not null default true,
    image_url   text,
    description text,
    sort_order  integer not null default 0,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists idx_floor_plans_listing
    on public.floor_plans (listing_id, sort_order);

drop trigger if exists trg_floor_plans_updated_at on public.floor_plans;
create trigger trg_floor_plans_updated_at
    before update on public.floor_plans
    for each row execute function public.set_updated_at();

alter table public.floor_plans enable row level security;

-- Owner sees all their plans; the public sees plans of enabled listings.
drop policy if exists "floor_plans_select_public" on public.floor_plans;
create policy "floor_plans_select_public" on public.floor_plans
    for select using (
        user_id = auth.uid()
        or exists (
            select 1 from public.listings l
            where l.id = floor_plans.listing_id
              and l.page_enabled = true
        )
    );

drop policy if exists "floor_plans_insert_own" on public.floor_plans;
create policy "floor_plans_insert_own" on public.floor_plans
    for insert with check (user_id = auth.uid());

drop policy if exists "floor_plans_update_own" on public.floor_plans;
create policy "floor_plans_update_own" on public.floor_plans
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "floor_plans_delete_own" on public.floor_plans;
create policy "floor_plans_delete_own" on public.floor_plans
    for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- listings — additive public-read for enabled pages. Postgres ORs permissive
-- SELECT policies, so the existing owner-only policy still applies; this just
-- also lets anyone read a listing whose page is published.
-- NOTE: the public page MUST select an explicit safe column list (never *,
-- never user_id) — RLS is row-level, not column-level.
-- ---------------------------------------------------------------------------
drop policy if exists "listings_select_public" on public.listings;
create policy "listings_select_public" on public.listings
    for select using (page_enabled = true or user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- submit_lead — the only way the public page writes a lead. Resolves the
-- listing by slug (the client never handles internal UUIDs), requires the page
-- to be enabled, requires at least one contact channel, trims + length-caps
-- inputs. SECURITY DEFINER so it runs above RLS; granted to anon.
-- ---------------------------------------------------------------------------
create or replace function public.submit_lead(
    p_slug    text,
    p_name    text default null,
    p_email   text default null,
    p_phone   text default null,
    p_message text default null,
    p_answers jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_listing_id uuid;
    v_lead_id    uuid;
begin
    select id into v_listing_id
      from public.listings
     where slug = p_slug and page_enabled = true;

    if not found then
        raise exception 'listing not available';
    end if;

    if coalesce(nullif(trim(p_email), ''), nullif(trim(p_phone), '')) is null then
        raise exception 'a contact email or phone is required';
    end if;

    insert into public.leads (listing_id, name, email, phone, message, answers)
    values (
        v_listing_id,
        left(nullif(trim(p_name), ''), 200),
        left(nullif(trim(p_email), ''), 320),
        left(nullif(trim(p_phone), ''), 50),
        left(nullif(trim(p_message), ''), 4000),
        coalesce(p_answers, '{}'::jsonb)
    )
    returning id into v_lead_id;

    return v_lead_id;
end;
$$;

-- Public page is unauthenticated, so anon needs EXECUTE (unlike increment_scan).
revoke all on function public.submit_lead(text, text, text, text, text, jsonb) from public;
grant execute on function public.submit_lead(text, text, text, text, text, jsonb)
    to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage — listing-media bucket for gallery photos + floor-plan images.
-- Public-read (served via CDN); writes scoped to listing-media/<uid>/...
-- Mirrors the logos bucket in 0002_storage.sql.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('listing-media', 'listing-media', true)
on conflict (id) do update set public = true;

drop policy if exists "listing_media_public_read" on storage.objects;
create policy "listing_media_public_read" on storage.objects
    for select using (bucket_id = 'listing-media');

drop policy if exists "listing_media_insert_own" on storage.objects;
create policy "listing_media_insert_own" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'listing-media'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "listing_media_update_own" on storage.objects;
create policy "listing_media_update_own" on storage.objects
    for update to authenticated
    using (
        bucket_id = 'listing-media'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "listing_media_delete_own" on storage.objects;
create policy "listing_media_delete_own" on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'listing-media'
        and (storage.foldername(name))[1] = auth.uid()::text
    );
