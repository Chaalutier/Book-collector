-- =====================================================================
-- Fiches des maisons d'édition (pays, groupe, site web, description)
-- À coller dans Supabase > SQL Editor puis "Run" (ne supprime rien).
-- Le nom reste stocké sur chaque livre (books.publisher) ; cette table
-- ajoute les infos de la maison, repérée par son nom (insensible à la casse).
-- =====================================================================
create table if not exists public.publishers (
  id          bigint generated always as identity primary key,
  name        text not null check (char_length(name) between 1 and 200),
  country     text check (country is null or char_length(country) <= 60),
  parent_group text check (parent_group is null or char_length(parent_group) <= 120),
  website     text check (website is null or (char_length(website) <= 300 and website ~* '^https?://')),
  description text check (description is null or char_length(description) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists publishers_name_key on public.publishers (lower(name));

alter table public.publishers enable row level security;

drop policy if exists "publishers_select" on public.publishers;
create policy "publishers_select" on public.publishers
  for select to anon, authenticated using (true);
drop policy if exists "publishers_insert" on public.publishers;
create policy "publishers_insert" on public.publishers
  for insert to authenticated with check (true);
drop policy if exists "publishers_update" on public.publishers;
create policy "publishers_update" on public.publishers
  for update to authenticated using (true) with check (true);
drop policy if exists "publishers_delete" on public.publishers;
create policy "publishers_delete" on public.publishers
  for delete to authenticated using (true);
