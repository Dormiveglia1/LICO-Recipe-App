-- Run once in Supabase SQL Editor.
-- Shared cooking diary fields for every recipe in a family.

alter table public.recipes
  add column if not exists cooked_count integer not null default 0,
  add column if not exists last_cooked_at timestamptz,
  add column if not exists reviews jsonb not null default '[]'::jsonb;

alter table public.recipes
  drop constraint if exists recipes_cooked_count_nonnegative;

alter table public.recipes
  add constraint recipes_cooked_count_nonnegative check (cooked_count >= 0);
