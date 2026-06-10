-- NaMe Magazine — submission file uploads (run once in Supabase SQL Editor)
-- Creates a public storage bucket for member submission files (images, PDF, video).

insert into storage.buckets (id, name, public, file_size_limit)
values ('submissions', 'submissions', true, 26214400)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "Users upload own submission files" on storage.objects;
create policy "Users upload own submission files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Anyone can read submission files" on storage.objects;
create policy "Anyone can read submission files"
  on storage.objects for select to public
  using (bucket_id = 'submissions');

drop policy if exists "Admins delete submission files" on storage.objects;
create policy "Admins delete submission files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'submissions'
    and public.is_admin()
  );
