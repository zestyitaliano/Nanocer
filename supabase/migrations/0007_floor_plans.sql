-- Nanocer — floor plans become a first-class table so a QR code can target a
-- specific unit (true per-plan scan analytics). Backfills the legacy
-- page_config.plans jsonb. Idempotent.

create table if not exists public.floor_plans (
    id             uuid primary key default gen_random_uuid(),
    listing_id     uuid not null references public.listings (id) on delete cascade,
    user_id        uuid not null references auth.users (id) on delete cascade,
    name           text not null default '',
    beds           numeric,
    baths          numeric,
    sqft           numeric,
    price          numeric,          -- "from" price (low end of a range)
    price_max      numeric,          -- optional range upper bound
    price_unit     text not null default 'unit',   -- 'unit' | 'bed' (student)
    availability   text not null default 'available', -- available|waitlist|unavailable
    available_text text,
    photo_url      text,
    description    text,
    tags           text[] not null default '{}',
    cta            jsonb,
    sort_order     integer not null default 0,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);
create index if not exists idx_floor_plans_listing on public.floor_plans (listing_id, sort_order);
create index if not exists idx_floor_plans_user on public.floor_plans (user_id);

drop trigger if exists trg_floor_plans_updated_at on public.floor_plans;
create trigger trg_floor_plans_updated_at
    before update on public.floor_plans
    for each row execute function public.set_updated_at();

-- RLS — owner-only. The public property page reads plans via the service-role
-- admin client (same as it reads the listing), so no public policy is needed.
alter table public.floor_plans enable row level security;

drop policy if exists "floor_plans_select_own" on public.floor_plans;
create policy "floor_plans_select_own" on public.floor_plans
    for select using (user_id = auth.uid());
drop policy if exists "floor_plans_insert_own" on public.floor_plans;
create policy "floor_plans_insert_own" on public.floor_plans
    for insert with check (user_id = auth.uid());
drop policy if exists "floor_plans_update_own" on public.floor_plans;
create policy "floor_plans_update_own" on public.floor_plans
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "floor_plans_delete_own" on public.floor_plans;
create policy "floor_plans_delete_own" on public.floor_plans
    for delete using (user_id = auth.uid());

-- codes: a code can now target a specific floor plan.
alter table public.codes
    add column if not exists floor_plan_id uuid references public.floor_plans (id) on delete set null;
create index if not exists idx_codes_floor_plan on public.codes (floor_plan_id);

alter table public.codes drop constraint if exists codes_target_mode_chk;
alter table public.codes
    add constraint codes_target_mode_chk
    check (target_mode in ('url', 'listing_page', 'floor_plan'));

-- Backfill: legacy page_config.plans (or quiz.plans) jsonb -> floor_plans rows.
-- Only for listings that have none yet (idempotent). New ids (old ones were
-- non-uuid strings); codes don't reference plans until this migration.
insert into public.floor_plans
    (listing_id, user_id, name, beds, baths, sqft, price, price_max, price_unit,
     availability, available_text, photo_url, description, tags, cta, sort_order)
select
    l.id, l.user_id,
    coalesce(p->>'name', ''),
    nullif(p->>'beds', '')::numeric,
    nullif(p->>'baths', '')::numeric,
    nullif(p->>'sqft', '')::numeric,
    nullif(p->>'price', '')::numeric,
    nullif(p->>'price_max', '')::numeric,
    coalesce(nullif(p->>'price_unit', ''), 'unit'),
    coalesce(nullif(p->>'availability', ''), 'available'),
    nullif(p->>'available_text', ''),
    nullif(p->>'photo_url', ''),
    nullif(p->>'description', ''),
    coalesce(
        (select array_agg(tg) from jsonb_array_elements_text(coalesce(p->'tags', '[]'::jsonb)) tg),
        '{}'::text[]
    ),
    case when jsonb_typeof(p->'cta') = 'object' then p->'cta' else null end,
    (ord - 1)::int
from public.listings l
cross join lateral jsonb_array_elements(
    coalesce(l.page_config->'plans', l.page_config->'quiz'->'plans', '[]'::jsonb)
) with ordinality as t(p, ord)
where jsonb_typeof(coalesce(l.page_config->'plans', l.page_config->'quiz'->'plans', '[]'::jsonb)) = 'array'
  and not exists (select 1 from public.floor_plans fp where fp.listing_id = l.id);

-- Extend the redirect RPC to resolve floor-plan-targeted codes to the unit's
-- anchor on the property page. (Replaces the 0006 version.)
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
    c        record;
    v_target text;
begin
    select co.is_dynamic, co.destination, co.target_mode, co.floor_plan_id,
           l.slug as listing_slug, l.page_enabled as listing_page_enabled
      into c
      from public.codes co
      left join public.listings l on l.id = co.listing_id
     where co.short_code = p_short_code;

    if not found or not c.is_dynamic then
        return null;
    end if;

    if c.target_mode = 'floor_plan' then
        if c.listing_slug is not null and c.listing_page_enabled then
            v_target := '/p/' || c.listing_slug
                || case when c.floor_plan_id is not null
                        then '#fp-' || c.floor_plan_id::text else '' end;
        else
            v_target := nullif(c.destination, '');
        end if;
    elsif c.target_mode = 'listing_page' then
        if c.listing_slug is not null and c.listing_page_enabled then
            v_target := '/p/' || c.listing_slug;
        else
            v_target := nullif(c.destination, '');
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
