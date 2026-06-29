-- NaMe Magazine — add content_date to posts (run once in Supabase SQL Editor)
alter table public.posts
  add column if not exists content_date timestamptz;
