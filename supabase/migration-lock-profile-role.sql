-- NaMe Magazine — prevent members from granting themselves admin (run once in Supabase SQL Editor)
--
-- Why: the "Users can update own profile" policy lets a signed-in member update ANY column on
-- their own row, including `role`. Because the browser talks to Supabase directly, a member could
-- run `update profiles set role = 'admin' where id = <their id>` from the devtools console and
-- unlock every admin capability (publishing posts, deleting users, storage writes).
--
-- Fix: keep the permissive self-update policy for normal profile fields, but block any change to
-- `role` unless the caller is already an admin. A trigger is used because Postgres RLS cannot
-- restrict individual columns.

create or replace function public.enforce_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- public.is_admin() reads the CURRENT caller's stored role, so a member escalating
    -- themselves is rejected here; existing admins and server-side jobs still pass.
    if auth.uid() is null or not public.is_admin() then
      raise exception 'Only an administrator can change a profile role'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_role_change on public.profiles;
create trigger profiles_enforce_role_change
  before update on public.profiles
  for each row
  execute function public.enforce_profile_role_change();

-- Verification (run as a normal member; it must fail with "Only an administrator..."):
--   update public.profiles set role = 'admin' where id = auth.uid();
