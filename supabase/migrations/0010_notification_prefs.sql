-- Nanocer — Notification preferences: per-user settings for lead alerts. The
-- notify path (service-role) reads these to decide where/whether to send when a
-- lead is captured. Additive + idempotent; no existing flow depends on it.

create table if not exists public.notification_prefs (
    user_id       uuid primary key references auth.users (id) on delete cascade,
    email_enabled boolean not null default true,
    email_to      text,            -- null = fall back to the user's auth email
    sms_enabled   boolean not null default false,
    sms_to        text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

drop trigger if exists trg_notification_prefs_updated_at on public.notification_prefs;
create trigger trg_notification_prefs_updated_at
    before update on public.notification_prefs
    for each row execute function public.set_updated_at();

alter table public.notification_prefs enable row level security;

-- Owner-only: a user reads/writes only their own row. The notify path uses the
-- service-role client (bypasses RLS), so no public policy is needed there.
drop policy if exists "notification_prefs_select_own" on public.notification_prefs;
create policy "notification_prefs_select_own" on public.notification_prefs
    for select using (user_id = auth.uid());
drop policy if exists "notification_prefs_insert_own" on public.notification_prefs;
create policy "notification_prefs_insert_own" on public.notification_prefs
    for insert with check (user_id = auth.uid());
drop policy if exists "notification_prefs_update_own" on public.notification_prefs;
create policy "notification_prefs_update_own" on public.notification_prefs
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
