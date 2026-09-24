-- ==========================================================================
-- IMS – 0006_storage.sql
-- Buckets + Storage Policies theo role.
-- Tree:
--   avatars/  cvs/  onboarding/  task-attachments/  report-attachments/
--   request-attachments/  certificates/
--
-- Idempotent: chạy lại nhiều lần đều được (drop policy if exists trước create).
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Tạo buckets (private, trừ certificates vs public khi phát hành)
-- --------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('avatars',             'avatars',              false),
  ('cvs',                 'cvs',                  false),
  ('onboarding',          'onboarding',           false),
  ('task-attachments',    'task-attachments',     false),
  ('report-attachments',  'report-attachments',   false),
  ('request-attachments', 'request-attachments',  false),
  ('certificates',        'certificates',         false)
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- Giới hạn filesize & MIME (nếu bảng storage.buckets hỗ trợ cột này)
-- --------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit') then
    update storage.buckets
      set file_size_limit = 10485760 -- 10 MB
    where id in ('avatars','cvs','onboarding','task-attachments','report-attachments','request-attachments','certificates');
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
    update storage.buckets
      set allowed_mime_types = array[
        'application/pdf',
        'image/png',
        'image/jpeg',
        'text/plain',
        'text/csv',
        'application/json',
        'application/zip',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/x-7z-compressed'
      ]
    where id in ('avatars','cvs','onboarding','task-attachments','report-attachments','request-attachments');
  end if;
end $$;

-- --------------------------------------------------------------------------
-- Helper path: đối tượng thuộc user hiện tại nếu thư mục đầu = user_id
-- (TRÁNH tạo function trong schema `storage` — SQL Editor của cloud thường
--  không có quyền CREATE trên schema này; policy dùng trực tiếp
--  storage.foldername() như bên dưới.)
-- --------------------------------------------------------------------------

-- ==========================================================================
-- AVATARS
-- ==========================================================================
drop policy if exists "avatars_read_owner" on storage.objects;
create policy "avatars_read_owner" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid());
drop policy if exists "avatars_read_hr_admin" on storage.objects;
create policy "avatars_read_hr_admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and public.is_hr_or_admin());
drop policy if exists "avatars_insert_owner" on storage.objects;
create policy "avatars_insert_owner" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_update_owner" on storage.objects;
create policy "avatars_update_owner" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid())
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_delete_owner" on storage.objects;
create policy "avatars_delete_owner" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars' and owner = auth.uid());

-- ==========================================================================
-- CVS (intern tự tải CV; hr/admin quản lý)
-- ==========================================================================
drop policy if exists "cvs_read_owner" on storage.objects;
create policy "cvs_read_owner" on storage.objects
  for select to authenticated
  using (bucket_id = 'cvs' and owner = auth.uid());
drop policy if exists "cvs_read_hr_admin" on storage.objects;
create policy "cvs_read_hr_admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'cvs' and public.is_hr_or_admin());
drop policy if exists "cvs_read_mentor" on storage.objects;
create policy "cvs_read_mentor" on storage.objects
  for select to authenticated
  using (bucket_id = 'cvs' and public.get_my_role() = 'mentor');
drop policy if exists "cvs_insert_owner" on storage.objects;
create policy "cvs_insert_owner" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "cvs_insert_hr_admin" on storage.objects;
create policy "cvs_insert_hr_admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'cvs' and public.is_hr_or_admin());
drop policy if exists "cvs_delete_owner" on storage.objects;
create policy "cvs_delete_owner" on storage.objects
  for delete to authenticated using (bucket_id = 'cvs' and owner = auth.uid());
drop policy if exists "cvs_delete_hr_admin" on storage.objects;
create policy "cvs_delete_hr_admin" on storage.objects
  for delete to authenticated using (bucket_id = 'cvs' and public.is_hr_or_admin());

-- ==========================================================================
-- ONBOARDING docs (mọi authenticated đọc; hr/admin write)
-- ==========================================================================
drop policy if exists "onboarding_read" on storage.objects;
create policy "onboarding_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'onboarding');
drop policy if exists "onboarding_insert_hr_admin" on storage.objects;
create policy "onboarding_insert_hr_admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'onboarding' and public.is_hr_or_admin());
drop policy if exists "onboarding_update_hr_admin" on storage.objects;
create policy "onboarding_update_hr_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'onboarding' and public.is_hr_or_admin())
  with check (bucket_id = 'onboarding' and public.is_hr_or_admin());
drop policy if exists "onboarding_delete_hr_admin" on storage.objects;
create policy "onboarding_delete_hr_admin" on storage.objects
  for delete to authenticated using (bucket_id = 'onboarding' and public.is_hr_or_admin());

-- ==========================================================================
-- TASK-ATTACHMENTS (participant + hr/admin)
-- ==========================================================================
drop policy if exists "taskatts_select_owner" on storage.objects;
create policy "taskatts_select_owner" on storage.objects
  for select to authenticated using (bucket_id = 'task-attachments' and owner = auth.uid());
drop policy if exists "taskatts_select_hr_admin" on storage.objects;
create policy "taskatts_select_hr_admin" on storage.objects
  for select to authenticated using (bucket_id = 'task-attachments' and public.is_hr_or_admin());
drop policy if exists "taskatts_insert_owner" on storage.objects;
create policy "taskatts_insert_owner" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "taskatts_insert_hr_admin" on storage.objects;
create policy "taskatts_insert_hr_admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'task-attachments' and public.is_hr_or_admin());
drop policy if exists "taskatts_delete_owner" on storage.objects;
create policy "taskatts_delete_owner" on storage.objects
  for delete to authenticated using (bucket_id = 'task-attachments' and owner = auth.uid());
drop policy if exists "taskatts_delete_hr_admin" on storage.objects;
create policy "taskatts_delete_hr_admin" on storage.objects
  for delete to authenticated using (bucket_id = 'task-attachments' and public.is_hr_or_admin());

-- ==========================================================================
-- REPORT-ATTACHMENTS
-- ==========================================================================
drop policy if exists "reportatts_select_owner" on storage.objects;
create policy "reportatts_select_owner" on storage.objects
  for select to authenticated using (bucket_id = 'report-attachments' and owner = auth.uid());
drop policy if exists "reportatts_select_hr_admin" on storage.objects;
create policy "reportatts_select_hr_admin" on storage.objects
  for select to authenticated using (bucket_id = 'report-attachments' and public.is_hr_or_admin());
drop policy if exists "reportatts_insert_owner" on storage.objects;
create policy "reportatts_insert_owner" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'report-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "reportatts_insert_hr_admin" on storage.objects;
create policy "reportatts_insert_hr_admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'report-attachments' and public.is_hr_or_admin());
drop policy if exists "reportatts_delete_owner" on storage.objects;
create policy "reportatts_delete_owner" on storage.objects
  for delete to authenticated using (bucket_id = 'report-attachments' and owner = auth.uid());
drop policy if exists "reportatts_delete_hr_admin" on storage.objects;
create policy "reportatts_delete_hr_admin" on storage.objects
  for delete to authenticated using (bucket_id = 'report-attachments' and public.is_hr_or_admin());

-- ==========================================================================
-- REQUEST-ATTACHMENTS
-- ==========================================================================
drop policy if exists "reqatts_select_owner" on storage.objects;
create policy "reqatts_select_owner" on storage.objects
  for select to authenticated using (bucket_id = 'request-attachments' and owner = auth.uid());
drop policy if exists "reqatts_select_hr_admin" on storage.objects;
create policy "reqatts_select_hr_admin" on storage.objects
  for select to authenticated using (bucket_id = 'request-attachments' and public.is_hr_or_admin());
drop policy if exists "reqatts_insert_owner" on storage.objects;
create policy "reqatts_insert_owner" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'request-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "reqatts_insert_hr_admin" on storage.objects;
create policy "reqatts_insert_hr_admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'request-attachments' and public.is_hr_or_admin());
drop policy if exists "reqatts_delete_owner" on storage.objects;
create policy "reqatts_delete_owner" on storage.objects
  for delete to authenticated using (bucket_id = 'request-attachments' and owner = auth.uid());
drop policy if exists "reqatts_delete_hr_admin" on storage.objects;
create policy "reqatts_delete_hr_admin" on storage.objects
  for delete to authenticated using (bucket_id = 'request-attachments' and public.is_hr_or_admin());

-- ==========================================================================
-- CERTIFICATES (intern xem chứng nhận của mình; hr/admin + mentor write)
-- ==========================================================================
drop policy if exists "certs_select_owner" on storage.objects;
create policy "certs_select_owner" on storage.objects
  for select to authenticated using (bucket_id = 'certificates' and owner = auth.uid());
drop policy if exists "certs_select_hr_admin" on storage.objects;
create policy "certs_select_hr_admin" on storage.objects
  for select to authenticated using (bucket_id = 'certificates' and public.is_hr_or_admin());
drop policy if exists "certs_insert_hr_admin" on storage.objects;
create policy "certs_insert_hr_admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'certificates' and public.is_hr_or_admin());

-- ==========================================================================
-- (0) File công khai nếu cần chia sẻ: dùng signed URL do EF generate
--     thay vì mở public bucket — tăng bảo mật.
-- ==========================================================================