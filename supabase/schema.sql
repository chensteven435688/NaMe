-- NaMe Magazine — Supabase schema
-- Paste into Supabase → SQL Editor → Run

-- ─── Profiles (extends Supabase Auth) ───
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  display_name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  newsletter_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─── Magazine posts ───
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  type text not null check (type in ('article', 'editorial', 'film', 'short', 'exclusive')),
  title text not null,
  meta text,
  image_url text,
  body text,
  video_url text,
  section text check (section in ('latest', 'popular') or section is null),
  featured boolean not null default false,
  author_id uuid references public.profiles (id),
  content_date timestamptz,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_posts_type on public.posts (type);
create index if not exists idx_posts_section on public.posts (section);

-- ─── Post comments ───
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_comments_post on public.comments (post_id);

create table if not exists public.comment_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

-- ─── Community moodboard ───
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  caption text,
  image_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_community_posts_created on public.community_posts (created_at desc);

create table if not exists public.community_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.community_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- ─── Creator submissions ───
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  medium text not null,
  description text,
  file_url text not null,
  file_name text,
  file_mime text,
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  post_id uuid references public.posts (id) on delete set null,
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_submissions_user on public.submissions (user_id);
create index if not exists idx_submissions_status on public.submissions (status);

-- Newsletter emails from subscribe page (no account required)
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

-- Auto-create profile when someone signs up via Supabase Auth
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is current user an admin?
create or replace function public.is_admin ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ─── Row Level Security ───
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_comments enable row level security;
alter table public.submissions enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- Profiles
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Admins update any profile"
  on public.profiles for update using (public.is_admin());

create policy "Admins delete profiles"
  on public.profiles for delete using (public.is_admin());

-- Posts: public read, admin write
create policy "Posts are public"
  on public.posts for select using (true);

create policy "Admins manage posts"
  on public.posts for all using (public.is_admin());

-- Comments
create policy "Comments are public"
  on public.comments for select using (true);

create policy "Members post comments"
  on public.comments for insert with check (auth.uid() = user_id);

create policy "Users delete own comments or admin any"
  on public.comments for delete using (auth.uid() = user_id or public.is_admin());

-- Comment likes
create policy "Comment likes are public"
  on public.comment_likes for select using (true);

create policy "Members like comments"
  on public.comment_likes for insert with check (auth.uid() = user_id);

create policy "Users unlike own"
  on public.comment_likes for delete using (auth.uid() = user_id);

-- Community
create policy "Community posts are public"
  on public.community_posts for select using (true);

create policy "Members create community posts"
  on public.community_posts for insert with check (auth.uid() = user_id);

create policy "Users delete own community posts"
  on public.community_posts for delete using (auth.uid() = user_id or public.is_admin());

create policy "Community likes are public"
  on public.community_likes for select using (true);

create policy "Members like community posts"
  on public.community_likes for insert with check (auth.uid() = user_id);

create policy "Users unlike community posts"
  on public.community_likes for delete using (auth.uid() = user_id);

create policy "Community comments are public"
  on public.community_comments for select using (true);

create policy "Members comment on community"
  on public.community_comments for insert with check (auth.uid() = user_id);

create policy "Users delete own community comments"
  on public.community_comments for delete using (auth.uid() = user_id or public.is_admin());

-- Submissions
create policy "Users see own submissions"
  on public.submissions for select using (auth.uid() = user_id or public.is_admin());

create policy "Members submit work"
  on public.submissions for insert with check (auth.uid() = user_id);

create policy "Admins manage submissions"
  on public.submissions for update using (public.is_admin());

create policy "Admins delete submissions"
  on public.submissions for delete using (public.is_admin());

-- Newsletter
create policy "Anyone can subscribe"
  on public.newsletter_subscribers for insert with check (true);

create policy "Admins read newsletter list"
  on public.newsletter_subscribers for select using (public.is_admin());

create policy "Admins manage newsletter list"
  on public.newsletter_subscribers for update using (public.is_admin());

-- Table privileges (required — RLS alone is not enough)
grant usage on schema public to anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant update, delete on table public.profiles to authenticated;
grant select on table public.posts to anon, authenticated;
grant insert, update, delete on table public.posts to authenticated;
grant select on table public.comments to anon, authenticated;
grant insert, delete on table public.comments to authenticated;
grant select on table public.comment_likes to anon, authenticated;
grant insert, delete on table public.comment_likes to authenticated;
grant select on table public.community_posts to anon, authenticated;
grant insert, delete on table public.community_posts to authenticated;
grant select on table public.community_likes to anon, authenticated;
grant insert, delete on table public.community_likes to authenticated;
grant select on table public.community_comments to anon, authenticated;
grant insert, delete on table public.community_comments to authenticated;
grant select, insert on table public.submissions to authenticated;
grant update, delete on table public.submissions to authenticated;
grant select, insert on table public.newsletter_subscribers to anon, authenticated;
grant update on table public.newsletter_subscribers to authenticated;

-- Make yourself admin (replace with your email after you sign up once)
-- update public.profiles set role = 'admin' where email = 'chensteven435688@gmail.com';

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
