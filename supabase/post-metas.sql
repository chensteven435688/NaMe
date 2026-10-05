-- Folder names for articles, editorials, film, and shorts.
-- Separate from Editor's Exclusive (supabase/exclusive-metas.sql).
-- Run in the Supabase SQL editor.

create table if not exists public.post_metas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists post_metas_name_lower
  on public.post_metas (lower(name));

alter table public.post_metas enable row level security;

drop policy if exists "Post metas are public" on public.post_metas;
create policy "Post metas are public"
  on public.post_metas for select using (true);

drop policy if exists "Admins insert post metas" on public.post_metas;
create policy "Admins insert post metas"
  on public.post_metas for insert with check (public.is_admin());

drop policy if exists "Admins delete post metas" on public.post_metas;
create policy "Admins delete post metas"
  on public.post_metas for delete using (public.is_admin());

grant select on table public.post_metas to anon, authenticated;
grant insert, delete on table public.post_metas to authenticated;
