# Mobile (Flutter) — Ứng dụng cho Intern / Mentor

App mobile cho hệ thống quản lý thực tập. Flutter SDK 3.47+ đặt tại `E:\flutter`.

## Trạng thái

- [x] `flutter analyze` — không lỗi
- [x] `flutter test` — pass
- [x] `flutter build web` — OK
- [ ] Build APK — cần cài Android SDK (xem `flutter doctor`) + Developer Mode (symlink cho plugin)

## Cài đặt

```bash
cp .env.example .env
# Điền SUPABASE_URL và SUPABASE_ANON_KEY vào .env
flutter pub get
flutter run -d chrome   # hoặc -d windows sau khi cài Visual Studio
```

## Cấu trúc

```
lib/
  main.dart                  # Khởi tạo + AuthGate theo session + theme M3
  core/
    supabase.dart            # Khởi tạo Supabase từ mobile/.env
    current_user.dart        # helpers: myInternId, myInternshipIds, myRole
    fcm.dart                 # FCM: nhận push, upsert token, mở màn notifications khi tap, push_only khi duyệt
    realtime.dart            # Realtime: kênh notifications + làm mới dashboard/đơn/báo cáo
  shared/
    status_pill.dart         # status/priority màu + nhãn tiếng Việt
    format.dart              # fmtDbDate / fmtTime
    empty_view.dart          # Empty state dùng chung
    error_view.dart          # Error + retry dùng chung
  features/
    auth/login_screen.dart   # Đăng nhập email/password
    home/home_screen.dart    # Shell theo vai trò (bottom nav)
    home/dashboard_screen.dart   # Stats theo role + quick actions (mentor) + chuông
    home/profile_screen.dart # Hồ sơ + đăng xuất
    checkin/checkin_screen.dart  # Chấm công GPS → Edge Function `check-in`
    reports/reports_screen.dart  # Gửi / duyệt báo cáo ngày (daily_reports)
    requests/requests_screen.dart # Đơn: nghỉ phép / WFH / đi muộn / về sớm
    notifications/notifications_screen.dart # Danh sách + đánh dấu đã đọc
```

## Vai trò & luồng

| Vai trò | Tab |
|---|---|
| intern | Trang chủ → Chấm công → Báo cáo → Đơn từ → Hồ sơ |
| mentor / hr / admin | Trang chủ → Duyệt báo cáo → Duyệt đơn → Hồ sơ |

- Role luôn đọc từ RPC `get_my_role()` (không tin client).
- Chấm công gửi toạ độ GPS tới Edge Function `check-in`; server tự kiểm tra phạm vi
  so với `attendance_locations` rồi ghi vào bảng `attendance`.
- Báo cáo ghi vào `daily_reports` (RLS: intern chỉ thấy/sửa báo cáo của mình;
  mentor/hr/admin duyệt qua policy `is_mentor_of_intern` / `is_hr_or_admin`).
- Đơn ghi vào 3 bảng `leave_requests` / `work_from_home_requests` / `late_requests`
  (RLS cho intern tự hủy khi `status = 'pending'`); staff duyệt cùng màn hình đơn.
- Thông báo đọc từ bảng `notifications` (RLS: chỉ thấy tin của mình, tự đánh dấu đã đọc).
- **FCM push** đã tích hợp `firebase_core` + `firebase_messaging` + `flutter_local_notifications`:

  ```bash
  # Chạy với config Firebase (giá trị lấy từ Firebase Console > Project settings):
  flutter run --dart-define=FIREBASE_API_KEY=... \
              --dart-define=FIREBASE_APP_ID=... \
              --dart-define=FIREBASE_MESSAGING_SENDER_ID=... \
              --dart-define=FIREBASE_PROJECT_ID=...
  ```

  - Thiếu config → app chạy bình thường, chỉ tắt push (không crash).
  - Sau khi đăng nhập, token thiết bị tự upsert vào `notification_devices` (RLS: mỗi user chỉ quản token của mình); khi đăng xuất token bị xóa.
  - Foreground: hiện notification local qua `flutter_local_notifications`; background/terminated: do OS.
  - **Tap push → nhảy thẳng vào màn Thông báo** (qua `navigatorKey`, tự dọn stack trùng).
  - Server gửi push qua Edge Function `send-notification` (cần `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` ở supabase env).
  - Android: đã set `minSdk 23` + desugaring; cần `POST_NOTIFICATIONS` (đã khai) và bật Developer Mode.