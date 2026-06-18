-- NaMe Magazine — table privileges (run once in Supabase SQL Editor)
-- Fixes: login works but header stays on "Login / Join"

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
