-- NaMe Magazine — profile picture & signature (run once in Supabase SQL Editor)

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists signature text;

comment on column public.profiles.avatar_url is 'Public profile picture URL (Supabase Storage)';
comment on column public.profiles.signature is 'Short member tagline shown on comments and community posts';

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
