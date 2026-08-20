-- Run once in Supabase SQL Editor.
-- Safe to run after the earlier schema.sql.

-- Recipe diary fields used by the existing app.
alter table public.recipes
  add column if not exists cooked_count integer not null default 0,
  add column if not exists last_cooked_at timestamptz,
  add column if not exists reviews jsonb not null default '[]'::jsonb,
  add column if not exists difficulty text,
  add column if not exists method text;

alter table public.recipes drop constraint if exists recipes_cooked_count_nonnegative;
alter table public.recipes add constraint recipes_cooked_count_nonnegative check (cooked_count >= 0);

-- A favourite belongs to the household, so either member sees the same collection.
create table if not exists public.recipe_favorites (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id, family_id)
);

alter table public.recipe_favorites enable row level security;
drop policy if exists "favorites family access" on public.recipe_favorites;
create policy "favorites family access" on public.recipe_favorites for all to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

alter publication supabase_realtime add table public.recipe_favorites;
