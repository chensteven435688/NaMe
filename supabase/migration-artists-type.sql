-- NaMe Magazine — allow post type "artists" (run once in the Supabase SQL editor).
-- Existing databases keep the original check constraint until this runs.
-- Do not apply this against production until you are ready to publish Artists posts.

alter table public.posts drop constraint if exists posts_type_check;

alter table public.posts
  add constraint posts_type_check
  check (type in ('article', 'editorial', 'film', 'short', 'exclusive', 'artists'));
