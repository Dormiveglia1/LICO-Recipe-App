-- Run once in Supabase SQL Editor.
alter table public.recipes
  add column if not exists difficulty text not null default '简单';
