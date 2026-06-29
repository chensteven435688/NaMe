-- NaMe Magazine — explicit post write policies (run once in Supabase SQL Editor)
-- Fixes admin publish when the generic FOR ALL policy is not applied correctly.

drop policy if exists "Admins manage posts" on public.posts;

drop policy if exists "Admins insert posts" on public.posts;
create policy "Admins insert posts"
  on public.posts for insert to authenticated
  with check (public.is_admin());

drop policy if exists "Admins update posts" on public.posts;
create policy "Admins update posts"
  on public.posts for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins delete posts" on public.posts;
create policy "Admins delete posts"
  on public.posts for delete to authenticated
  using (public.is_admin());

grant insert, update, delete on table public.posts to authenticated;
