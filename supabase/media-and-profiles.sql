-- Run once in Supabase SQL Editor after family-member-management.sql.
alter table public.profiles add column if not exists bio text not null default '';

drop policy if exists "profiles own" on public.profiles;
create policy "profiles visible to family" on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.family_members mine join public.family_members theirs on mine.family_id = theirs.family_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);
create policy "profiles own write" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles own update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

insert into storage.buckets (id, name, public) values ('recipe-images', 'recipe-images', false)
on conflict (id) do nothing;

create policy "family media read" on storage.objects for select to authenticated using (
  bucket_id = 'recipe-images' and public.is_family_member((storage.foldername(name))[1]::uuid)
);
create policy "family media upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'recipe-images' and public.is_family_member((storage.foldername(name))[1]::uuid)
);
create policy "family media update" on storage.objects for update to authenticated using (
  bucket_id = 'recipe-images' and public.is_family_member((storage.foldername(name))[1]::uuid)
);
