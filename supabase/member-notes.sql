create table if not exists public.member_notes (
  family_id uuid not null references public.families(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (family_id, author_id, member_id),
  check (author_id <> member_id)
);

alter table public.member_notes enable row level security;
create policy "own family notes" on public.member_notes for all to authenticated
using (author_id = auth.uid() and public.is_family_member(family_id))
with check (author_id = auth.uid() and public.is_family_member(family_id));
