-- Nanocer — multiple photos per floor plan. Additive + idempotent.
alter table public.floor_plans
    add column if not exists photos text[] not null default '{}';

-- Seed the gallery from the existing single photo_url where present.
update public.floor_plans
   set photos = array[photo_url]
 where photo_url is not null
   and photo_url <> ''
   and (photos is null or photos = '{}');
