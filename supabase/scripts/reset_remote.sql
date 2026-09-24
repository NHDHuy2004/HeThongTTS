-- ==========================================================================
-- IMS – reset_remote.sql  (DEV ONLY — DESTRUCTIVE)
-- Reset toàn bộ schema `public` của REMOTE Supabase project, sau đó
-- run lại migrations theo đúng thứ tự 0001 → 0007 (và seed nếu muốn).
--
-- CÁCH DÙNG (Dashboard → SQL Editor):
--   1) Chạy file này (1 lần).
--   2) Dán & chạy lần lượt: 0001_enums → 0002_tables → 0003_indexes
--      → 0004_functions_triggers → 0005_rls_policies → 0006_storage
--      → 0007_realtime.
--   3) (Tùy chọn) chạy supabase/seed.sql để nạp dữ liệu demo.
--
-- LƯU Ý: KHÔNG xoá auth.users (tài khoản login) — schema `auth` không đụng tới.
--         Xoá hết object public: tables, views, types, functions, triggers, indexes.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Xoá storage policies của 0006 (policy gắn vào storage.objects nên
--    SỐNG trong schema `storage`, không bị xoá theo DROP SCHEMA public).
-- --------------------------------------------------------------------------
drop policy if exists "avatars_read_owner"          on storage.objects;
drop policy if exists "avatars_read_hr_admin"       on storage.objects;
drop policy if exists "avatars_insert_owner"        on storage.objects;
drop policy if exists "avatars_update_owner"        on storage.objects;
drop policy if exists "avatars_delete_owner"        on storage.objects;

drop policy if exists "cvs_read_owner"              on storage.objects;
drop policy if exists "cvs_read_hr_admin"           on storage.objects;
drop policy if exists "cvs_read_mentor"             on storage.objects;
drop policy if exists "cvs_insert_owner"            on storage.objects;
drop policy if exists "cvs_insert_hr_admin"         on storage.objects;
drop policy if exists "cvs_delete_owner"            on storage.objects;
drop policy if exists "cvs_delete_hr_admin"         on storage.objects;

drop policy if exists "onboarding_read"             on storage.objects;
drop policy if exists "onboarding_insert_hr_admin"  on storage.objects;
drop policy if exists "onboarding_update_hr_admin"  on storage.objects;
drop policy if exists "onboarding_delete_hr_admin"  on storage.objects;

drop policy if exists "taskatts_select_owner"       on storage.objects;
drop policy if exists "taskatts_select_hr_admin"    on storage.objects;
drop policy if exists "taskatts_insert_owner"       on storage.objects;
drop policy if exists "taskatts_insert_hr_admin"    on storage.objects;
drop policy if exists "taskatts_delete_owner"       on storage.objects;
drop policy if exists "taskatts_delete_hr_admin"    on storage.objects;

drop policy if exists "reportatts_select_owner"     on storage.objects;
drop policy if exists "reportatts_select_hr_admin"  on storage.objects;
drop policy if exists "reportatts_insert_owner"     on storage.objects;
drop policy if exists "reportatts_insert_hr_admin"  on storage.objects;
drop policy if exists "reportatts_delete_owner"     on storage.objects;
drop policy if exists "reportatts_delete_hr_admin"  on storage.objects;

drop policy if exists "reqatts_select_owner"        on storage.objects;
drop policy if exists "reqatts_select_hr_admin"     on storage.objects;
drop policy if exists "reqatts_insert_owner"        on storage.objects;
drop policy if exists "reqatts_insert_hr_admin"     on storage.objects;
drop policy if exists "reqatts_delete_owner"        on storage.objects;
drop policy if exists "reqatts_delete_hr_admin"     on storage.objects;

drop policy if exists "certs_select_owner"          on storage.objects;
drop policy if exists "certs_select_hr_admin"       on storage.objects;
drop policy if exists "certs_insert_hr_admin"       on storage.objects;

-- --------------------------------------------------------------------------
-- 2. Xoá schema public + tạo lại trống
-- --------------------------------------------------------------------------
drop schema if exists public cascade;
create schema public;

-- --------------------------------------------------------------------------
-- 3. Khôi phục quyền chuẩn Supabase trên schema public
-- --------------------------------------------------------------------------
revoke all on schema public from public;

grant all on schema public to postgres;
grant all on schema public to anon;
grant all on schema public to authenticated;
grant all on schema public to service_role;

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;