-- Couvertures ajoutées par les utilisateurs (photo prise avec le téléphone, par exemple).
-- Bucket public "covers" ; chaque utilisateur écrit dans le dossier <son uuid>/.
-- Script rejouable sans danger.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "covers_insert_own" on storage.objects;
drop policy if exists "covers_update_own" on storage.objects;
drop policy if exists "covers_delete_own" on storage.objects;

create policy "covers_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "covers_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "covers_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
