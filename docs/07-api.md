# IMS – PHẦN 7: API / SERVICE LAYER

> IMS dùng Supabase làm service layer; không có REST server riêng.
> Bảng bên dưới liệt kê các entry-point (client RLS / RPC / Server Action / Route Handler / Edge Function).

## 7.1. Ký hiệu

- **C** = Supabase Client (RLS), **SA** = Server Action (Next.js), **RH** = Route Handler (Next.js), **EF** = Edge Function, **DB** = Database Function/Trigger.

## 7.2. Endpoint mẫu theo nhóm

| Method | Endpoint / Chức năng | Kênh | Role | Description |
|---|---|---|---|---|
| POST | `/auth/signin` | C | anon | Đăng nhập |
| POST | `/auth/signout` | C | user | Đăng xuất |
| POST | `/auth/reset-password` | C | anon | Gửi link reset |
| GET | `/dashboard/stats` | C+DB | admin/hr | KPI dashboard |
| GET | `/interns` | C | admin/hr/mentor | Danh sách intern (RLS theo role) |
| POST | `/interns` (tạo kèm user) | SA | admin/hr | Tạo intern + tài khoản |
| POST | `/interns/import` | SA+RPC | admin/hr | Import CSV — **OPTIONAL** |
| PATCH | `/interns/{id}` | C | admin/hr + self | Cập nhật hồ sơ |
| GET | `/interns/{id}/attendance` | C | admin/hr + mentor phụ trách + self | Lịch sử điểm danh |
| GET | `/mentors` | C | admin/hr | Danh sách mentor |
| POST | `/mentors` | SA | admin/hr | Tạo mentor |
| GET/PATCH | `/departments` | C | admin/hr | CRUD phòng ban |
| GET/POST/PATCH | `/internship-batches` | C/SA | admin/hr | CRUD đợt thực tập |
| PATCH | `/internships/{id}/assign` | SA | admin/hr | Phân bổ department/mentor |
| GET/POST | `/tasks` | C | mentor/hr/admin | CRUD + list task |
| PATCH | `/tasks/{id}/status` | C | intern (task của mình) | Đổi status (RLS hạn chế cột) |
| POST | `/tasks/{id}/comments` | C | all liên quan | Comment |
| POST | `/tasks/{id}/attachments` | C+Storage | mentor/intern liên quan | Đính kèm file |
| POST | `/attendance/check-in` | EF | intern | Check-in GPS server-side |
| POST | `/attendance/check-out` | EF | intern | Check-out |
| GET | `/attendance/export` | RH | admin/hr | Xuất CSV ngày công |
| POST | `/leave-requests` | C | intern | Gửi đơn |
| PATCH | `/leave-requests/{id}` | C | mentor phụ trách / intern khi pending | Duyệt/Cancel |
| POST | `/reports/daily` | C | intern | Nộp báo cáo ngày |
| PATCH | `/reports/{id}` | C | mentor phụ trách | Duyệt + feedback |
| POST | `/evaluations` | C | mentor/hr | Tạo phiếu đánh giá |
| POST | `/evaluations/calculate` | EF | mentor/hr | Tính tổng điểm |
| POST | `/certificates` | EF | admin/hr | Sinh chứng nhận + PDF |
| GET | `/notifications` | C | self | Danh sách thông báo |
| POST | `/notifications/devices` | C | self | Đăng ký token FCM |
| POST | `/notifications/send` | EF | mentor/hr/admin | Gửi push |
| GET | `/audit-logs` | C | admin | Xem nhật ký |
| GET/PATCH | `/settings` | C + DB | admin | Cấu hình hệ thống |

## 7.3. Nơi chạy logic

| Loại logic | Nơi chạy |
|---|---|
| Đọc dữ liệu, filter, sort | Client (RLS kiểm soát) |
| Tạo sửa dữ liệu đơn giản được RLS cho phép | Client |
| Tạo user, gửi email, nghiệp vụ có secret | Server Action (service role) |
| Export file, webhook (Resend/FCM) | Route Handler |
| Check-in GPS, send-notification, generate-certificate | Edge Function (bảo vệ anti-gian lận) |
| Defaults, updated_at, audit, xóa mềm, tạo profile | Database Trigger |
| KPI, tổng hợp, phân quyền nâng cao | Database Function (RPC) |

## 7.4. Chuẩn response (Server Action / EF)

```jsonc
// Thành công
{ "ok": true, "data": { ... } }
// Thất bại — dùng error code chuẩn (theo Phần 25)
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```