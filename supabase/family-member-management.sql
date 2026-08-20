-- Run once in Supabase SQL Editor for the database you already created.
alter table public.families add column if not exists owner_id uuid references auth.users(id);

update public.families family
set owner_id = (
  select member.user_id from public.family_members member
  where member.family_id = family.id
  order by member.joined_at
  limit 1
)
where owner_id is null;

create or replace function public.remove_family_member(member_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.families where id = (select family_id from public.family_members where user_id = auth.uid()) and owner_id = auth.uid()) then
    raise exception '只有家庭创建者可以移出成员';
  end if;
  if member_id = auth.uid() then raise exception '创建者不能移出自己'; end if;
  delete from public.family_members where user_id = member_id and family_id = (select family_id from public.family_members where user_id = auth.uid());
end; $$;

grant execute on function public.remove_family_member(uuid) to authenticated;
