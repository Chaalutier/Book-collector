-- =====================================================================
-- Book Collector — fusion de séries
-- ---------------------------------------------------------------------
-- À coller dans Supabase > SQL Editor puis "Run" (après la migration v2).
-- 1. Ajoute la fonction merge_series() utilisée par la page d'une série
-- 2. Nettoie les séries mal détectées du type
--    "Dungeon Crawler Carl : L'Oeil de la Veuve du Chaos"
--    en les fusionnant dans "Dungeon Crawler Carl".
-- Le script peut être relancé sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Fusion manuelle : déplace les tomes de p_source vers p_target
-- ---------------------------------------------------------------------
create or replace function public.merge_series(p_source bigint, p_target bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source series%rowtype;
  v_target series%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Utilisateur non connecté' using errcode = '42501';
  end if;
  if p_source = p_target then
    raise exception 'Impossible de fusionner une série avec elle-même' using errcode = '22023';
  end if;

  select * into v_source from series where id = p_source;
  select * into v_target from series where id = p_target;
  if v_source.id is null or v_target.id is null then
    raise exception 'Série introuvable' using errcode = 'P0002';
  end if;

  update books set series_id = p_target where series_id = p_source;

  update series set
    total_volumes = greatest(v_target.total_volumes, v_source.total_volumes),
    is_finished   = v_target.is_finished or v_source.is_finished
  where id = p_target;

  delete from series where id = p_source;
end;
$$;

revoke all on function public.merge_series(bigint, bigint) from public, anon;
grant execute on function public.merge_series(bigint, bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Nettoyage automatique des séries "Série : sous-titre"
-- ---------------------------------------------------------------------
do $$
declare
  r          record;
  v_prefix   text;
  v_subtitle text;
  v_parent   bigint;
begin
  for r in
    select id, title, category
    from series
    where title ~ '\s(:|-|–|—)\s'
    order by id
  loop
    v_prefix   := trim(substring(r.title from '^(.+?)\s(?::|-|–|—)\s'));
    v_subtitle := trim(substring(r.title from '^.+?\s(?::|-|–|—)\s(.+)$'));
    continue when v_prefix is null or v_prefix = '';

    -- Série "parente" déjà existante (même catégorie) ?
    select id into v_parent
    from series
    where lower(title) = lower(v_prefix) and category = r.category and id <> r.id
    limit 1;

    -- Sinon, on ne la crée que si plusieurs séries partagent ce préfixe
    if v_parent is null then
      if (select count(*) from series
          where category = r.category
            and lower(title) like lower(v_prefix) || ' %'
            and title ~ '\s(:|-|–|—)\s') < 2 then
        continue;
      end if;
      insert into series (title, category)
      values (v_prefix, r.category)
      returning id into v_parent;
    end if;

    -- Le sous-titre de l'ancienne série devient le titre du tome
    -- quand le livre n'a qu'un titre générique ("Tome 6", ou le nom complet)
    update books
    set title = v_subtitle
    where series_id = r.id
      and v_subtitle is not null
      and (title ~* '^\s*(tome|t\.|vol)' or lower(title) = lower(r.title) or lower(title) = lower(v_prefix));

    update books set series_id = v_parent where series_id = r.id;
    delete from series where id = r.id;

    raise notice 'Série "%" fusionnée dans "%"', r.title, v_prefix;
  end loop;
end;
$$;
