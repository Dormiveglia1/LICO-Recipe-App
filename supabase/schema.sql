-- Run this once in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '栗刻成员',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default '我们的厨房',
  invite_code text not null unique,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id),
  unique (user_id)
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  category text not null,
  taste text,
  cook_time text,
  tags text[] not null default '{}',
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  cover_url text,
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_items (
  recipe_id uuid primary key references public.recipes(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  stage text not null check (stage in ('想吃', '计划本周做', '今天做', '已完成')),
  note text,
  updated_at timestamptz not null default now()
);

create table public.shopping_checks (
  family_id uuid not null references public.families(id) on delete cascade,
  ingredient_key text not null,
  checked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (family_id, ingredient_key)
);

create index recipes_family_id_idx on public.recipes(family_id);
create index menu_items_family_id_idx on public.menu_items(family_id);

create or replace function public.is_family_member(target_family uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.family_members where family_id = target_family and user_id = auth.uid()) $$;

create or replace function public.create_family(family_name text default '我们的厨房')
returns public.families language plpgsql security definer set search_path = public
as $$
declare new_family public.families;
begin
  insert into public.families (name, invite_code, owner_id)
  values (coalesce(nullif(trim(family_name), ''), '我们的厨房'), upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), auth.uid())
  returning * into new_family;
  insert into public.family_members (family_id, user_id) values (new_family.id, auth.uid());
  return new_family;
end; $$;

create or replace function public.join_family(code text)
returns public.families language plpgsql security definer set search_path = public
as $$
declare target public.families;
begin
  -- Lock the family row so two simultaneous invitation requests cannot exceed 3 members.
  select * into target from public.families where invite_code = upper(trim(code)) for update;
  if target.id is null then raise exception '邀请码无效'; end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then raise exception '你已加入一个家庭'; end if;
  if (select count(*) from public.family_members where family_id = target.id) >= 3 then
    raise exception '这个家庭已经有 3 位成员了';
  end if;
  insert into public.family_members (family_id, user_id) values (target.id, auth.uid());
  return target;
end; $$;

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.recipes enable row level security;
alter table public.menu_items enable row level security;
alter table public.shopping_checks enable row level security;

create policy "profiles own" on public.profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "families members" on public.families for all to authenticated using (public.is_family_member(id)) with check (public.is_family_member(id));
create policy "members visible to family" on public.family_members for select to authenticated using (public.is_family_member(family_id));
create policy "recipes family access" on public.recipes for all to authenticated using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
create policy "menu family access" on public.menu_items for all to authenticated using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
create policy "shopping family access" on public.shopping_checks for all to authenticated using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));

grant execute on function public.create_family(text), public.join_family(text) to authenticated;

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

create or replace function public.leave_family()
returns void language plpgsql security definer set search_path = public
as $$
declare
  current_family uuid;
  current_owner uuid;
  next_owner uuid;
begin
  select family_id into current_family from public.family_members where user_id = auth.uid();
  if current_family is null then raise exception '你目前没有加入家庭'; end if;

  select owner_id into current_owner from public.families where id = current_family for update;
  if current_owner = auth.uid() then
    select user_id into next_owner from public.family_members
    where family_id = current_family and user_id <> auth.uid()
    order by joined_at limit 1;
    if next_owner is null then
      delete from public.families where id = current_family;
      return;
    end if;
    update public.families set owner_id = next_owner where id = current_family;
  end if;

  delete from public.family_members where family_id = current_family and user_id = auth.uid();
end; $$;

grant execute on function public.leave_family() to authenticated;

-- Run after the tables exist to deliver cross-device changes immediately.
alter publication supabase_realtime add table public.recipes, public.menu_items, public.shopping_checks, public.family_members, public.profiles;
