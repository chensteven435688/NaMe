-- NaMe — community mood board moderation (run once in Supabase SQL Editor)

alter table public.community_posts
  add column if not exists image_hash text,
  add column if not exists sort_order integer,
  add column if not exists is_hidden boolean not null default false;

create unique index if not exists idx_community_posts_user_image_hash
  on public.community_posts (user_id, image_hash)
  where image_hash is not null;

create index if not exists idx_community_posts_sort
  on public.community_posts (sort_order asc nulls last, created_at desc);

drop policy if exists "Admins manage community posts" on public.community_posts;
create policy "Admins manage community posts"
  on public.community_posts for update using (public.is_admin());

comment on column public.community_posts.image_hash is 'SHA-256 of image bytes — blocks duplicate uploads per member';
comment on column public.community_posts.sort_order is 'Admin mood board order (lower = earlier)';
comment on column public.community_posts.is_hidden is 'Hidden from public mood board when true';
