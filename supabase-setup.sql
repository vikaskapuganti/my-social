-- MySocial: Supabase setup
-- Paste this whole block into Supabase > SQL Editor > New query, then click Run.

-- One row per user holding all of that user's MySocial data
create table if not exists public.app_data (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security: nobody can read or change a row unless it is their own
alter table public.app_data enable row level security;

drop policy if exists "Read own data" on public.app_data;
create policy "Read own data" on public.app_data
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Insert own data" on public.app_data;
create policy "Insert own data" on public.app_data
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Update own data" on public.app_data;
create policy "Update own data" on public.app_data
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Logged-in users can use the table (the policies above still limit them to their own row).
-- Logged-out visitors get no access at all.
grant select, insert, update on public.app_data to authenticated;
revoke all on public.app_data from anon;
