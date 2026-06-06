-- Nanocer — Storage bucket for centre-logo images.
-- Public-read so generated QR images can embed the logo by URL; writes are
-- scoped to each user's own folder (logos/<uid>/...). Idempotent.

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = true;

-- Anyone may read logo objects (bucket is public / served via CDN).
drop policy if exists "logos_public_read" on storage.objects;
create policy "logos_public_read" on storage.objects
    for select using (bucket_id = 'logos');

-- Authenticated users may upload/modify/delete only within their own uid folder.
drop policy if exists "logos_insert_own" on storage.objects;
create policy "logos_insert_own" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'logos'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "logos_update_own" on storage.objects;
create policy "logos_update_own" on storage.objects
    for update to authenticated
    using (
        bucket_id = 'logos'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "logos_delete_own" on storage.objects;
create policy "logos_delete_own" on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'logos'
        and (storage.foldername(name))[1] = auth.uid()::text
    );
