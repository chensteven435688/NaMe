-- NaMe Magazine — admin panel policies (run once in Supabase SQL Editor)
-- Enables role changes, user deletion, and profile management from the admin UI on Vercel.

-- Admins can update any profile (e.g. promote/demote role)
drop policy if exists "Admins update any profile" on public.profiles;
create policy "Admins update any profile"
  on public.profiles for update using (public.is_admin());

grant delete on table public.profiles to authenticated;

drop policy if exists "Admins delete profiles" on public.profiles;
create policy "Admins delete profiles"
  on public.profiles for delete using (public.is_admin());

-- Remove auth user + profile (cascade). Callable only by admins.
create or replace function public.admin_delete_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  if target_id = auth.uid() then
    raise exception 'Cannot delete your own account';
  end if;
  delete from auth.users where id = target_id;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;
