-- =====================================================================
-- Origine (type de littérature) des auteurs : française, japonaise, anglo-saxonne…
-- À coller dans Supabase > SQL Editor puis "Run" (ne supprime rien).
-- =====================================================================
alter table public.authors
  add column if not exists origin text check (origin is null or char_length(origin) <= 40);

-- Les utilisateurs connectés peuvent renseigner l'origine d'un auteur (catalogue partagé)
drop policy if exists "authors_update" on public.authors;
create policy "authors_update" on public.authors
  for update to authenticated using (true) with check (true);
