-- =============================================================================
-- PCMS — 0002 : stockage privé des documents
--
-- Bucket « documents » : privé, taille et types de fichiers contraints côté
-- serveur. Les URLs signées sont générées à la demande (voir
-- src/lib/documents/storage.ts), aucune URL publique n''existe.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760, -- 10 Mio
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- --- Politiques Storage -----------------------------------------------------
-- RLS est déjà activé sur storage.objects par Supabase ; on ne fait qu''ajouter
-- les règles propres au bucket « documents ».

drop policy if exists "documents_storage_read" on storage.objects;
create policy "documents_storage_read"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents');

drop policy if exists "documents_storage_insert" on storage.objects;
create policy "documents_storage_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.can_write());

drop policy if exists "documents_storage_update" on storage.objects;
create policy "documents_storage_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public.can_write())
  with check (bucket_id = 'documents' and public.can_write());

drop policy if exists "documents_storage_delete" on storage.objects;
create policy "documents_storage_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_admin());
