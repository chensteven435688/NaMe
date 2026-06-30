-- NaMe — multi-image submissions (cover + body gallery)
-- Run once in Supabase SQL Editor

alter table public.submissions
  add column if not exists body_files jsonb not null default '[]'::jsonb;
