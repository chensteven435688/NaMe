-- NaMe Magazine — community moodboard images (run once in Supabase SQL Editor)

insert into storage.buckets (id, name, public, file_size_limit)
values ('community-images', 'community-images', true, 10485760)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "Users upload own community images" on storage.objects;
create policy "Users upload own community images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Anyone can read community images" on storage.objects;
create policy "Anyone can read community images"
  on storage.objects for select to public
  using (bucket_id = 'community-images');

drop policy if exists "Users delete own community images" on storage.objects;
create policy "Users delete own community images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Admins delete community images" on storage.objects;
create policy "Admins delete community images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'community-images'
    and public.is_admin()
  );
