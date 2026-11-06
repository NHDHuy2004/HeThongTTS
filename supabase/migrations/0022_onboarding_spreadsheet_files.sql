-- Allow Excel spreadsheets in onboarding catalog and record documents.

alter table public.onboarding_document_versions
  drop constraint if exists onboarding_document_version_mime_check;

alter table public.onboarding_document_versions
  add constraint onboarding_document_version_mime_check check (mime_type in (
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ));

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]
where id = 'onboarding';

create or replace function public.submit_onboarding_document_version(
  p_document_id uuid,
  p_file_path text,
  p_file_name text,
  p_file_size bigint,
  p_mime_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.onboarding_documents%rowtype;
  v_version integer;
  v_version_id uuid;
  v_parts text[];
  v_stored_metadata jsonb;
  v_storage_owner_id text;
  v_stored_mime text;
  v_stored_size bigint;
begin
  select * into v_document
  from public.onboarding_documents
  where id = p_document_id
  for update;

  if not found or not public.can_submit_onboarding_document(p_document_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_parts := string_to_array(p_file_path, '/');
  if array_length(v_parts, 1) <> 5
    or v_parts[1] <> 'records'
    or v_parts[3] <> 'documents'
    or v_parts[2] <> v_document.onboarding_id::text
    or v_parts[4] <> p_document_id::text then
    raise exception 'INVALID_DOCUMENT_PATH' using errcode = '23514';
  end if;

  if p_file_size <= 0 or p_file_size > 10485760 then
    raise exception 'DOCUMENT_FILE_SIZE_INVALID' using errcode = '23514';
  end if;

  if p_mime_type not in (
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) then
    raise exception 'DOCUMENT_MIME_INVALID' using errcode = '23514';
  end if;

  select metadata, owner_id
  into v_stored_metadata, v_storage_owner_id
  from storage.objects
  where bucket_id = 'onboarding'
    and name = p_file_path
  for update;

  if not found then
    raise exception 'DOCUMENT_FILE_NOT_FOUND';
  end if;

  if v_storage_owner_id is distinct from auth.uid()::text then
    raise exception 'DOCUMENT_FILE_NOT_OWNED' using errcode = '42501';
  end if;

  v_stored_mime := nullif(v_stored_metadata ->> 'mimetype', '');
  v_stored_size := nullif(v_stored_metadata ->> 'size', '')::bigint;
  if v_stored_mime is not null and v_stored_mime <> p_mime_type then
    raise exception 'DOCUMENT_MIME_MISMATCH' using errcode = '23514';
  end if;
  if v_stored_size is not null and v_stored_size <> p_file_size then
    raise exception 'DOCUMENT_SIZE_MISMATCH' using errcode = '23514';
  end if;

  select coalesce(max(version_number), 0) + 1
  into v_version
  from public.onboarding_document_versions
  where document_id = p_document_id;

  insert into public.onboarding_document_versions (
    document_id,
    file_path,
    file_name,
    file_size,
    mime_type,
    uploaded_by,
    version_number
  )
  values (
    p_document_id,
    p_file_path,
    left(regexp_replace(p_file_name, '[^a-zA-Z0-9._ -]', '_', 'g'), 180),
    p_file_size,
    p_mime_type,
    auth.uid(),
    v_version
  )
  returning id into v_version_id;

  update public.onboarding_documents
  set status = 'pending_review',
      current_version_id = v_version_id,
      reviewed_version_id = null,
      submitted_by = auth.uid(),
      submitted_at = now(),
      reviewed_by = null,
      reviewed_at = null,
      feedback = null
  where id = p_document_id;

  return v_version_id;
end;
$$;
