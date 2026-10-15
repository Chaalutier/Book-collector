-- =====================================================================
-- Sorties BD récupérées sur bede.fr (avec l'accord du site)
-- Remplie automatiquement par /api/cron/sorties-bd (tous les 1er et 15 du mois).
-- À coller dans Supabase > SQL Editor puis "Run" (ne supprime rien).
-- =====================================================================
create table if not exists public.bd_releases (
  id            text primary key,              -- n° d'album bede.fr (stable)
  release_date  date not null,
  title         text not null check (char_length(title) between 1 and 300),
  series_title  text check (series_title is null or char_length(series_title) <= 300),
  volume_number int check (volume_number is null or volume_number between 0 and 9999),
  publisher     text check (publisher is null or char_length(publisher) <= 200),
  url           text check (url is null or url ~* '^https?://'),
  cover_url     text check (cover_url is null or cover_url ~* '^https?://'),
  source_page   text not null default 'bd',
  last_seen_at  timestamptz not null default now()
);

create index if not exists bd_releases_date_idx on public.bd_releases (release_date);

alter table public.bd_releases enable row level security;

-- Lecture pour les utilisateurs connectés ; l'écriture se fait uniquement
-- côté serveur avec la clé secrète (qui ignore la RLS).
drop policy if exists "bd_releases_select" on public.bd_releases;
create policy "bd_releases_select" on public.bd_releases
  for select to authenticated using (true);
