-- Auteurs des sorties BD (bede.fr ne les affiche pas : ils sont complétés via les catalogues Google Books / BnF)
alter table public.bd_releases
  add column if not exists authors jsonb,
  add column if not exists authors_checked_at timestamptz;

comment on column public.bd_releases.authors is 'Tableau JSON [{name, role}] ; null = pas encore cherché ou introuvable';
comment on column public.bd_releases.authors_checked_at is 'Dernière tentative de recherche des auteurs';
