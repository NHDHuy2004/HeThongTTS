# IMS – PHẦN 20: TEST CASE MODULE ĐIỂM DANH (ATTENDANCE)

> **Ngày tạo:** 2026-11-06 · **Môi trường:** Supabase remote `ktgpdejblczvepqferkb` + `web-admin` (Next.js)
> **Công cụ:** `node:test` (Node 24, zero-dependency), test tích hợp chạy thật qua PostgREST/GoTrue bằng JWT từng role.
> **Dữ liệu test:** tiền tố `TEST-QA-` (tạo bằng service role, dọn tự động sau phiên) — không đụng dữ liệu thật.
> **Quy ước:** Status chỉ được PASS khi test đã thực sự chạy. `Module` = **Attendance** cho toàn bộ các case dưới đây.
> **Tài khoản test:** `test-qa-admin|hr|mentor1|mentor2|intern01..10@qa.ims.local` / `Test@1234`.

Cấu trúc cột: `ID | Feature | Role | Test Type | Priority | Preconditions | Test Data | Steps | Expected | Actual | Status | Bug ID | Notes`.

---

## A. Nhóm 1 – Check-in / Check-out (RPC `attendance_check` + API `/api/attendance/check`)

| ID | Feature | Role | Test Type | Priority | Preconditions | Test Data | Steps | Expected | Actual | Status | Bug ID | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AT-001 | Check-in tại địa điểm hợp lệ | Intern | Functional | Critical | Intern có internship active, không vướng onboarding; địa điểm `TEST-QA-LOC-MAIN` (bán kính 100m, khung giờ 00:00–23:59) | Tọa độ trong bán kính, accuracy=10 | Gọi RPC `attendance_check(CHECK_IN, toạ độ, acc)` bằng service role với `p_user_id` intern test | `success=true`, có `attendance_id`, `distance_meters` ≤ 100; bản ghi attendance tạo với `work_date` = hôm nay (VN), `check_in_at` ≈ giờ server, `is_geo_validated=true`; log xác minh `is_valid=true` | _chạy bởi automation_ | PASS | – | Trạng thái `present`/`late` tùy `check_in_late` 08:30 |
| AT-002 | Check-in ngoài bán kính | Intern | Functional | Critical | Như AT-001 | Tọa độ cách vị trí ~2.2km | Gọi RPC `CHECK_IN` với tọa độ ngoài radius | `success=false`, code `LOCATION_OUT_OF_RANGE`; không tạo bản ghi attendance; log `is_valid=false`, `failure_reason=LOCATION_OUT_OF_RANGE` | _chạy bởi automation_ | PASS | – | Khoảng cách tính server-side |
| AT-003 | Chưa cấp quyền GPS (trình duyệt) | Intern | UI | Medium | Web yêu cầu `navigator.geolocation` | Từ chối quyền vị trí trên trình duyệt | Mở `/attendance`, bấm Check-in khi trình duyệt hỏi quyền → từ chối | Hiển thị thông báo yêu cầu cấp quyền GPS, không gửi request điểm danh | _cần trình duyệt E2E_ | NOT RUN | – | Không có Playwright → kiểm thử thủ công |
| AT-004 | GPS bị tắt (thiết bị) | Intern | UI | Medium | Thiết bị tắt dịch vụ vị trí | GPS off | Bấm Check-in với GPS tắt | Thông báo bật GPS, không có bản ghi | _cần thiết bị/E2E_ | NOT RUN | – | Manual trên thiết bị thật |
| AT-005 | GPS không xác định được vị trí | Intern | Functional | High | Đã đăng nhập | `latitude=null` / toạ độ không hợp lệ | Gọi RPC với toạ độ null/out-of-range (qua API route: body thiếu latitude) | `VALIDATION_ERROR`, không tạo bản ghi | _chạy bởi automation_ | PASS | – | API route trả 400 |
| AT-006 | GPS độ chính xác thấp | Intern | Functional | High | `TEST-QA-LOC-MAIN.min_accuracy_meters=50` | accuracy=100 | Gọi RPC `CHECK_IN` với accuracy=100 tại vị trí hợp lệ | `ACCURACY_NOT_MET`, không tạo bản ghi, log ghi `failure_reason=ACCURACY_NOT_MET` | _chạy bởi automation_ | PASS | – | Ngưỡng lấy từ địa điểm |
| AT-007 | Check-in hai lần liên tiếp | Intern | Functional | Critical | Đã check-in hôm nay | Nhịp gọi thứ 2 cùng tọa độ | Gọi RPC `CHECK_IN` lần 2 | `ALREADY_CHECKED_IN`; `check_in_at` của bản ghi cũ KHÔNG bị ghi đè | _chạy bởi automation_ | PASS | – | Chống trùng theo `unique(intern_id, work_date)` |
| AT-008 | Check-out khi chưa check-in | Intern | Functional | Critical | Chưa có bản ghi hôm nay | – | Gọi RPC `CHECK_OUT` | `NEED_CHECK_IN`, không tạo bản ghi | _chạy bởi automation_ | PASS | – | |
| AT-009 | Check-out hai lần liên tiếp | Intern | Functional | High | Đã check-out | Lần gọi thứ 2 | Gọi RPC `CHECK_OUT` lần 2 | `ALREADY_CHECKED_OUT`; `check_out_at` cũ không đổi | _chạy bởi automation_ | PASS | – | |
| AT-010 | Check-out ngoài vị trí | Intern | Functional | High | Đã check-in | Tọa độ ~2.2km | Gọi `CHECK_OUT` ngoài bán kính | `LOCATION_OUT_OF_RANGE`, `check_out_at` vẫn null | _chạy bởi automation_ | PASS | – | |
| AT-011 | Lưu đúng giờ check-in/check-out | Intern | Functional | High | Có check-in thành công | – | Đọc lại bản ghi attendance | `check_in_at`/`check_out_at` nằm trong ±60 giây so với giờ server tại thời điểm gọi (không nhận thời gian từ client) | _chạy bởi automation_ | PASS | – | Server dùng `now()` |
| AT-012 | Mất mạng / gọi lại (idempotency) | Intern | Functional | Medium | Đã check-in thành công | Gọi lại request cùng dữ liệu (giả lập retry) | Gọi lại API/RPC sau khi đã ghi nhận | Không tạo bản ghi trùng; trả `ALREADY_CHECKED_IN` (không báo thành công giả lần 2) | _chạy bởi automation_ | PASS | – | Queue offline phía client = manual |
| AT-013 | Tọa độ giả mạo | Intern | Security | Critical | Có tọa độ thật đã lưu | Client gửi tọa độ xa vị trí thật | Gọi API trực tiếp với tọa độ tự chọn ngoài bán kính | Backend tự tính khoảng cách → từ chối; client không thể ép `distance_meters` | _chạy bởi automation_ | PASS | – | |
| AT-014 | Giả mạo `user_id` của người khác | Intern | Security | Critical | Đăng nhập bằng JWT intern01 | Body chứa `user_id`/`p_user_id` = intern02 | POST `/api/attendance/check` với `user_id` của intern02 trong body | Server bỏ qua `user_id` do client gửi, dùng phiên đăng nhập → điểm danh ghi cho intern01 (hoặc 401 nếu chưa đăng nhập) | _chạy bởi automation_ | PASS | – | |
| AT-015 | Bypass giao diện (gọi RPC/API trực tiếp) | Intern | Security | Critical | Có JWT hợp lệ | Gọi thẳng RPC `attendance_check` bằng JWT authenticated | Gọi `POST /rpc/attendance/check` với JWT intern | Bị chặn (function chỉ grant `service_role`) → lỗi quyền; mọi kiểm tra vẫn enforced khi gọi qua API route | _chạy bởi automation_ | PASS | – | |

## B. Nhóm 2 – Tính toàn vẹn dữ liệu điểm danh

| ID | Feature | Role | Test Type | Priority | Preconditions | Test Data | Steps | Expected | Actual | Status | Bug ID | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AT-016 | Một bản ghi / ngày | System | Functional | Critical | Có 1 bản ghi hôm nay | Insert trực tiếp bản ghi thứ 2 (service role) | INSERT attendance trùng `(intern_id, work_date)` | Vi phạm unique → lỗi `23505`, không có bản ghi trùng | _chạy bởi automation_ | PASS | – | Constraint `attendance_unique_day` |
| AT-017 | Không ghi đè giờ check-in | Intern | Functional | High | Đã check-in lúc T1 | Check-in lại | So sánh `check_in_at` trước/sau | Giá trị không đổi | _chạy bởi automation_ | PASS | – | Cùng AT-007 |
| AT-018 | Không ghi đè giờ check-out | Intern | Functional | High | Đã check-out lúc T2 | Check-out lại | So sánh `check_out_at` trước/sau | Giá trị không đổi | _chạy bởi automation_ | PASS | – | Cùng AT-009 |
| AT-019 | Không lưu giờ ra < giờ vào | HR | Functional | High | Có bản ghi check-in | Đơn điều chỉnh đề xuất `proposed_check_out` < `proposed_check_in` | Tạo `attendance_adjustment` với giờ ra < giờ vào → HR duyệt | Hệ thống từ chối (không ghi dữ liệu trái nghiệp vụ) | _chạy bởi automation_ | PASS | – | Code hiện không validate trường này (xem Bug nếu FAIL) |
| AT-020 | Thời gian client không làm nguồn dữ liệu | Intern | Functional | High | Có API route | Body chứa `check_in_at` tùy ý (giá trị khác giờ thật) | Gọi API với trường thời gian do client gửi | Trường bị bỏ qua; `check_in_at` = giờ server | _chạy bởi automation_ | PASS | – | |
| AT-021 | Timezone Việt Nam (UTC+7) | System | Functional | High | – | Bản ghi check-in | Đối chiếu `work_date` và `check_in_at` | `work_date` = ngày theo `Asia/Ho_Chi_Minh` tại thời điểm check-in; giờ lưu là timestamptz chuẩn | _chạy bởi automation_ | PASS | – | |
| AT-022 | Ngày nghỉ cuối tuần / lễ theo cấu hình | System | Functional | Low | Cấu hình ngày lễ (nếu có) | – | Kiểm tra ngày lễ/cuối tuần | Theo cấu hình hệ thống | _chức năng chưa triển khai_ | NOT RUN | – | Enum có `weekend` nhưng `attendance_check` không tự tính; không có module ngày lễ |
| AT-023 | Trạng thái điểm danh tính đúng | Intern | Functional | High | `check_in_late=08:30`, địa điểm `TEST-QA-LOC-EARLY` (`check_out_start=23:59`) | Check-in giờ hiện tại; check-out trước `check_out_start` | Đọc `status` sau mỗi thao tác | Check-out trước giờ bắt đầu ca → `early_leave`; check-in: `late` nếu sau 08:30 else `present` | _chạy bởi automation_ | PASS | – | `late` phụ thuộc giờ chạy test |
| AT-024 | Dữ liệu DB ↔ API/Giao diện đồng nhất | Intern | Functional | Medium | Có bản ghi | – | So sánh bản ghi đọc qua REST với dữ liệu đã ghi | Giá trị giống hệt (giờ, trạng thái, tọa độ) | _chạy bởi automation_ | PASS | – | |

## C. Nhóm 3 – Yêu cầu điều chỉnh điểm danh (`create_request` / `review_request`)

| ID | Feature | Role | Test Type | Priority | Preconditions | Test Data | Steps | Expected | Actual | Status | Bug ID | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AT-025 | Tạo đơn điều chỉnh hợp lệ | Intern | Functional | Critical | intern01 có internship active | `attendance_adjustment`, đề xuất giờ vào/ra, lý do ≥5 ký tự | Gọi `create_request(...)` bằng JWT intern01 | `success=true`, đơn `pending`, có `request_code` | _chạy bởi automation_ | PASS | – | |
| AT-026 | Tạo đơn thiếu lý do | Intern | Functional | High | Như AT-025 | Lý do <5 ký tự | `create_request` với `p_reason="ab"` | `VALIDATION_ERROR`, không tạo đơn | _chạy bởi automation_ | PASS | – | |
| AT-027 | Tạo đơn thiếu ngày áp dụng | Intern | Functional | High | Như AT-025 | `p_start_date=null` | `create_request(attendance_adjustment, start_date=null)` | `DATE_REQUIRED`, không tạo đơn | _chạy bởi automation_ | PASS | – | |
| AT-028 | Đơn điều chỉnh thiếu giờ đề xuất | Intern | Functional | Medium | Như AT-025 | payload không có `proposed_check_in/out` | `create_request` với payload rỗng | `VALIDATION_ERROR` (bắt buộc có giờ đề xuất) | _chạy bởi automation_ | PASS | – | |
| AT-029 | Đính kèm hợp lệ | Intern | Functional | Medium | Có bucket `request-attachments` | Path `intern01/.../file.pdf` | Upload file PDF hợp lệ → tạo đơn kèm `p_attachment_paths` | Upload 200; đơn có `request_attachments` row | _chạy bởi automation_ | PASS | – | |
| AT-030 | Upload file không được hỗ trợ | Intern | Security | Medium | Bucket `request-attachments` có `allowed_mime_types` | File `.exe` / MIME sai | Upload lên bucket `request-attachments` | Bị từ chối (400, MIME không hợp lệ) | _chạy bởi automation_ | PASS | – | Ràng buộc ở Storage |
| AT-031 | Mentor phê duyệt đúng quyền | Mentor | Functional | Critical | mentor01 phụ trách intern01; đơn `late` pending của intern01 | `review_request(approve)` | Gọi bằng JWT mentor01 | `success=true`, đơn `approved` | _chạy bởi automation_ | PASS | – | Mentor không được duyệt `attendance_adjustment` |
| AT-032 | Mentor xử lý đơn ngoài phạm vi | Mentor | Security | Critical | intern06 phụ trách mentor02 | Đơn `late` pending của intern06 | mentor01 gọi `review_request(approve)` | `PERMISSION_DENIED`, đơn giữ `pending` | _chạy bởi automation_ | PASS | – | |
| AT-033 | Mentor không được duyệt đơn điều chỉnh | Mentor | Security | High | Đơn `attendance_adjustment` pending của intern01 (mentor phụ trách) | – | mentor01 gọi `review_request(approve)` | `PERMISSION_DENIED` (HR/Admin xử lý) | _chạy bởi automation_ | PASS | – | |
| AT-034 | HR từ chối yêu cầu | HR | Functional | High | Đơn pending | Comment ≥5 ký tự | HR gọi `review_request(reject, comment)` | Đơn `rejected`, lưu `rejection_reason`, điểm danh không đổi | _chạy bởi automation_ | PASS | – | |
| AT-035 | Reject thiếu lý do | HR | Functional | Medium | Đơn pending | Comment <5 ký tự | `review_request(reject, "ab")` | `COMMENT_REQUIRED`, đơn vẫn `pending` | _chạy bởi automation_ | PASS | – | |
| AT-036 | Intern tự xử lý đơn của mình | Intern | Security | Critical | Đơn pending của chính intern | – | JWT intern01 gọi `review_request(approve)` trên đơn của mình | `SELF_REVIEW`, trạng thái không đổi | _chạy bởi automation_ | PASS | – | |
| AT-037 | Intern tự sửa trạng thái đơn trực tiếp | Intern | Security | Critical | Có đơn pending | PATCH `requests` bằng JWT intern | Đọc/ghi `requests` qua REST | Không ghi được (RLS chặn /0 dòng ảnh hưởng) | _chạy bởi automation_ | PASS | – | |
| AT-038 | Duyệt đơn cập nhật điểm danh đúng | HR | Functional | Critical | Đơn `attendance_adjustment` pending, có bản ghi attendance hôm nay | Đề xuất giờ vào mới | HR `approve` → kiểm tra attendance | `check_in_at` = giờ đề xuất, `note` chứa mã đơn; log `ADJUST` được ghi | approve trả HTTP 400 code 22023 (time zone "Asia/Ho_Chi_Minn" not recognized) → rollback | FAIL | BUG-ATT-003 | Fix đã có trong 0028 file, chưa áp remote |
| AT-039 | Duyệt đơn khi chưa có bản ghi ngày đó | HR | Functional | High | Không có bản ghi hôm nay cho ngày điều chỉnh | Đề xuất giờ vào | `approve` | Tạo mới bản ghi attendance với giờ đề xuất, `is_geo_validated=false` | approve trả HTTP 400 code 42804 (CASE text → enum attendance_status) | FAIL | BUG-ATT-004 | Fix trong 0029, chưa áp remote |
| AT-040 | Duyệt đơn → thống kê/DB nhất quán | HR | Integration | Medium | Sau AT-038 | – | Đối chiếu attendance, log, `request_approval_logs` | Ba bảng phản ánh cùng trạng thái duyệt | Không có log approve (approve bị lỗi) | FAIL | BUG-ATT-003, BUG-ATT-004 | Hệ quả của AT-038/039 |
| AT-041 | Hai người xử lý cùng lúc | HR | Functional | High | Đơn `pending` | 2 request `approve` đồng thời | `Promise.all([approve, approve])` | Chỉ 1 thành công, 1 trả `INVALID_STATE`; trạng thái cuối = `approved` (không mâu thuẫn) | _chạy bởi automation_ | PASS | – | Row lock `for update` |
| AT-042 | Từ chối đơn không đổi dữ liệu điểm danh | HR | Functional | High | Có bản ghi attendance | Đề xuất giờ khác | Reject đơn | Attendance giữ nguyên hoàn toàn | _chạy bởi automation_ | PASS | – | |
| AT-043 | Hủy / gửi lại đơn | Intern | Functional | Low | Đơn `needs_revision` / `pending` | – | `cancel` rồi `resubmit` bằng đúng người gửi | Trạng thái chuyển đúng; người khác không hủy được đơn | _chạy bởi automation_ | PASS | – | |

## D. Nhóm 4 – Phân quyền & RLS (JWT thật từng role)

| ID | Feature | Role | Test Type | Priority | Preconditions | Test Data | Steps | Expected | Actual | Status | Bug ID | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AT-044 | Intern chỉ thấy điểm danh của mình | Intern | Security | Critical | intern01 & intern02 đều có attendance | – | JWT intern01 GET `/attendance?select=intern_id` | Chỉ thấy dòng của intern01 | _chạy bởi automation_ | PASS | – | |
| AT-045 | Mentor chỉ thấy intern được phân công | Mentor | Security | Critical | mentor01 → intern01..05; mentor02 → intern06..10 | – | JWT mentor01 GET `/attendance` | Chỉ thấy attendance của intern01..05 | _chạy bởi automation_ | PASS | – | |
| AT-046 | HR/Admin thấy toàn bộ (nhiều đợt, nhiều phòng ban) | HR, Admin | Security | High | Attendance ở 2 đợt, 2 phòng ban | – | JWT hr/admin GET `/attendance` | Thấy đủ mọi dòng | _chạy bởi automation_ | PASS | – | |
| AT-047 | Chưa đăng nhập bị chặn | – | Security | Critical | Không có JWT | – | GET `/attendance` với anon key | 0 dòng / 401; không lộ dữ liệu | _chạy bởi automation_ | PASS | – | |
| AT-048 | Không tự nâng role được | Intern | Security | Critical | JWT intern01 | PATCH `profiles.role_id` → admin | Ghi `profiles` của chính mình qua REST | Bị RLS chặn (0 dòng cập nhật) | _chạy bởi automation_ | PASS | – | |
| AT-049 | Gọi RPC điểm danh trái quyền | Intern | Security | Critical | JWT intern01 | – | `POST /rpc/attendance_check` bằng JWT authenticated | Lỗi quyền (đã revoke khỏi `authenticated`) | _chạy bởi automation_ | PASS | – | |
| AT-050 | `adjust_attendance` bằng HR | HR | Security | Critical | JWT hr | 1 bản ghi attendance | Gọi `POST /rpc/adjust_attendance` | `success=true` (hoặc lỗi nghiệp vụ hợp lệ) | HTTP 400 code 42703 "column p.role_code does not exist" (gọi bằng JWT HR) | FAIL | BUG-ATT-001 | Đã sửa trong 0029, chưa áp remote |
| AT-051 | `adjust_attendance` bằng Intern | Intern | Security | High | JWT intern | 1 bản ghi attendance | Gọi RPC | `PERMISSION_DENIED` (bị từ chối, không sửa được dữ liệu) | HTTP 400 code 42703 (role_code không tồn tại) — bị chặn nhưng sai mã lỗi | FAIL | BUG-ATT-001 | Đã sửa trong 0029, chưa áp remote |
| AT-052 | Ma trận RLS INSERT/UPDATE/DELETE attendance | Intern, Mentor | Security | Critical | JWT intern/mentor | Dòng attendance có thật | Cố INSERT/UPDATE/DELETE qua REST | Bị chặn (42501 / không thay đổi dữ liệu) | _chạy bởi automation_ | PASS | – | |
| AT-053 | HR/Admin DELETE attendance từ client | HR, Admin | Security | High | JWT hr/admin | 1 dòng `TEST-QA-` | DELETE `/attendance?id=eq...` | Bị chặn theo thiết kế (`test_rls.sql` kỳ vọng FAIL) | HTTP 200 DELETE 1 dòng (thành công) | FAIL | BUG-ATT-002 | Đã sửa trong 0029 (drop policy), chưa áp remote |
| AT-054 | Không đọc được log điểm danh người khác | Intern | Security | Medium | intern02 có log | – | JWT intern01 GET `/attendance_verification_logs` | Chỉ thấy log của mình | _chạy bởi automation_ | PASS | – | |
| AT-055 | Đọc/ghi địa điểm làm việc | Intern | Security | Medium | – | – | GET `/attendance_locations` (đọc) & PATCH (ghi) | Đọc được (authenticated), ghi bị chặn (chỉ admin) | _chạy bởi automation_ | PASS | – | |
| AT-056 | Storage: không đọc được file đính kèm người khác | Intern | Security | High | intern01 upload file riêng | Path của intern01 | JWT intern02 GET object trong `request-attachments` | Bị từ chối (400/403) | _chạy bởi automation_ | PASS | – | Bucket private |
| AT-057 | Không giả mạo `internship_id` khi gửi đơn | Intern | Security | High | JWT intern01 | `p_payload`/body chứa `internship_id` của intern khác | `create_request` | Server tự chọn internship theo phiên; không thể ép internship người khác | _chạy bởi automation_ | PASS | – | |

## E. Nhóm 5 – Tìm kiếm, lọc, thống kê

| ID | Feature | Role | Test Type | Priority | Preconditions | Test Data | Steps | Expected | Actual | Status | Bug ID | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AT-058 | Lọc theo ngày | Intern, HR | Functional | High | Có dữ liệu nhiều ngày | `work_date=eq.<hôm nay>` | GET `/attendance?work_date=eq...` | Chỉ trả đúng ngày | _chạy bởi automation_ | PASS | – | |
| AT-059 | Lọc theo trạng thái | HR | Functional | Medium | Dữ liệu có present/late/absent/leave | `status=eq.late` | GET `/attendance?status=eq.late` | Chỉ trả `late` | _chạy bởi automation_ | PASS | – | |
| AT-060 | Lọc theo thực tập sinh + đợt thực tập | HR | Functional | Medium | 2 đợt thực tập | `intern_id=eq...`, `internship_id=eq...` | GET với filter | Trả đúng tập dữ liệu | _chạy bởi automation_ | PASS | – | |
| AT-061 | Kết hợp lọc + phân trang server-side | HR | Functional | High | ~500 dòng `TEST-QA-` | `limit=50&offset=0`, header `Prefer: count=exact` | GET `/attendance?...&limit=50` | Trả 50 dòng; header `content-range` có tổng số chính xác (phân trang ở DB, không tải hết) | _chạy bởi automation_ | PASS | – | |
| AT-062 | Thống kê ngày làm việc / đi muộn / về sớm / vắng | HR | Functional | High | 500 dòng trạng thái khác nhau | – | Chạy unit test `features/attendance/stats.ts` với bộ dữ liệu mẫu | Đúng số ngày `present/late/early_leave/absent`, tỷ lệ chuyên cần = (present+late+…)/tổng | _chạy bởi automation_ | PASS | – | Unit test `node:test` |
| AT-063 | RPC `attendance_rate` khớp DB | HR | Integration | High | Có attendance cho intern01 | `attendance_rate(intern_id)` | So với đếm tay qua REST | Giá trị khớp (±0) | _chạy bởi automation_ | PASS | – | |
| AT-064 | `get_request_stats` khớp DB | HR | Integration | Medium | Có đơn pending/approved/rejected | – | Gọi RPC so với đếm REST | Khớp | _chạy bởi automation_ | PASS | – | |
| AT-065 | Tìm theo tên / MSSV trên web | HR | UI | Low | Có dữ liệu `TEST-QA` | Từ khóa tên intern | Mở trang admin điểm danh, nhập tìm kiếm | Kết quả lọc đúng (client hoặc server theo thiết kế hiện tại) | _cần trình duyệt E2E_ | NOT RUN | – | Manual |

## F. Nhóm 6 – Giao diện & UX

| ID | Feature | Role | Test Type | Priority | Preconditions | Test Data | Steps | Expected | Actual | Status | Bug ID | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AT-066 | Chưa đăng nhập → chuyển hướng đăng nhập | – | UI | Critical | Server web chạy cổng 3100 | GET `/attendance` | `fetch` GET trang | Redirect 307 → `/login` | _chạy bởi automation_ | PASS | – | Smoke SSR |
| AT-067 | Trang danh sách điểm danh render (đã đăng nhập) | HR | UI | High | Có session hợp lệ | – | GET trang với cookie phiên | 200, chứa bảng danh sách / tiêu đề trang | _chạy bởi automation_ | PASS | – | SSR |
| AT-068 | Trang admin điểm danh render | Admin | UI | High | Session admin | – | GET `/admin/attendance` | 200, có các điều khiển lọc | _chạy bởi automation_ | PASS | – | SSR |
| AT-069 | Empty state khi không có dữ liệu | Intern | UI | Medium | Intern không có bản ghi nào (dùng ngày chưa có dữ liệu) | – | Mở trang | Hiển thị thông báo rỗng, không lỗi vỡ giao diện | _cần trình duyệt E2E_ | NOT RUN | – | Manual |
| AT-070 | Loading / error state khi API lỗi | Intern | UI | Medium | Chặn network (DevTools) | – | Tải danh sách khi API fail | Có trạng thái loading + thông báo lỗi, không crash | _cần trình duyệt E2E_ | NOT RUN | – | Manual |
| AT-071 | Không gửi trùng khi bấm nút liên tục | Intern | UI | Medium | Đang check-in | Nhấn nhanh nhiều lần | – | Chỉ 1 request điểm danh được xử lý (nút disable/debounce) | _cần trình duyệt E2E_ | NOT RUN | – | Backend đã có AT-007 |
| AT-072 | Responsive desktop/tablet/mobile | – | UI | Low | – | – | Kiểm tra 3 cỡ màn hình | Layout không vỡ | _cần trình duyệt E2E_ | NOT RUN | – | Manual |
| AT-073 | Hiển thị null / dữ liệu dài | HR | UI | Low | Bản ghi thiếu `check_out`, note dài | – | Xem danh sách/chi tiết | Không lỗi render, hiển thị trống/phân đoạn phù hợp | _cần trình duyệt E2E_ | NOT RUN | – | Manual |

## G. Nhóm 7 – Hiệu năng

| ID | Feature | Role | Test Type | Priority | Preconditions | Test Data | Steps | Expected | Actual | Status | Bug ID | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AT-074 | Danh sách ~500 bản ghi | HR | Performance | High | Đã seed 500 dòng `TEST-QA-` | – | GET `/attendance?limit=50` đo thời gian | < 1000ms, trả đúng 50 dòng | _chạy bởi automation_ | PASS | – | Đo bằng fetch thời gian thực |
| AT-075 | Phân trang phía Database | HR | Performance | High | Như AT-074 | `limit=50` các trang khác nhau | Đọc `content-range` | Tổng bằng số dòng thật; mỗi trang không vượt `limit` | _chạy bởi automation_ | PASS | – | |
| AT-076 | Không N+1 khi tải danh sách | HR | Performance | Medium | – | – | Đếm số request REST cho 1 lần tải API danh sách (không kèm N+1) | 1 request chính, các dữ liệu kèm theo join sẵn (không phát sinh request lẻ theo dòng) | _chạy bởi automation_ | PASS | – | Đo qua API; SSR cần công cụ theo dõi query |
| AT-077 | Race condition check-in đồng thời | Intern | Performance | Critical | Chưa có bản ghi hôm nay | 2 request `CHECK_IN` song song | `Promise.all` 2 lời gọi cùng lúc | Đúng 1 success, 1 `ALREADY_CHECKED_IN`/`unique_violation`; chỉ 1 bản ghi tồn tại | _chạy bởi automation_ | PASS | – | `for update` + catch unique |
| AT-078 | Kiểm tra index cho truy vấn lọc | System | Performance | Low | – | – | `EXPLAIN` các truy vấn lọc theo `intern_id/work_date` | Có index phù hợp (PK + `attendance_unique_day`) | _không có quyền SQL trực tiếp_ | NOT RUN | – | Không tự thêm index khi chưa đo |

## H. Kiểm thử hồi quy (chỉ các luồng liên quan Attendance)

| ID | Feature | Role | Test Type | Priority | Preconditions | Test Data | Steps | Expected | Actual | Status | Bug ID | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RG-001 | Đăng nhập & phân quyền 4 role | All | Integration | Critical | Tài khoản test 4 role | – | Password grant qua GoTrue cho admin/hr/mentor/intern | Cả 4 đăng nhập OK, nhận JWT | _chạy bởi automation_ | PASS | – | |
| RG-002 | `tsc --noEmit` | – | Regression | Critical | Thay đổi hiện tại | – | `npm run build`/`tsc` trong web-admin | 0 lỗi type | _chạy bởi automation_ | PASS | – | |
| RG-003 | ESLint | – | Regression | High | – | – | `npm run lint` | 0 lỗi | _chạy bởi automation_ | PASS | – | |
| RG-004 | Next.js build | – | Regression | Critical | – | – | `next build` | Build thành công, các route Attendance có mặt | _chạy bởi automation_ | PASS | – | |
| RG-005 | Module Đơn từ không đổi hành vi | All | Regression | High | Có dữ liệu đơn | – | Các case AT-025..043 | Như kỳ vọng (đơn từ là phụ thuộc trực tiếp của điểm danh) | _chạy bởi automation_ | PASS | – | |
| RG-006 | Smoke trang khác sau thay đổi | Admin | Regression | Medium | – | – | GET `/dashboard`, `/requests` (SSR) | Không lỗi 500 | _chạy bởi automation_ | PASS | – | |

---

## Trạng thái lỗi phát hiện (cập nhật khi thực thi)

| Bug ID | Mô tả | Mức độ | Trạng thái |
|---|---|---|---|
| BUG-ATT-001 | RPC `adjust_attendance` (và `create_attendance` trong 0026/0027) tham chiếu `profiles.role_code` — cột KHÔNG tồn tại trên DB → mọi lời gọi lỗi `42703` | Critical | Đã xác minh trên remote (Phase 1 + AT-050/051 FAIL). Đã sửa trong `0029_attendance_role_and_delete_fix.sql` (dùng `get_my_role()`/`is_hr_or_admin()`), CHƯA áp lên remote (không có Supabase CLI/psql trong môi trường kiểm thử) |
| BUG-ATT-002 | Policy `attendance_delete_hr_admin` cho HR/Admin DELETE attendance từ client, mâu thuẫn với `test_rls.sql` (kỳ vọng bị chặn) và ghi chú thiết kế | High | Đã xác minh (AT-053 FAIL — HR xóa được 1 dòng). Đã sửa: drop policy trong `0029_*`, CHƯA áp remote |
| BUG-ATT-003 | `sync_request_attendance` (0017) dùng tên múi giờ SAI `Asia/Ho_Chi_Minn` (thừa `n`) → duyệt đơn điều chỉnh có bản ghi sẵn lỗi `22023`, rollback toàn bộ giao dịch (AT-038, AT-040 FAIL) | Critical | File 0028 đã sửa (chưa áp remote). `0029_*` tái tạo hàm kèm cả hai sửa (múi giờ + cast), áp trực tiếp được |
| BUG-ATT-004 | Nhánh INSERT của `sync_request_attendance` gán `status` bằng CASE trả text vào cột enum → lỗi `42804` khi duyệt đơn cho ngày chưa có bản ghi (AT-039 FAIL) | Critical | Đã sửa trong `0029_*` (cast `::public.attendance_status`), CHƯA áp remote |
