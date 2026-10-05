-- Editor's Exclusive meta folders.
-- Run in the Supabase SQL editor after supabase/schema.sql.

create table if not exists public.exclusive_metas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists exclusive_metas_name_lower
  on public.exclusive_metas (lower(name));

alter table public.exclusive_metas enable row level security;

drop policy if exists "Exclusive metas are public" on public.exclusive_metas;
create policy "Exclusive metas are public"
  on public.exclusive_metas for select using (true);

drop policy if exists "Admins insert exclusive metas" on public.exclusive_metas;
create policy "Admins insert exclusive metas"
  on public.exclusive_metas for insert with check (public.is_admin());

drop policy if exists "Admins delete exclusive metas" on public.exclusive_metas;
create policy "Admins delete exclusive metas"
  on public.exclusive_metas for delete using (public.is_admin());

grant select on table public.exclusive_metas to anon, authenticated;
grant insert, delete on table public.exclusive_metas to authenticated;
