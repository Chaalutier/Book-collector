-- =====================================================================
-- Synchronisation d'une fiche provisoire avec les infos d'une API
-- ---------------------------------------------------------------------
-- À coller dans Supabase > SQL Editor puis "Run" (ne supprime rien).
--
-- public.sync_book(p_book_id, p_data) met à jour une fiche du catalogue
-- (ISBN, couverture, date, pages, auteurs…) pour un utilisateur qui l'a
-- dans sa bibliothèque. Seules les clés présentes dans p_data sont modifiées.
--
-- Si l'ISBN (ou l'id Google) trouvé existe déjà au catalogue sur une AUTRE
-- fiche, on ne crée pas de doublon : le livre de l'utilisateur est rattaché à
-- cette fiche existante, et la fiche provisoire est supprimée si plus personne
-- ne l'utilise.
-- =====================================================================
create or replace function public.sync_book(p_book_id bigint, p_data jsonb)
returns table (book_id bigint, merged boolean, user_book_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_ub_id     bigint;
  v_other_id  bigint;
  v_isbn10    text := nullif(p_data ->> 'isbn10', '');
  v_isbn13    text := nullif(p_data ->> 'isbn13', '');
  v_gbid      text := nullif(p_data ->> 'google_books_id', '');
  v_contrib   jsonb;
  v_author_id bigint;
  v_pos       smallint := 0;
  v_replace   boolean := coalesce((p_data ->> 'replace_contributors')::boolean, false);
  v_target    bigint := p_book_id;
  v_merged    boolean := false;
begin
  if v_user is null then
    raise exception 'Utilisateur non connecté' using errcode = '42501';
  end if;

  select ub.id into v_ub_id
  from user_books ub
  where ub.user_id = v_user and ub.book_id = p_book_id;
  if v_ub_id is null then
    raise exception 'Livre introuvable dans ta bibliothèque' using errcode = '42501';
  end if;

  -- Cette référence existe-t-elle déjà sur une autre fiche ?
  select b.id into v_other_id
  from books b
  where b.id <> p_book_id
    and ((v_isbn13 is not null and b.isbn13 = v_isbn13)
      or (v_isbn10 is not null and b.isbn10 = v_isbn10)
      or (v_gbid   is not null and b.google_books_id = v_gbid))
  limit 1;

  if v_other_id is not null then
    if exists (select 1 from user_books ub where ub.user_id = v_user and ub.book_id = v_other_id) then
      raise exception 'Ce livre est déjà dans ta bibliothèque (fiche existante)' using errcode = '23505';
    end if;

    -- Rattache le livre de l'utilisateur à la fiche existante
    update user_books ub set book_id = v_other_id where ub.id = v_ub_id;
    v_target := v_other_id;
    v_merged := true;

    -- La fiche provisoire disparaît si personne d'autre ne l'utilise
    if not exists (select 1 from user_books ub where ub.book_id = p_book_id) then
      delete from books b where b.id = p_book_id;
    end if;

    -- On complète seulement les trous de la fiche existante
    update books b set
      cover_url      = coalesce(b.cover_url, nullif(p_data ->> 'cover_url', '')),
      description    = coalesce(b.description, nullif(p_data ->> 'description', '')),
      publisher      = coalesce(b.publisher, nullif(p_data ->> 'publisher', '')),
      published_date = coalesce(b.published_date, nullif(p_data ->> 'published_date', '')),
      page_count     = coalesce(b.page_count, (nullif(p_data ->> 'page_count', ''))::integer),
      language       = coalesce(b.language, nullif(p_data ->> 'language', '')),
      bnf_ark        = coalesce(b.bnf_ark, nullif(p_data ->> 'bnf_ark', ''))
    where b.id = v_other_id;
  else
    update books b set
      title           = case when p_data ? 'title' and nullif(trim(p_data ->> 'title'), '') is not null
                             then trim(p_data ->> 'title') else b.title end,
      subtitle        = case when p_data ? 'subtitle' then nullif(p_data ->> 'subtitle', '') else b.subtitle end,
      description     = case when p_data ? 'description' then nullif(p_data ->> 'description', '') else b.description end,
      cover_url       = case when p_data ? 'cover_url' then nullif(p_data ->> 'cover_url', '') else b.cover_url end,
      publisher       = case when p_data ? 'publisher' then nullif(p_data ->> 'publisher', '') else b.publisher end,
      published_date  = case when p_data ? 'published_date' then nullif(p_data ->> 'published_date', '') else b.published_date end,
      page_count      = case when p_data ? 'page_count' then (nullif(p_data ->> 'page_count', ''))::integer else b.page_count end,
      language        = case when p_data ? 'language' then nullif(p_data ->> 'language', '') else b.language end,
      isbn10          = case when p_data ? 'isbn10' then v_isbn10 else b.isbn10 end,
      isbn13          = case when p_data ? 'isbn13' then v_isbn13 else b.isbn13 end,
      google_books_id = case when p_data ? 'google_books_id' then v_gbid else b.google_books_id end,
      bnf_ark         = case when p_data ? 'bnf_ark' then nullif(p_data ->> 'bnf_ark', '') else b.bnf_ark end
    where b.id = p_book_id;
  end if;

  -- Auteurs : remplacés si demandé, sinon seulement si la fiche n'en a aucun
  if jsonb_typeof(p_data -> 'contributors') = 'array'
     and jsonb_array_length(p_data -> 'contributors') > 0
     and (v_replace or not exists (select 1 from book_contributors bc where bc.book_id = v_target))
  then
    if v_replace and not v_merged then
      delete from book_contributors bc where bc.book_id = v_target;
    end if;

    if not exists (select 1 from book_contributors bc where bc.book_id = v_target) then
      for v_contrib in select * from jsonb_array_elements(p_data -> 'contributors')
      loop
        continue when nullif(trim(v_contrib ->> 'name'), '') is null;

        select a.id into v_author_id
        from authors a
        where lower(a.name) = lower(trim(v_contrib ->> 'name'));

        if v_author_id is null then
          insert into authors (name) values (trim(v_contrib ->> 'name'))
          returning id into v_author_id;
        end if;

        insert into book_contributors (book_id, author_id, role, position)
        values (
          v_target,
          v_author_id,
          coalesce((nullif(v_contrib ->> 'role', ''))::contributor_role, 'author'),
          v_pos
        )
        on conflict do nothing;

        v_pos := v_pos + 1;
      end loop;
    end if;
  end if;

  return query select v_target, v_merged, v_ub_id;
end;
$$;

revoke all on function public.sync_book(bigint, jsonb) from public, anon;
grant execute on function public.sync_book(bigint, jsonb) to authenticated;
