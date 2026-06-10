-- NaMe Magazine — newsletter opt-in (run once in Supabase SQL Editor)
-- Stores "I want to subscribe" from Join + emails from the Subscribe page.

-- 1) Column on profiles (registered members who checked the box at signup)
alter table public.profiles
  add column if not exists newsletter_opt_in boolean not null default false;

-- 2) Standalone emails from subscribe.html (no account required)
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_id uuid references public.profiles (id) on delete set null,
  source text not null default 'subscribe_page'
    check (source in ('subscribe_page', 'join', 'admin')),
  opted_in boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_newsletter_subscribers_opted
  on public.newsletter_subscribers (opted_in, created_at desc);

-- 3) Copy newsletter_opt_in from signup metadata into profiles
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role, newsletter_opt_in)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'member',
    coalesce((new.raw_user_meta_data ->> 'newsletter_opt_in')::boolean, false)
  );
  return new;
end;
$$;

-- 4) Row Level Security
alter table public.newsletter_subscribers enable row level security;

drop policy if exists "Anyone can subscribe" on public.newsletter_subscribers;
create policy "Anyone can subscribe"
  on public.newsletter_subscribers for insert
  with check (true);

drop policy if exists "Admins read newsletter list" on public.newsletter_subscribers;
create policy "Admins read newsletter list"
  on public.newsletter_subscribers for select
  using (public.is_admin());

drop policy if exists "Admins manage newsletter list" on public.newsletter_subscribers;
create policy "Admins manage newsletter list"
  on public.newsletter_subscribers for update
  using (public.is_admin());

-- 5) Table privileges
grant select, insert on table public.newsletter_subscribers to anon, authenticated;
grant update on table public.newsletter_subscribers to authenticated;

-- 6) Backfill existing signups from auth metadata (safe to re-run)
update public.profiles p
set newsletter_opt_in = coalesce((u.raw_user_meta_data ->> 'newsletter_opt_in')::boolean, false)
from auth.users u
where u.id = p.id
  and coalesce((u.raw_user_meta_data ->> 'newsletter_opt_in')::boolean, false) = true;

-- ─── Useful admin queries ───
-- All opted-in members:
--   select email, display_name, created_at from public.profiles where newsletter_opt_in = true order by created_at desc;
--
-- Standalone subscribe-page emails:
--   select email, source, created_at from public.newsletter_subscribers where opted_in = true order by created_at desc;
--
-- Combined mailing list (deduped by email):
--   select distinct on (lower(email)) email, display_name, source, subscribed_at
--   from (
--     select lower(email) as email, display_name, 'join' as source, created_at as subscribed_at
--     from public.profiles where newsletter_opt_in = true
--     union all
--     select lower(email), null, source, created_at from public.newsletter_subscribers where opted_in = true
--   ) s
--   order by lower(email), subscribed_at desc;
