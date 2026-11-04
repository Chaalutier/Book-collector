-- =====================================================================
-- Couverture choisie pour une série (sinon : celle du premier tome)
-- À coller dans Supabase > SQL Editor puis "Run" (ne supprime rien).
-- =====================================================================
alter table public.series
  add column if not exists cover_url text check (cover_url is null or char_length(cover_url) <= 1000);
