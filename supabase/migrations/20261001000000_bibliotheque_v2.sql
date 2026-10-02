-- =====================================================================
-- Book Collector — modèle de données v2
-- ---------------------------------------------------------------------
-- À coller dans Supabase > SQL Editor puis "Run".
-- ATTENTION : ce script repart de zéro. Il SUPPRIME les tables
-- `books` et `user_books` existantes (et leurs données).
-- Les comptes utilisateurs (auth.users) sont conservés.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Nettoyage de l'ancien modèle
-- ---------------------------------------------------------------------
drop table if exists public.user_books cascade;
drop table if exists public.book_contributors cascade;
drop table if exists public.books cascade;
drop table if exists public.series cascade;
drop table if exists public.authors cascade;
drop table if exists public.profiles cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;

drop type if exists public.book_category cascade;
drop type if exists public.reading_status cascade;
drop type if exists public.contributor_role cascade;

-- ---------------------------------------------------------------------
-- 1. Types énumérés
-- ---------------------------------------------------------------------
-- Catégories de la bibliothèque
create type public.book_category as enum ('novel', 'essay', 'manga', 'comic');

-- Statut d'un livre pour un utilisateur
--   wishlist  : je le veux (pas acheté)
--   to_read   : acheté, pas encore lu
--   reading   : en cours de lecture
--   read      : lu
--   abandoned : abandonné
create type public.reading_status as enum ('wishlist', 'to_read', 'reading', 'read', 'abandoned');

-- Rôle d'un contributeur sur un livre (utile pour BD / manga)
create type public.contributor_role as enum (
  'author',      -- auteur (roman, essai, mangaka...)
  'scenarist',   -- scénariste
  'artist',      -- dessinateur
  'colorist',    -- coloriste
  'translator',  -- traducteur
  'other'
);

-- ---------------------------------------------------------------------
-- 2. Utilitaire updated_at
-- ---------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Profils utilisateurs
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 50),
  bio          text check (char_length(bio) <= 500),
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Création automatique du profil à l'inscription
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profils pour les comptes déjà existants
insert into public.profiles (id, display_name)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 4. Catalogue partagé : auteurs, séries, livres
-- ---------------------------------------------------------------------
create table public.authors (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
-- Un auteur = un nom (insensible à la casse)
create unique index authors_name_key on public.authors (lower(name));

create table public.series (
  id            bigint generated always as identity primary key,
  title         text not null check (char_length(trim(title)) > 0),
  category      public.book_category not null,
  total_volumes integer check (total_volumes > 0),  -- nb de tomes parus (optionnel)
  is_finished   boolean not null default false,      -- série terminée ?
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index series_title_category_key on public.series (lower(title), category);

create trigger series_updated_at
  before update on public.series
  for each row execute function public.set_updated_at();

create table public.books (
  id              bigint generated always as identity primary key,
  title           text not null check (char_length(trim(title)) > 0),
  subtitle        text,
  description     text,
  category        public.book_category not null,
  series_id       bigint references public.series (id) on delete set null,
  volume_number   numeric(6, 1) check (volume_number >= 0),  -- 1, 2, 12.5 (tome hors-série)...
  isbn10          text unique,
  isbn13          text unique,
  cover_url       text,
  publisher       text,
  published_date  text,          -- "2013", "2013-05", "2013-05-02" selon la source
  page_count      integer check (page_count > 0),
  language        text,
  google_books_id text unique,
  bnf_ark         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index books_series_idx on public.books (series_id, volume_number);

create trigger books_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

-- Plusieurs auteurs par livre, avec leur rôle
create table public.book_contributors (
  book_id   bigint not null references public.books (id) on delete cascade,
  author_id bigint not null references public.authors (id) on delete cascade,
  role      public.contributor_role not null default 'author',
  position  smallint not null default 0,  -- ordre d'affichage
  primary key (book_id, author_id, role)
);
create index book_contributors_author_idx on public.book_contributors (author_id);

-- ---------------------------------------------------------------------
-- 5. Bibliothèque personnelle
-- ---------------------------------------------------------------------
create table public.user_books (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id     bigint not null references public.books (id) on delete cascade,
  status      public.reading_status not null default 'to_read',
  rating      smallint check (rating between 1 and 5),
  notes       text,
  started_at  date,
  finished_at date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, book_id)
);
create index user_books_user_status_idx on public.user_books (user_id, status);

create trigger user_books_updated_at
  before update on public.user_books
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6. Ajout d'un livre en une seule transaction
-- ---------------------------------------------------------------------
-- p_book (jsonb) :
-- {
--   "title": "...", "subtitle": "...", "description": "...",
--   "category": "manga", "series_title": "One Piece", "volume_number": 9,
--   "isbn10": "...", "isbn13": "...", "cover_url": "...", "publisher": "...",
--   "published_date": "2013", "page_count": 192, "language": "fr",
--   "google_books_id": "...", "bnf_ark": "...",
--   "contributors": [{ "name": "Eiichirō Oda", "role": "author" }]
-- }
create function public.add_book_to_library(
  p_book   jsonb,
  p_status public.reading_status default 'to_read'
)
returns table (user_book_id bigint, book_id bigint, already_in_library boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_category  public.book_category := (p_book ->> 'category')::public.book_category;
  v_series_id bigint;
  v_book_id   bigint;
  v_author_id bigint;
  v_ub_id     bigint;
  v_existed   boolean;
  v_contrib   jsonb;
  v_pos       smallint := 0;
  v_title     text := nullif(trim(p_book ->> 'title'), '');
  v_isbn10    text := nullif(p_book ->> 'isbn10', '');
  v_isbn13    text := nullif(p_book ->> 'isbn13', '');
  v_gbid      text := nullif(p_book ->> 'google_books_id', '');
begin
  if v_user is null then
    raise exception 'Utilisateur non connecté' using errcode = '42501';
  end if;
  if v_title is null then
    raise exception 'Le titre est obligatoire' using errcode = '22023';
  end if;
  if v_category is null then
    raise exception 'La catégorie est obligatoire' using errcode = '22023';
  end if;

  -- Série
  if nullif(trim(p_book ->> 'series_title'), '') is not null then
    select s.id into v_series_id
    from series s
    where lower(s.title) = lower(trim(p_book ->> 'series_title'))
      and s.category = v_category;

    if v_series_id is null then
      insert into series (title, category)
      values (trim(p_book ->> 'series_title'), v_category)
      returning id into v_series_id;
    end if;
  end if;

  -- Livre déjà au catalogue ?
  select b.id into v_book_id
  from books b
  where (v_isbn13 is not null and b.isbn13 = v_isbn13)
     or (v_isbn10 is not null and b.isbn10 = v_isbn10)
     or (v_gbid   is not null and b.google_books_id = v_gbid)
  limit 1;

  if v_book_id is null then
    insert into books (
      title, subtitle, description, category, series_id, volume_number,
      isbn10, isbn13, cover_url, publisher, published_date, page_count,
      language, google_books_id, bnf_ark
    ) values (
      v_title,
      nullif(p_book ->> 'subtitle', ''),
      nullif(p_book ->> 'description', ''),
      v_category,
      v_series_id,
      (nullif(p_book ->> 'volume_number', ''))::numeric,
      v_isbn10,
      v_isbn13,
      nullif(p_book ->> 'cover_url', ''),
      nullif(p_book ->> 'publisher', ''),
      nullif(p_book ->> 'published_date', ''),
      (nullif(p_book ->> 'page_count', ''))::integer,
      nullif(p_book ->> 'language', ''),
      v_gbid,
      nullif(p_book ->> 'bnf_ark', '')
    )
    returning id into v_book_id;

    -- Contributeurs
    if jsonb_typeof(p_book -> 'contributors') = 'array' then
      for v_contrib in select * from jsonb_array_elements(p_book -> 'contributors')
      loop
        continue when nullif(trim(v_contrib ->> 'name'), '') is null;

        select a.id into v_author_id
        from authors a
        where lower(a.name) = lower(trim(v_contrib ->> 'name'));

        if v_author_id is null then
          insert into authors (name)
          values (trim(v_contrib ->> 'name'))
          returning id into v_author_id;
        end if;

        insert into book_contributors (book_id, author_id, role, position)
        values (
          v_book_id,
          v_author_id,
          coalesce((nullif(v_contrib ->> 'role', ''))::contributor_role, 'author'),
          v_pos
        )
        on conflict do nothing;

        v_pos := v_pos + 1;
      end loop;
    end if;
  else
    -- Complète les infos manquantes d'un livre existant
    update books b set
      cover_url      = coalesce(b.cover_url, nullif(p_book ->> 'cover_url', '')),
      description    = coalesce(b.description, nullif(p_book ->> 'description', '')),
      page_count     = coalesce(b.page_count, (nullif(p_book ->> 'page_count', ''))::integer),
      publisher      = coalesce(b.publisher, nullif(p_book ->> 'publisher', '')),
      series_id      = coalesce(b.series_id, v_series_id),
      volume_number  = coalesce(b.volume_number, (nullif(p_book ->> 'volume_number', ''))::numeric)
    where b.id = v_book_id;
  end if;

  -- Bibliothèque de l'utilisateur
  select ub.id into v_ub_id
  from user_books ub
  where ub.user_id = v_user and ub.book_id = v_book_id;

  v_existed := v_ub_id is not null;

  if not v_existed then
    insert into user_books (user_id, book_id, status)
    values (v_user, v_book_id, coalesce(p_status, 'to_read'))
    returning id into v_ub_id;
  end if;

  return query select v_ub_id, v_book_id, v_existed;
end;
$$;

revoke all on function public.add_book_to_library(jsonb, public.reading_status) from public, anon;
grant execute on function public.add_book_to_library(jsonb, public.reading_status) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Sécurité (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.authors           enable row level security;
alter table public.series            enable row level security;
alter table public.books             enable row level security;
alter table public.book_contributors enable row level security;
alter table public.user_books        enable row level security;

-- Profils : lisibles par tous, modifiables par leur propriétaire
create policy "profiles_select" on public.profiles
  for select to anon, authenticated using (true);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Catalogue : lecture publique ; les ajouts passent par add_book_to_library()
create policy "authors_select" on public.authors
  for select to anon, authenticated using (true);
create policy "book_contributors_select" on public.book_contributors
  for select to anon, authenticated using (true);
create policy "books_select" on public.books
  for select to anon, authenticated using (true);
create policy "series_select" on public.series
  for select to anon, authenticated using (true);

-- Correction des fiches (catégorie, série, tome...) par les utilisateurs connectés
create policy "books_update" on public.books
  for update to authenticated using (true) with check (true);
create policy "series_insert" on public.series
  for insert to authenticated with check (true);
create policy "series_update" on public.series
  for update to authenticated using (true) with check (true);

-- Bibliothèque personnelle : chacun ne voit et ne modifie que la sienne
create policy "user_books_select_own" on public.user_books
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_books_insert_own" on public.user_books
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user_books_update_own" on public.user_books
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "user_books_delete_own" on public.user_books
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 8. Stockage des photos de profil
-- ---------------------------------------------------------------------
-- Bucket public "avatars" ; chaque utilisateur écrit dans le dossier <son uuid>/
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
