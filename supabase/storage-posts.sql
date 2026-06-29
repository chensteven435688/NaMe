-- NaMe Magazine — admin post cover images (run once in Supabase SQL Editor)

insert into storage.buckets (id, name, public, file_size_limit)
values ('post-images', 'post-images', true, 10485760)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "Admins upload post images" on storage.objects;
create policy "Admins upload post images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and public.is_admin());

drop policy if exists "Anyone can read post images" on storage.objects;
create policy "Anyone can read post images"
  on storage.objects for select to public
  using (bucket_id = 'post-images');

drop policy if exists "Admins delete post images" on storage.objects;
create policy "Admins delete post images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and public.is_admin());