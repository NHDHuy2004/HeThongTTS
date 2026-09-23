# IMS – PHẦN 15: TESTING

## 15.1. Unit Test

| Phạm vi | Công cụ | Nội dung |
|---|---|---|
| Web (logic) | Vitest | validate form, KPI calc, permission helper, date utils, csv parser |
| EF (pure logic) | Deno test | Haversine distance, evaluation aggregation, payload builders |
| Flutter | flutter_test | validation form, repository mock, state (Riverpod) khi mock service |

## 15.2. Integration Test (Supabase)

- SQL test: seed 4 role → chạy query với từng `auth.uid()` giả lập → xác nhận RLS đúng (script `scripts/test_rls.sql`).
- Test Auth: login/logout/reset, createUser service role, session refresh.
- Test Storage: upload mime/size, policy user khác bị chặn.
- Test EF: gọi bằng JWT hợp lệ/không hợp lệ, check-in trong/ngoài bán kính.
- Test Realtime: subscribe giả lập user A không nhận event user B.

## 15.3. E2E (Playwright) — Phase 4

Kịch bản chuẩn:
```
Login(admin) → Tạo intern (+ tài khoản) → Phân mentor → Mentor tạo task
→ Intern nộp report (tiến độ) → Mentor approve → Đánh giá final
→ Sinh chứng nhận PDF → Xem trong danh sách
```
Bổ sung: role guard (intern không vào web admin), 403 page, upload sai MIME bị chặn.

## 15.4. Mobile Test

- Widget test: form check-in validate GPS off → lỗi thân thiện.
- Integration test (WidgetTester) với repository mock: task flow, report flow, request flow.
- Manual checklist: GPS kill/deny, FCM foreground/background/terminated, offline queue → retry, session expired → re-login.
- Device farm (Codemagic): build smoke trên Android emulator/iOS sim.

## 15.5. Security Test

- Check RLS matrix bằng script SQL tự động so kết quả mong đợi.
- Scan dependencies (npm audit, pub outdated).
- Secret scan CI (gitleaks).
- Kiểm tra JWT không bị lộ trong bundle client.