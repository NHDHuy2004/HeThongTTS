# IMS – PHẦN 14: SECURITY

## 14.1. Authentication

- Supabase Auth: email/password, mã hóa bcrypt bên trong `auth.users`.
- Không lưu password ở bảng nghiệp vụ; session cookie `httpOnly` (web), `Secure` `SameSite=Lax` (https).
- Mobile: token lưu trong secure storage (không SharedPreferences plaintext).
- Password reset hết hạn; bật `enable_signup=false` trong production (tài khoản chỉ do admin tạo).

## 14.2. Authorization

- RBAC qua `get_my_role()` (DB helper, phụ thuộc session — không nhận role từ client).
- Mọi mutation quan trọng có RLS chặn; EF/Server Action validate lại role.
- Giới hạn mentor chỉ thao tác intern `is_mentor_of()`.

## 14.3. RLS

- Bật cho toàn bộ bảng dữ liệu người dùng (xem `0005_rls_policies.sql`).
- Helper `SECURITY DEFINER` để policy không bị đệ quy và không leak qua function khác.
- Admin endpoint qua EF/Server Action (service role) — không qua client anon.

## 14.4. Storage Security

- Bucket private (trừ `certificates` có thể public theo flag khi chuẩn bị chia sẻ).
- Policy Storage kiểm tra role + quyền sở hữu entity; MIME whitelist: `application/pdf`, `image/png`, `image/jpeg`, `text/csv`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/zip`.
- Filesize ≤ 10 MB (client + server validate); path theo cấu trúc `$bucket/$user_id/...` để tránh traversal.

## 14.5. API Security

- JWT bắt buộc; service role key chỉ server-side; rate-limit EF.
- Validate input cả hai tầng; trả lỗi theo code chuẩn; không leak stack/detail DB.

## 14.6. Secret Management

- `.env.local` (web) / Codemagic env / Supabase secrets — luôn trong `.gitignore`.
- `FCM_PRIVATE_KEY`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` không bao giờ commit.
- Kiểm tra security scan (gitleaks hoặc secret scan) trong CI.

## 14.7. File Security

- Upload qua Storage (mime + size) — không cho đường dẫn tùy ý.
- Anti-path-traversal: bỏ `../`, `~`, đường dẫn tuyệt đối.
- Xem file PDF qua signed URL hết hạn thay vì công khai lâu dài.

## 14.8. GPS Security

- EF check-in: khoảng cách tính server-side; giờ server hệ thống (không tin giờ máy); chống replay bằng timestamp window (±5 phút) + chống double check-in cùng ngày; tọa độ làm tròn để giảm độ chính xác nếu cần — **OPTIONAL**: ép `os`+app signature xác thực.

## 14.9. Audit

- Trigger `log_audit` ghi INSERT/UPDATE/DELETE cho bảng trọng yếu (permission, interns, internships, tasks, evaluations, certificates, requests status…).
- `audit_logs` chỉ đọc cho admin; không ai (kể cả service_role với bản business db) xóa/ghi tay ngoài trigger (policy + trigger security definer).