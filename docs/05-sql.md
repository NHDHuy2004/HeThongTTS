# IMS – PHẦN 5: SQL MIGRATIONS

Toàn bộ DDL đặt trong `supabase/migrations/` (đọc thứ tự):

| File | Nội dung |
|---|---|
| `0001_enums.sql` | Enum dùng xuyên hệ thống |
| `0002_tables.sql` | 29 bảng + PK/FK/unique/check/default |
| `0003_indexes.sql` | Index cho mọi FK + query phổ biến |
| `0004_functions_triggers.sql` | set_updated_at, handle_new_user, log_audit, KPI helpers |
| `0005_rls_roles_policies.sql` | Bật RLS + policies theo role |
| `0006_storage.sql` | Buckets + storage policies |
| `0007_realtime.sql` | Publication realtime |
| `seed.sql` | Dữ liệu mẫu |

Chạy: `supabase db reset` (dev) hoặc `supabase db push` (production).