-- Nanocer — Step 2: hosted property pages + lead capture. Idempotent.

-- Leads captured from a listing's public page. Writes happen ONLY via the
-- service-role server action (no public insert policy); owners read their own.
create table if not exists public.leads (
    id          bigint generated always as identity primary key,
    listing_id  uuid not null references public.listings (id) on delete cascade,
    name        text,
    phone       text,
    email       text,
    message     text,
    source      text,          -- e.g. 'page' (later: which code/sign)
    created_at  timestamptz not null default now()
);
create index if not exists idx_leads_listing on public.leads (listing_id, created_at);

alter table public.leads enable row level security;

drop policy if exists "leads_select_own" on public.leads;
create policy "leads_select_own" on public.leads
    for select using (
        exists (
            select 1 from public.listings l
            where l.id = leads.listing_id and l.user_id = auth.uid()
        )
    );

drop policy if exists "leads_delete_own" on public.leads;
create policy "leads_delete_own" on public.leads
    for delete using (
        exists (
            select 1 from public.listings l
            where l.id = leads.listing_id and l.user_id = auth.uid()
        )
    );

-- Storage bucket for listing photos (public-read so the public page can show
-- them; per-user write folders listing-photos/<uid>/...).
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "listing_photos_public_read" on storage.objects;
create policy "listing_photos_public_read" on storage.objects
    for select using (bucket_id = 'listing-photos');

drop policy if exists "listing_photos_insert_own" on storage.objects;
create policy "listing_photos_insert_own" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "listing_photos_update_own" on storage.objects;
create policy "listing_photos_update_own" on storage.objects
    for update to authenticated
    using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "listing_photos_delete_own" on storage.objects;
create policy "listing_photos_delete_own" on storage.objects
    for delete to authenticated
    using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
