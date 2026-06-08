-- Nanocer — Portfolios: group listings (a portfolio = an owner / PM company that
-- runs several communities). One portfolio per listing. Additive + idempotent.

create table if not exists public.portfolios (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users (id) on delete cascade,
    name       text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_portfolios_user on public.portfolios (user_id);

drop trigger if exists trg_portfolios_updated_at on public.portfolios;
create trigger trg_portfolios_updated_at
    before update on public.portfolios
    for each row execute function public.set_updated_at();

alter table public.portfolios enable row level security;

drop policy if exists "portfolios_select_own" on public.portfolios;
create policy "portfolios_select_own" on public.portfolios
    for select using (user_id = auth.uid());
drop policy if exists "portfolios_insert_own" on public.portfolios;
create policy "portfolios_insert_own" on public.portfolios
    for insert with check (user_id = auth.uid());
drop policy if exists "portfolios_update_own" on public.portfolios;
create policy "portfolios_update_own" on public.portfolios
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "portfolios_delete_own" on public.portfolios;
create policy "portfolios_delete_own" on public.portfolios
    for delete using (user_id = auth.uid());

-- A listing belongs to at most one portfolio (null = Unassigned). Deleting a
-- portfolio un-assigns its listings rather than deleting them.
alter table public.listings
    add column if not exists portfolio_id uuid references public.portfolios (id) on delete set null;
create index if not exists idx_listings_portfolio on public.listings (portfolio_id);
