-- Nanocer — folders for organizing QR codes. Idempotent.

create table if not exists public.folders (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users (id) on delete cascade,
    name       text not null,
    created_at timestamptz not null default now()
);
create index if not exists idx_folders_user on public.folders (user_id);

-- A code may belong to one folder. Deleting a folder un-files its codes
-- (folder_id -> null) rather than deleting them.
alter table public.codes
    add column if not exists folder_id uuid references public.folders (id) on delete set null;
create index if not exists idx_codes_folder on public.codes (folder_id);

-- RLS: owner-only, mirroring the codes_*_own policies.
alter table public.folders enable row level security;

drop policy if exists "folders_select_own" on public.folders;
create policy "folders_select_own" on public.folders
    for select using (user_id = auth.uid());

drop policy if exists "folders_insert_own" on public.folders;
create policy "folders_insert_own" on public.folders
    for insert with check (user_id = auth.uid());

drop policy if exists "folders_update_own" on public.folders;
create policy "folders_update_own" on public.folders
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "folders_delete_own" on public.folders;
create policy "folders_delete_own" on public.folders
    for delete using (user_id = auth.uid());
