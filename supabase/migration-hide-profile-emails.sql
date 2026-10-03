-- NaMe Magazine — hide member emails from the public (run once in Supabase SQL Editor)
-- Deploy the updated auth.js first: older versions read profiles.email directly and break after this.
--
-- Why: "Profiles are viewable by everyone" exposes every row to anyone holding the publishable key,
-- and RLS cannot hide individual columns. Column-level privileges limit what anon/authenticated
-- can read; admins get private columns through the security-definer functions below, and members
-- read their own email from their auth session.

revoke select on table public.profiles from anon, authenticated;
grant select (id, display_name, avatar_url, signature, role, created_at)
  on table public.profiles to anon, authenticated;

-- Full profile list for the admin Users screen.
create or replace function public.admin_list_profiles()
returns setof public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query select * from public.profiles order by created_at desc;
end;
$$;

revoke execute on function public.admin_list_profiles() from public, anon;
grant execute on function public.admin_list_profiles() to authenticated;

-- Emails for a set of members, used by admin moderation views.
create or replace function public.admin_profile_emails(ids uuid[])
returns table (id uuid, email text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query select p.id, p.email from public.profiles p where p.id = any (ids);
end;
$$;

revoke execute on function public.admin_profile_emails(uuid[]) from public, anon;
grant execute on function public.admin_profile_emails(uuid[]) to authenticated;

-- Verification (run in SQL Editor):
--   set role anon; select email from public.profiles limit 1;  -- must fail: permission denied
--   reset role;
