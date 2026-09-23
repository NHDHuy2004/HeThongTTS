# IMS – PHẦN 12: EMAIL (RESEND)

## 12.1. Templates

| Template | Trigger | Người nhận | Nội dung |
|---|---|---|---|
| `welcome` | Admin tạo tài khoản intern | Intern | Chào mừng, thông tin đợt, link web/mobile |
| `account-info` | Tạo tài khoản | Intern/Mentor | Email đăng nhập, hướng dẫn đổi mật khẩu |
| `onboarding-docs` | HR gán tài liệu onboarding | Intern | Danh sách tài liệu + checklist |
| `task-assigned` | Mentor tạo task cho intern (có deadline) | Intern | Tên task, deadline, priority |
| `report-approved` / `report-rejected` | Mentor duyệt report | Intern | Kết quả + feedback |
| `request-approved` / `request-rejected` | Xử lý đơn | Intern | Kết quả đơn nghỉ/WFH/muộn |
| `internship-completed` | Internship chuyển completed | Intern | Tổng kết, hướng dẫn lấy chứng nhận |
| `certificate-ready` | EF generate-certificate xong | Intern | Link PDF |
| `password-reset` | User yêu cầu reset | User | Link reset (dùng template auth nếu qua GoTrue) |
| `mentor-assigned` | HR phân mentor | Mentor & Intern | Thông tin phụ trách |

## 12.2. Gửi từ server-side duy nhất

- Web: Server Action / Route Handler gọi `resend.emails.send()` với `RESEND_API_KEY` (server env).
- Edge Function: `send-welcome-email`, `send-notification` khi không qua web (mobile-only flow).
- Không bao giờ để `RESEND_API_KEY` trong bundle client.

## 12.3. Chống spam & tracking

- Sử dụng `ReplyTo` = mentor/HR validate; worker Resend tracking click/open bật ở dashboard.