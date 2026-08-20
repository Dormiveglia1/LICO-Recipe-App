-- Run once in Supabase Dashboard > SQL Editor.
-- Makes invitation joins safe for a three-person household, including simultaneous joins.
create or replace function public.join_family(code text)
returns public.families language plpgsql security definer set search_path = public
as $$
declare target public.families;
begin
  select * into target
  from public.families
  where invite_code = upper(trim(code))
  for update;

  if target.id is null then raise exception '邀请码无效'; end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception '你已加入一个家庭';
  end if;
  if (select count(*) from public.family_members where family_id = target.id) >= 3 then
    raise exception '这个家庭已经有 3 位成员了';
  end if;

  insert into public.family_members (family_id, user_id)
  values (target.id, auth.uid());
  return target;
end; $$;

grant execute on function public.join_family(text) to authenticated;

-- The app already subscribes to these tables; publishing them makes member list
-- and profile/avatar changes refresh immediately on every household device.
do $$ begin
  alter publication supabase_realtime add table public.family_members;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;
