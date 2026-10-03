-- NaMe Magazine — security hardening (run once in Supabase SQL Editor, after all earlier migrations)
-- Safe to re-run.

-- 1) Submissions: members may only create pending, unreviewed submissions in their own folder.
--    Previously a member could insert status = 'published', fake an admin_note / reviewed_by,
--    or point file_url at any external site.
drop policy if exists "Members submit work" on public.submissions;
create policy "Members submit work"
  on public.submissions for insert to authenticated
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and post_id is null
    and admin_note is null
    and reviewed_at is null
    and reviewed_by is null
    and file_url like 'https://qmrjeljynsywqfisxygj.supabase.co/storage/v1/object/public/submissions/' || auth.uid()::text || '/%'
  );

-- 2) Community posts: members cannot pin themselves to the top or un-hide via insert,
--    and images must come from their own folder in the community-images bucket.
drop policy if exists "Members create community posts" on public.community_posts;
create policy "Members create community posts"
  on public.community_posts for insert to authenticated
  with check (
    auth.uid() = user_id
    and is_hidden = false
    and sort_order is null
    and image_url like 'https://qmrjeljynsywqfisxygj.supabase.co/storage/v1/object/public/community-images/' || auth.uid()::text || '/%'
  );

-- 3) Newsletter: anonymous signups cannot attach someone else's user_id or claim source = 'admin'.
drop policy if exists "Anyone can subscribe" on public.newsletter_subscribers;
create policy "Anyone can subscribe"
  on public.newsletter_subscribers for insert to anon, authenticated
  with check (
    (user_id is null or user_id = auth.uid())
    and source in ('subscribe_page', 'join')
    and char_length(email) <= 254
    and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  );

-- 4) Profiles: members can no longer change their own role OR email.
--    (Email is shown to admins in moderation views and must match the auth account.)
create or replace function public.enforce_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role or new.email is distinct from old.email then
    if auth.uid() is null or not public.is_admin() then
      raise exception 'Only an administrator can change a profile role or email'
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

-- 5) Length limits so a single row cannot be used to bloat the database or the page.
alter table public.comments drop constraint if exists comments_body_len;
alter table public.comments add constraint comments_body_len
  check (char_length(body) between 1 and 5000) not valid;

alter table public.community_comments drop constraint if exists community_comments_body_len;
alter table public.community_comments add constraint community_comments_body_len
  check (char_length(body) between 1 and 5000) not valid;

alter table public.profiles drop constraint if exists profiles_text_len;
alter table public.profiles add constraint profiles_text_len
  check (char_length(display_name) <= 80 and (signature is null or char_length(signature) <= 160)) not valid;

alter table public.community_posts drop constraint if exists community_posts_text_len;
alter table public.community_posts add constraint community_posts_text_len
  check ((title is null or char_length(title) <= 200) and (caption is null or char_length(caption) <= 2000)) not valid;

alter table public.submissions drop constraint if exists submissions_text_len;
alter table public.submissions add constraint submissions_text_len
  check (char_length(title) <= 200 and (description is null or char_length(description) <= 5000)) not valid;

-- 6) Security-definer helpers should not be callable by anonymous visitors.
revoke execute on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
