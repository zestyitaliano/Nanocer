-- Nanocer — Step 3: a code can target its listing's property page.
-- Resolution happens in increment_scan so the listing stays the single source of
-- truth (change the slug/page once, every sign follows). Idempotent.

-- target_mode: 'url' = fixed destination (today's behavior); 'listing_page' =
-- resolve to the code's listing's published page at scan time.
alter table public.codes
    add column if not exists target_mode text not null default 'url';

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'codes_target_mode_chk'
    ) then
        alter table public.codes
            add constraint codes_target_mode_chk
            check (target_mode in ('url', 'listing_page'));
    end if;
end $$;

-- Extend the redirect RPC. Returns either an absolute URL (url mode) or a
-- RELATIVE path like '/p/<slug>' (listing_page mode) — the /r route makes it
-- absolute against the request origin. Still logs the scan + bumps the count
-- atomically, and only when a target actually resolves (no target => 404, no log).
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
    c           record;
    v_target    text;
begin
    select co.is_dynamic, co.destination, co.target_mode,
           l.slug as listing_slug, l.page_enabled as listing_page_enabled
      into c
      from public.codes co
      left join public.listings l on l.id = co.listing_id
     where co.short_code = p_short_code;

    if not found or not c.is_dynamic then
        return null;
    end if;

    if c.target_mode = 'listing_page' then
        if c.listing_slug is not null and c.listing_page_enabled then
            v_target := '/p/' || c.listing_slug;       -- relative; route resolves
        else
            v_target := nullif(c.destination, '');      -- fallback if page not ready
        end if;
    else
        v_target := nullif(c.destination, '');
    end if;

    if v_target is null then
        return null;
    end if;

    insert into public.scan_events (short_code, user_agent, country)
    values (p_short_code, p_user_agent, p_country);

    update public.codes
       set scan_count = scan_count + 1
     where short_code = p_short_code;

    return v_target;
end;
$$;

revoke all on function public.increment_scan(text, text, text) from public;
grant execute on function public.increment_scan(text, text, text)
    to authenticated, service_role;
