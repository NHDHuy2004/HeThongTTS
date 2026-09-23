# IMS – Internship Management System

Quản lý toàn bộ vòng đời thực tập sinh: đợt thực tập, hồ sơ, onboarding, phân bổ
Phòng ban/Mentor, task, điểm danh, đơn từ, báo cáo, đánh giá, chứng nhận, analytics,
email (Resend) và push notification (FCM).

## Kiến trúc

| Thành phần | Công nghệ | Thư mục |
|---|---|---|
| Web Admin Portal | Next.js (App Router) + TypeScript + Tailwind + Shadcn UI | `web-admin/` |
| Mobile App | Flutter + Riverpod + supabase_flutter + FCM | `mobile/` |
| Backend / Data | Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions) | `supabase/` |
| Email | Resend | – |
| Push | Firebase Cloud Messaging | – |
| Deploy | Vercel (Web) · Codemagic (Mobile) | – |

Tài liệu thiết kế: [`docs/`](docs/README.md).

## Giai đoạn triển khai

1. **Giai đoạn 1 – Database & Supabase** (đang làm): migrations, RLS, Storage, seed, test RLS.
2. **Giai đoạn 2 – Web Admin**: Next.js toàn bộ module quản trị.
3. **Giai đoạn 3 – Mobile App**: Flutter (auth, GPS check-in, task, report, request, notification, mentor view).
4. **Giai đoạn 4 – Integration & Testing**: Realtime, Edge Functions, Resend, FCM, certificate, E2E.
5. **Giai đoạn 5 – Go-Live**: Vercel, Codemagic, Supabase production, monitoring, docs, training.

## Khởi động local (Giai đoạn 1)

Yêu cầu: Docker Desktop (cho Supabase local), Node 20+, Supabase CLI.

```bash
# 1. Khởi động Supabase local (DB + Auth + Storage + Edge Functions + Realtime)
supabase start          # chạy docker stack, áp migrations + seed tự động

# 2. Reset database (migrations + seed)
supabase db reset

# 3. Kiểm thử RLS bằng script giả lập session theo 4 vai trò
supabase db execute -f supabase/scripts/test_rls.sql
```

> Nếu chưa có Docker: dùng Supabase Cloud (`supabase link --project-ref <ref>` + `supabase db push`).

### Tài khoản demo (từ seed)

| Email | Mật khẩu | Vai trò |
|---|---|---|
| `admin@ims.local` | `Admin@123` | System Admin |
| `hr@ims.local` | `Hr@123456` | HR Manager |
| `mentor@ims.local` | `Mentor@123` | Mentor |
| `intern@ims.local` | `Intern@123` | Intern |

## Cấu hình environment

Xem [`.env.example`](.env.example). Không commit secret thật vào git.

## Bảo mật

- RLS bật toàn bộ bảng dữ liệu người dùng (xem `supabase/migrations/0005_rls_policies.sql`).
- Role lấy từ DB (`get_my_role()`), không tin client.
- Check-in GPS chỉ qua Edge Function (server-side).
- Service role / Resend / FCM secret chỉ tồn tại phía server (Edge Function / Server Action).