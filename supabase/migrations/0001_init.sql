-- Nanocer — core schema, RLS, and the redirect RPC.
-- Idempotent: safe to paste into the Supabase SQL editor or run via the CLI.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per QR code. Dynamic codes encode a redirect URL (/r/<short_code>)
-- whose `destination` is editable anytime; static codes encode `content`.
create table if not exists public.codes (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users (id) on delete cascade,
    short_code  text not null unique,
    title       text not null default '',
    is_dynamic  boolean not null default true,
    destination text not null default '',   -- dynamic: live redirect target
    content     text not null default '',   -- static: literal encoded payload
    style       jsonb not null default '{}'::jsonb,
    scan_count  integer not null default 0,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists idx_codes_user on public.codes (user_id);

-- One row per scan, for time-series analytics. Cascade-deletes with its code.
create table if not exists public.scan_events (
    id          bigint generated always as identity primary key,
    short_code  text not null references public.codes (short_code) on delete cascade,
    scanned_at  timestamptz not null default now(),
    user_agent  text,
    country     text
);

create index if not exists idx_scan_events_code
    on public.scan_events (short_code, scanned_at);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_codes_updated_at on public.codes;
create trigger trg_codes_updated_at
    before update on public.codes
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.codes        enable row level security;
alter table public.scan_events  enable row level security;

-- codes: an authenticated user may only touch their own rows.
drop policy if exists "codes_select_own" on public.codes;
create policy "codes_select_own" on public.codes
    for select using (user_id = auth.uid());

drop policy if exists "codes_insert_own" on public.codes;
create policy "codes_insert_own" on public.codes
    for insert with check (user_id = auth.uid());

drop policy if exists "codes_update_own" on public.codes;
create policy "codes_update_own" on public.codes
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "codes_delete_own" on public.codes;
create policy "codes_delete_own" on public.codes
    for delete using (user_id = auth.uid());

-- scan_events: owners can READ their own code's scans. There is deliberately NO
-- insert policy — scans are only ever written by the security-definer RPC below,
-- so clients cannot forge scan counts.
drop policy if exists "scan_events_select_own" on public.scan_events;
create policy "scan_events_select_own" on public.scan_events
    for select using (
        exists (
            select 1 from public.codes c
            where c.short_code = scan_events.short_code
              and c.user_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- Redirect RPC — one round-trip: validate, log the scan, bump the count, and
-- return the destination. SECURITY DEFINER so it runs above RLS. Called by the
-- Vercel redirect route using the service-role key.
-- ---------------------------------------------------------------------------
create or replace function public.increment_scan(
    p_short_code text,
    p_user_agent text default null,
    p_country    text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_dest    text;
    v_dynamic boolean;
begin
    select destination, is_dynamic
      into v_dest, v_dynamic
      from public.codes
     where short_code = p_short_code;

    if not found or not v_dynamic or v_dest is null or v_dest = '' then
        return null;   -- unknown / static / no destination set
    end if;

    insert into public.scan_events (short_code, user_agent, country)
    values (p_short_code, p_user_agent, p_country);

    update public.codes
       set scan_count = scan_count + 1
     where short_code = p_short_code;

    return v_dest;
end;
$$;

-- Execute granted to authenticated + service_role only (NOT anon): the public
-- redirect route runs server-side with the service-role key.
revoke all on function public.increment_scan(text, text, text) from public;
grant execute on function public.increment_scan(text, text, text)
    to authenticated, service_role;
