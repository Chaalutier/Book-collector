-- =====================================================================
-- Statut « à recevoir », page de lecture, notes au demi-point
-- ---------------------------------------------------------------------
-- À coller dans Supabase > SQL Editor puis "Run" (ne supprime aucune donnée).
-- =====================================================================

-- Nouveau statut : acheté / commandé mais pas encore reçu
alter type public.reading_status add value if not exists 'ordered' after 'wishlist';

-- Page où l'on s'est arrêté
alter table public.user_books
  add column if not exists current_page integer check (current_page >= 0);

-- Note de 0,5 à 5 par pas de 0,5 (les notes entières existantes sont conservées)
alter table public.user_books drop constraint if exists user_books_rating_check;
alter table public.user_books alter column rating type numeric(2, 1) using rating::numeric;
alter table public.user_books
  add constraint user_books_rating_check
  check (rating is null or (rating between 0.5 and 5 and rating * 2 = floor(rating * 2)));
