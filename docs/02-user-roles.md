# IMS – PHẦN 2: USER ROLES & PHÂN QUYỀN

Role được lưu trong bảng `roles` (nghiệp vụ) + ánh xạ qua `profiles.role_id`. Không tin role từ client.

| Feature | Admin | HR Manager | Mentor | Intern |
| --- | :---: | :---: | :---: | :---: |
| Xem dashboard tổng quan | ✅ | ✅ | 👁 (intern của mình) | — |
| Quản lý người dùng / role | ✅ | — | — | — |
| Quản lý phòng ban (CRUD) | ✅ | 👁 | — | — |
| Quản lý đợt thực tập (CRUD, đóng/mở) | ✅ | ✅ | — | — |
| Tạo tài khoản Intern | ✅ | ✅ | — | — |
| Import danh sách Intern (CSV) — **OPTIONAL** | ✅ | ✅ | — | — |
| Quản lý hồ sơ Intern (view/edit, upload CV) | ✅ | ✅ | 👁 (phụ trách) | edit hồ sơ giới hạn |
| Phân bổ phòng ban cho Intern | ✅ | ✅ | — | — |
| Phân bổ Mentor cho Intern | ✅ | ✅ | — | — |
| Quản lý Onboarding checklist & tài liệu | ✅ | ✅ | — | xem + hoàn thành |
| Gửi Welcome / Account email | ✅ | ✅ | — | — |
| Quản lý Task (tạo/giao/deadline/status) | ✅ | ✅ | ✅ (cho intern phụ trách) | xem/update task của mình |
| Kanban / List view Task | ✅ | ✅ | ✅ | — |
| Comment / Attachment trên Task | ✅ | ✅ | ✅ | ✅ (task của mình) |
| Quản lý Template Task | ✅ | ✅ | 👁 | — |
| Điểm danh (check-in/check-out) | 👁 | 👁 | 👁 (intern phụ trách) | ✅ (chính mình) |
| Xuất ngày công (export) | ✅ | ✅ | — | — |
| Duyệt nghỉ phép / WFH / đi muộn | ✅ | ✅ | ✅ | gửi + xem trạng thái |
| Nộp Daily/Weekly Report | — | — | — | ✅ |
| Duyệt / feedback / chấm điểm Report | ✅ | ✅ | ✅ (intern phụ trách) | xem kết quả của mình |
| Đánh giá (weekly/midterm/final/360) | ✅ | ✅ | ✅ | xem kết quả của mình |
| Sinh chứng nhận / xuất PDF | ✅ | ✅ | — | xem chứng nhận của mình |
| Quản lý cấu hình hệ thống | ✅ | — | — | — |
| Địa điểm điểm danh (GPS) | ✅ | — | — | — |
| Xem Audit Log | ✅ | — | — | — |
| Push/Email notification | ✅ (tạo) | ✅ (tạo) | ✅ (tạo) | ✅ (nhận) |
| Realtime nhận cập nhật | ✅ | ✅ | ✅ | ✅ |

Ghi chú:
- 👁 = chỉ xem phạm vi được phân cấp (inter dưới quyền).
- Mọi quyền ghi của Mentor đều bị RLS giới hạn theo `is_mentor_of()`.
- Intern chỉ đọc/ghi dữ liệu của chính mình (ngoại trừ status report khi bị reject).