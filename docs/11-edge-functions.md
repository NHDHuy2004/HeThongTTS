# IMS – PHẦN 11: EDGE FUNCTIONS

> Deno TypeScript, chạy trong Supabase Edge Runtime. Ký JWT của service role. Tất cả bắt buộc xác thực user.

| # | Function | Trigger | Input | Processing | Output | Security |
|---|---|---|---|---|---|---|
| 1 | `check-in` | Mobile POST | `{ lat, lng, timestamp?, action: check_in\|check_out, location_id? }` | Xác thực JWT → `is_intern` → internship active → Haversine ≤ radius(location) → status giờ (late…) → duplicate check → insert/update attendance | `{ ok, attendance }` | JWT required; tọa độ gửi từ server-location (gần đúng); giờ server-side; chống double check-in; CHỐT: không để client tự insert |
| 2 | `admin-create-user` | Web SA/EF call | `{ email, password, full_name, role, ... }` | Service role: `auth.admin.createUser` → insert `profiles` (+ interns/mentors) → gửi email welcome | `{ ok, user_id }` | Chỉ role admin/hr (check qua get_my_role) |
| 3 | `send-welcome-email` | slot trong admin-create-user | `{ user_id }` | Lấy profile/intern + internship → render template → Resend send | `{ ok }` | Secret từ env; chỉ admin/hr |
| 4 | `send-notification` | nghiệp vụ / admin gửi | `{ user_ids[], type, title, body, data }` | Insert `notifications` → query `notification_devices` → gọi FCM v1 cho từng token → update `sent_at` | `{ ok, delivered }` | JWT + role; rate-limit; không gửi file nhạy cảm |
| 5 | `generate-certificate` | POST khi hoàn thành internship | `{ internship_id }` | Validate hoàn thành → sinh `certificate_code` → tạo PDF (pdf-lib, tiếng Việt) → upload Storage `certificates/` → insert row | `{ ok, url }` | Chỉ admin/hr/mentor chủ quản; chống trùng code |
| 6 | `calculate-evaluation` | POST sau khi scores đủ | `{ evaluation_id }` | Đọc scores → trung bình có trọng số → cập nhật `evaluations.final_score` + summary | `{ ok, final_score }` | JWT + role mentor/hr/admin |
| 7 | `export-attendance` | GET/query | `{ from, to, department_id? }` | Query attendance qua service role → sinh CSV → trả file/upload | CSV bytes | Chỉ admin/hr |

## 11.1. Env / secrets

Mỗi function `supabase/functions/<name>/deno.json` khai báo:
```
"import_map": "../import_map.json"
```
Secrets qua `supabase secrets set` (FCM_PRIVATE_KEY, RESEND_API_KEY…): chỉ đọc trong server runtime, không bao giờ trong client.

## 11.2. Chuẩn code

- Khởi đầu: kiểm tra `Authorization: Bearer` decode JWT bằng `supabase.auth.getUser()` (service role) hoặc verify plugin.
- Trả lỗi theo code chuẩn: `{ ok:false, error:{ code, message } }`.
- CORS: `Access-Control-Allow-Origin: https://your-domain` (hoặc mở cho app store)](docs/14-security)