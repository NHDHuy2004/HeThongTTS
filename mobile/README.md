# Mobile (Flutter) — Ứng dụng cho Intern / Mentor

Skeleton ứng dụng cho hệ thống quản lý thực tập. Yêu cầu cài Flutter SDK >= 3.4.

## Cài đặt

```bash
cp .env.example .env
# Điền SUPABASE_URL và SUPABASE_ANON_KEY vào .env
flutter pub get
flutter run
```

> Dự án được viết tay (machine-generated) trên máy chưa cài Flutter, chưa compile/verify.
> Trước khi build hãy chạy lại `flutter create .` để sinh các file nền tảng (android/ios/...) nếu cần.

## Cấu trúc

```
lib/
  main.dart                  # Khởi tạo + AuthGate theo session
  core/
    supabase.dart            # Khởi tạo Supabase từ mobile/.env
  features/
    auth/login_screen.dart   # Đăng nhập email/password
    home/home_screen.dart    # Shell theo vai trò (bottom nav)
    home/profile_screen.dart # Hồ sơ + đăng xuất
    checkin/checkin_screen.dart  # Chấm công GPS → Edge Function `check-in`
    reports/reports_screen.dart  # Gửi / duyệt báo cáo ngày (daily_reports)
```

## Vai trò & luồng

| Vai trò | Tab |
|---|---|
| intern | Chấm công → Báo cáo ngày → Hồ sơ |
| mentor / hr / admin | Duyệt báo cáo → Hồ sơ |

- Role luôn đọc từ RPC `get_my_role()` (không tin client).
- Chấm công gửi toạ độ GPS tới Edge Function `check-in`; server tự kiểm tra phạm vi
  so với `attendance_locations` rồi ghi vào bảng `attendance`.
- Báo cáo ghi vào `daily_reports` (RLS: intern chỉ thấy/sửa báo cáo của mình;
  mentor/hr/admin duyệt qua policy `is_mentor_of_intern` / `is_hr_or_admin`).