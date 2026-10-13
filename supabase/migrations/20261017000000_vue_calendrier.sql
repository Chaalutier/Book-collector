-- =====================================================================
-- Mémorise la vue du calendrier choisie par chaque utilisateur
-- (liste ou calendrier). À coller dans Supabase > SQL Editor puis "Run".
-- =====================================================================
alter table public.profiles
  add column if not exists calendar_view text not null default 'list'
  check (calendar_view in ('list', 'grid'));
