-- Run once in Supabase SQL Editor.
alter table public.recipes
  add column if not exists method text not null default '炒';
