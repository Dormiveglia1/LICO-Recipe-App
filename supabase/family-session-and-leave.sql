-- Run once in Supabase Dashboard > SQL Editor.
-- Lets a member leave a household without weakening row-level security.
-- If the owner leaves, ownership moves to the earliest remaining member.
-- If nobody remains, the household and its cascading data are deleted.

create or replace function public.leave_family()
returns void language plpgsql security definer set search_path = public
as $$
declare
  current_family uuid;
  current_owner uuid;
  next_owner uuid;
begin
  select family_id into current_family
  from public.family_members
  where user_id = auth.uid();

  if current_family is null then
    raise exception '你目前没有加入家庭';
  end if;

  select owner_id into current_owner
  from public.families
  where id = current_family
  for update;

  if current_owner = auth.uid() then
    select user_id into next_owner
    from public.family_members
    where family_id = current_family and user_id <> auth.uid()
    order by joined_at
    limit 1;

    if next_owner is null then
      delete from public.families where id = current_family;
      return;
    end if;

    update public.families set owner_id = next_owner where id = current_family;
  end if;

  delete from public.family_members
  where family_id = current_family and user_id = auth.uid();
end; $$;

grant execute on function public.leave_family() to authenticated;
