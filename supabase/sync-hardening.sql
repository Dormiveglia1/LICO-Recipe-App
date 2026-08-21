-- Run once in Supabase Dashboard > SQL Editor.
-- Completes realtime coverage for every shared household table. Existing
-- publication entries are ignored, so this is safe to run after old SQL files.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'families', 'family_members', 'profiles', 'recipes', 'menu_items',
    'shopping_checks', 'recipe_favorites', 'member_notes'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
