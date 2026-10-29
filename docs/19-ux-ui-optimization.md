# IMS – PHẦN 19: ĐỀ XUẤT TỐI ƯU UX/UI (theo Redesign Skill + Mobile App UI Design Skill)

Tài liệu này tổng hợp kết quả audit hiện trạng `web-admin/` và `mobile/`, rồi đề xuất
lộ trình nâng cấp UX/UI cho **mọi phân quyền**: Admin · HR · Mentor · Intern (TTS).

Nguồn chuẩn áp dụng:
- `skills/taste-skill/skills/redesign-skill/SKILL.md` — audit & fix cho web (typography, color, layout, states, component patterns).
- `skills/mobile-app-ui-design/SKILL.md` — chuẩn mobile (thumb zone, 8pt grid, 60/30/10, peak-end rule, states).
- `docs/02-user-roles.md`, `docs/08-web-admin.md`, `docs/09-mobile.md` — spec phân quyền & màn hình.

---

## 1. Kết quả audit hiện trạng (tóm tắt)

### 1.1. Web-admin — điểm đạt / chưa đạt

| Hạng mục | Hiện trạng | Nguồn |
|---|---|---|
| Font Geist | ❌ **Bug**: `--font-sans: var(--font-sans)` tự tham chiếu → Geist không bao giờ áp dụng, rơi về font browser | `web-admin/app/globals.css:10` |
| Skeleton / `loading.tsx` | ❌ **0 file** route-group có `loading.tsx`; `components/ui/skeleton.tsx` 0 usage | toàn repo |
| `error.tsx` / `not-found.tsx` | ❌ Không có → lỗi rơi về error boundary mặc định Next | toàn repo |
| Confirm cho hành động nguy hiểm | ❌ 11 chỗ dùng `window.confirm` (thu hồi chứng nhận, duyệt/báo cáo, xóa địa điểm…) | `report-detail-actions.tsx:69,79`, `work-location-form.tsx:384`, `record-actions.tsx:31,48`… |
| Bảng | ⚠️ Trộn lẫn: 13 bảng dùng `DataTable`; `reports-table`/`requests-table`/`record-list` viết `<table>` thô, dùng `<select>` native, không pagination | `features/reports/reports-table.tsx:59-104`, `features/requests/requests-table.tsx:68-103` |
| Nav sidebar | ⚠️ Một list phẳng, không nhóm section; prop `compact` là dead code; breadcrumb component cài sẵn nhưng 0 usage | `components/layout/sidebar.tsx`, `features/nav.ts:29-156` |
| Topbar | ⚠️ Không search toàn cục/command palette, không notification bell, không user dropdown (chỉ nút logout trần) | `components/layout/topbar.tsx` |
| Dark mode | ⚠️ Dead code: biến `.dark` + `next-themes` có nhưng không ai thêm class `.dark` | `globals.css:86-118` |
| Charts | ⚠️ `recharts` đã cài nhưng 0 import; dashboard chỉ có stat card + list | `app/(dashboard)/dashboard/page.tsx` |
| Stat card | ⚠️ 3 kiểu khác nhau (dashboard, admin/reports, admin/requests, onboarding) | xem audit |
| Lộ thông tin hạ tầng | ❌ Banner "hãy chạy migration 0017…" hiện cho mọi role, kể cả Intern | `admin/requests/page.tsx:87-92`, `intern/reports/page.tsx:47-52` |
| Focus ring / hover / active nav | ✅ Đủ (shadcn base) | `sidebar.tsx:56-63`, `data-table.tsx:96` |
| Sheet cho form tạo/sửa | ✅ Nhất quán 20 chỗ | toàn dashboard |

### 1.2. Mobile — điểm đạt / chưa đạt

| Hạng mục | Hiện trạng | Nguồn |
|---|---|---|
| Theme tokens | ❌ Không có `lib/core/theme/`; màu, radius (10/12/14), spacing hardcode trong màn hình | `mobile/lib/main.dart:32-67` |
| Skeleton/shimmer | ❌ 0 chỗ; 7 màn dùng `Center(CircularProgressIndicator)` | `main.dart:117`, `dashboard:197`… |
| Empty state chặn pull-to-refresh | ❌ `EmptyView` đặt TRƯỚC `RefreshIndicator` → màn rỗng không kéo làm mới được | `reports_screen.dart:172-177`, `requests_screen.dart:126-131` |
| Validation form | ❌ Login không validate; score task-detail không check 1–5 | `login_screen.dart`, `task_detail_screen.dart:501-514` |
| Lộ lỗi kỹ thuật | ❌ `Text('$e')` (lỗi PostgREST tiếng Anh) + banner migration hiện cho user | `reports:110-113,485`, `requests:62-65,345` |
| Ellipsis | ❌ Chỉ 1 chỗ có (`tasks_screen.dart:114`); title/detail/notification đều tràn | audit |
| Push deep link | ❌ Tap notification chỉ mở LIST, bỏ `data.screen`/`data.id` dù đã gửi | `core/fcm.dart:197-218` |
| Notifications | ❌ Không trong bottom nav, không badge tab, không "đọc tất cả" | `home_screen.dart:35-58` |
| Mentor view | ❌ Không màn hình riêng cho mentor (theo spec `docs/09-mobile.md:17-21`); duyệt qua cùng màn intern | `dashboard_screen.dart:274-310` |
| Shared widgets | ⚠️ `_StatRow/_QuickAction/_ReportForm…` private hoá trong màn hình, không tái sử dụng | `dashboard_screen.dart`, `reports_screen.dart` |
| Tương tác xác nhận | ❌ Logout, xóa notification, đổi status → cancelled đều **không confirm** | `profile:56`, `notifications:136`, `task_detail:636` |
| PTR / refresh / StatusPill map | ✅ Có ở các màn list; bản đồ label VN đầy đủ | `status_pill.dart` |

---

## 2. Design system đề xuất (áp cho cả 2 nền tảng)

### 2.1. Web — sửa theo thứ tự Fix Priority của Redesign Skill

1. **Font (P0 — fix ngay, rủi ro 0):** `app/globals.css:10` đổi `--font-sans: var(--font-sans)` → `var(--font-geist-sans)`. Giữ Geist (đã chọn đúng hướng), Geist Mono cho số liệu: thêm utility `.tabular { font-variant-numeric: tabular-nums; }` áp cho mọi cột số trong `DataTable` (đúng rule "numbers in tabular figures").
2. **Palette (P1):** hiện tại 2 màu emerald (primary) + cam (accent) — **đúng tinh thần "một accent"** của skill, giữ nguyên. Việc cần làm là *dọn dùng thống nhất*:
   - Badge/pill dùng `StatusBadge` ở **mọi** nơi, không tô màu ad-hoc.
   - Shadow tint theo nền: thay `shadow-xs/shadow-md` đen mặc định bằng shadow hàm `--shadow-*` màu emerald/navy nhẹ trên card lớn (rule "tinted shadows").
   - Bật dark mode *đúng cách*: thêm `suppressHydrationWarning` + `next-themes` ThemeProvider ở `app/layout.tsx` và nút toggle trong user dropdown — hoặc **xóa hẳn** nhánh `.dark` + dependency để không dead code (skill: không để code chết). Khuyến nghị: bật thật vì variables đã đủ.
3. **Typography scale:** giới hạn 4 cấp size (12/14/16/24–30), heading `-tracking-tight`, label nhỏ `tracking-widest uppercase` (đang làm đúng ở table header — mở rộng cho mọi label), sentence case cho toàn bộ tiêu đề trang (đang đúng, duy trì).
4. **Trạng thái (P0–P1):** thêm `loading.tsx` (skeleton theo hình dáng nội dung) cho `(dashboard)` và từng nhóm con; thêm `app/error.tsx`, `app/not-found.tsx` có branding + nút retry/back (rule "no dead ends").
5. **Components thiếu cần cài** (shadcn): `alert-dialog`, `dialog`, `command`, `popover`, `switch`, `pagination`, `scroll-area`, `collapsible` — chỉ cài cái nào dùng thật.

### 2.2. Mobile — xây tokens theo Mobile UI Skill

Tạo `mobile/lib/core/theme/`:

| Token | Đề xuất | Ghi chú |
|---|---|---|
| `AppColors` | primary/secondary/neutral lấy từ **cùng seed emerald** với web (`oklch` ~ emerald) để đồng nhất thương hiệu; thay `Color(0xFF3F51B5)` (indigo lệch web) | 60/30/10 |
| `AppSpacing` | chỉ nhận giá trị bội 4/8: 4, 8, 12, 16, 24, 32, 48 | dọn `2/6/10/14/20` |
| `AppRadius` | card 12, input 10, sheet 16, badge full | thống nhất thay 10/14/999 lộn xộn |
| `AppTypography` | 1 font, tối đa 4 size × 2 weight; số liệu dùng font variant đều (tabular) | |
| `StatusPill` | làm "pill" thật: nền màu 10% + chữ màu đậm + padding 4×8; fallback label tiếng Việt thay raw key | `status_pill.dart:55-64` |

Quy tắc chung mobile:
- Tap target ≥ 44×44; mọi CTA chính ở **thumb zone** (FAB/đáy sheet — đang đúng, chỉ cần dọn QuickAction về dưới trên dashboard).
- Skeleton thay spinner cho lần load đầu; spinner chỉ còn cho thao tác (đã có trong nút).
- Peak–end rule: **đặt 1 "đỉnh" cảm xúc** — check-in thành công nên có micro-animation (bounce nhẹ + haptic) thay Container xanh tĩnh (`checkin_screen.dart:543-560`).

---

## 3. Nâng cấp UX theo từng phân quyền (Web-admin)

### 3.1. Nav chung — chia nhóm thay list phẳng (áp cho mọi role)

Hiện `features/nav.ts` là một mảng phẳng, gây ra thực tế 3 mục "Onboarding", 2 mục "Điểm danh"… code trùng. Đề xuất:

- Đổi cấu trúc `navItems` thành **sections**: `Tổng quan` · `Nhân sự` · `Vận hành` · `Onboarding` · `Hệ thống`; mỗi item giữ `roles[]` như hiện tại, `getNavItems(role)` flatten ra.
- Sidebar render `<NavSection>` có label nhóm (nhỏ, muted, uppercase) — tiêu chí "hierarchy" của skill.
- **Breadcrumb**: dùng lại `components/ui/breadcrumb.tsx` (đã cài) trong `components/layout/topbar.tsx`, tự sinh từ pathname + label map — spec `docs/08-web-admin.md:60` vốn đã hứa.
- **Command palette** (`⌘K`): cài `command.tsx` + `cmdk`, cho jump nhanh tới trang theo role và tìm intern/task theo id — giảm interaction cost cho Admin/HR/Mentor power-user.
- Topbar: thay nút logout trần bằng `DropdownMenu` (Hồ sơ · Đổi mật khẩu · Giao diện Sáng/Tối · Đăng xuất) + `Avatar` dùng ảnh/initials.
- Dọn dead code: prop `compact` hoặc cài collapse thật (rule "dashboard không bắt buộc sidebar cố định") hoặc xóa hẳn.

### 3.2. Admin

| Màn hình | Đề xuất |
|---|---|
| `/dashboard` | Dùng `recharts` (đã cài) vẽ 3 chart: lượt điểm danh 14 ngày (line), tỷ lệ hoàn thành onboarding (donut), task theo trạng thái (bar). Đổi empty `RecentList` thành `EmptyState`. Dùng chung 1 component `StatCard` với tabular-nums. |
| `/users` | Toggle active → `AlertDialog` xác nhận (đang không confirm); đổi role cần modal giải thích quyền thừa hưởng + ghi audit (đang ghi? cần verify). |
| `/settings` | Thay "sửa JSON thô" bằng form phân nhóm theo loại key (number/boolean/select), kèm search filter key; empty state dùng `EmptyState`. |
| `/audit-logs` | Thêm filter theo actor/action/date range + drawer chi tiết (dùng `Sheet` thay trang mới). |
| `/admin/work-locations` | `window.confirm` → `AlertDialog`; bản đồ Leaflet picker giữ nguyên (điểm mạnh). |
| `/admin/attendance` | Gộp nút export thành component `ExportCsvButton` dùng chung 5 nơi (đang copy-paste). |
| `/admin/onboarding` | Banner "Cần ưu tiên" → card liệt kê lý do cụ thể + link 1 chạm tới record. |

### 3.3. HR

| Màn hình | Đề xuất |
|---|---|
| `/interns` | Import CSV → **wizard 3 bước** (Tải file → Xem trước & map cột → Kết quả) với báo cáo lỗi từng dòng thay vì toast chung chung; phát hiện trùng email trước khi commit. |
| `/interns/[id]` | Đảm bảo đủ tabs spec `docs/08-web-admin.md:13`: Hồ sơ · CV · Task · Điểm danh · Báo cáo · Đánh giá; gỡ `void role;` chết. |
| `/internship-batches` | Thêm **timeline view** theo vòng đời đợt (Mở đợt → Onboarding → Thực tập → Kết thúc) với CTA theo trạng thái — đúng tinh thần "selection over manual input". |
| `/certificates` | "Thu hồi" **bắt buộc** `AlertDialog` (đang không confirm — nguy hiểm); thêm preview PDF trước khi cấp, cấp hàng loạt theo đợt. |
| Export CSV | Gom thành component + hiện toast "Đã xuất N dòng" thay vì tải file im lặng. |

### 3.4. Mentor

| Màn hình | Đề xuất |
|---|---|
| `/mentor/onboarding` | Đã có filter/sort URL tốt — thêm progress bar mỗi record + xem nhanh intern bên phải (split view). |
| `/tasks` | Kanban **drag-and-drop** (`@dnd-kit` — cột Kanban hiện chỉ hover); tạo task từ Template 1 chạm (template đang chỉ "👁" — cho Mentor dùng thật); bộ lọc "của intern phụ trách" mặc định. |
| `/admin/reports` & `/admin/requests` (review) | Chuyển sang **review queue**: sau khi Duyệt/Từ chối tự động mở item tiếp theo + đếm "còn N chờ duyệt" (giảm 1 click × hàng chục lần/ngày). Thay `window.confirm` bằng `AlertDialog` kèm preview nội dung. |
| `/evaluations` | Wizard nhiều bước có progress (hiện "Bước 1" nhưng chỉ 1 bước); rubric chấm điểm dạng thang slider 1–5 thay nhập tay. |

### 3.5. Intern (TTS)

| Màn hình | Đề xuất |
|---|---|
| `/dashboard` (nhánh intern) | Card "Hôm nay" đặt trên cùng: trạng thái điểm danh + task đến hạn + báo cáo chưa nộp (1 glance = 1 việc cần làm); vòng tròn tiến độ onboarding; card "Hướng dẫn nhanh" chuyển xuống. |
| `/intern/reports`, `/intern/requests` | Chuyển `<table>` thô → `DataTable` (pagination + search); form: validate Zod cả 2 phía (hiện client-check tay), **autosave draft**; gỡ banner migration lộ info (§4). |
| `/intern/onboarding` | Tabs hiện có tốt — thêm checklist "đã hoàn thành N/M" dạng progress ở đầu, tài liệu tải 1 chạm. |
| Chứng nhận | Thêm màn hình xem/chứng nhận PDF của chính mình (spec `docs/02-user-roles.md:28` cho phép ✅ xem — UI web chưa có điểm truy cập). |

---

## 4. Fixes nền tảng chung (áp cho mọi role) — Web

1. **`loading.tsx` skeleton** cho: `(dashboard)`, `interns`, `tasks`, `attendance`, `reports`, `requests`, `evaluations`, `onboarding` — skeleton khớp hình dạng bảng/stat card (không dùng spinner tròn).
2. **`error.tsx` + `not-found.tsx`** branded: thông báo tiếng Việt, nút "Thử lại" / "Về trang chủ".
3. **`AlertDialog` thay toàn bộ 11 `window.confirm`** (cài `alert-dialog.tsx`).
4. **Thống nhất bảng**: kéo `reports-table`, `requests-table`, `record-list` về `DataTable`; filter dùng `ui/select`/`ui/input` thay native.
5. **Thống nhất `StatCard` + `ExportCsvButton` + form field wrapper** (`Label + Input + lỗi inline`, hiện mỗi form tự render).
6. **Ẩn/mã hoá mã lỗi hạ tầng**: banner migration chỉ hiện cho **admin**; với role khác hiển thị thông báo tiếng Việt thân thiện ("Hệ thống đang được cập nhật, vui lòng thử lại sau").
7. DataTable nâng cấp: sort theo cột, pageSize chọn được (25/50/100), key bằng id thay index.

---

## 5. Fixes nền tảng chung — Mobile

1. Tách widget dùng lại → `lib/shared/widgets/` (`StatTile`, `QuickAction`, `SectionHeader`, `KeyValueRow`, `AppConfirmDialog`).
2. Skeleton list/detail cho 7 màn đang dùng spinner; **sửa empty-state chặn PTR** ở reports/requests (bọc `RefreshIndicator` ngoài cùng).
3. `Text('$e')` → map error code Supabase → thông báo tiếng Việt (một `lib/core/errors.dart`); xoá banner migration khỏi UI.
4. Ellipsis + `maxLines` cho mọi title/preview/URL; `SelectableText` cho detail dài.
5. Confirm đồng nhất cho: logout, xóa notification, huỷ đơn, đổi status sang `cancelled`; form sheet thêm drag-handle + confirm khi đóng dở.
6. Login: validate email/password inline + nút show/hide mật khẩu + link "Quên mật khẩu" (spec có, app thiếu).
7. FCM: mở đúng màn hình theo `data.screen`/`data.id` (spec `docs/09-mobile.md:72`); thêm tab/bell notification + badge đếm unread realtime; "đánh dấu đã đọc tất cả".
8. Avatar: ảnh hoặc initials thay `Icon(person)`.

---

## 6. Ma trận ưu tiên & ước lượng

> **Trạng thái:** Batch **P0, P1, P2 và P3 (popup căn giữa) đã triển khai ngày 2026-10-29** — xem mục 8 để biết thay đổi cụ thể.

| Ưu tiên | Hạng mục | Nền tảng | Effort |
|---|---|---|---|
| **P0 ✅** | Fix font `--font-sans` | Web | 5 phút |
| **P0 ✅** | Ẩn/mã hoá banner + `Text('$e')` migration | Web + Mobile | Nhỏ |
| **P0 ✅** | Empty state chặn pull-to-refresh (reports/requests) | Mobile | Nhỏ |
| **P0 ✅** | `AlertDialog` thay `window.confirm` (11 chỗ web) + confirm mobile (logout/xóa/cancel) | Cả hai | Trung |
| **P0 ✅** | Login mobile validation | Mobile | Nhỏ |
| **P1 ✅** | `loading.tsx` skeleton + `error.tsx`/`not-found.tsx` | Web | Trung |
| **P1 ✅** | Skeleton thay spinner (6 màn) | Mobile | Trung |
| **P1 ✅** | Chia section nav + breadcrumb + user dropdown | Web | Trung |
| **P1 ✅** | Đồng bộ hoá bảng về `DataTable`; thống nhất StatCard/ExportCsvButton | Web | Trung |
| **P1 ✅** | Theme tokens (`AppColors/Spacing/Radius`) + StatusPill thật | Mobile | Trung |
| **P1 ✅** | FCM deep link theo `data.table/id` + badge bell | Mobile | Trung |
| **P2 ✅** | Command palette ⌘K + dark mode thật (next-themes) | Web | Trung |
| **P2 ✅** | Charts `recharts` cho dashboard Admin/HR | Web | Trung |
| **P2 ✅** | Review queue cho Mentor (`/mentor/review`) + drag-and-drop Kanban | Web | Trung |
| **P2 ✅** | Mentor screens mobile (danh sách intern phụ trách, swipe approve) | Mobile | Trung |
| **P2 ✅** | Peak moment check-in (micro-animation) + wizard import CSV 3 bước | Cả hai | Trung |

---

## 7. Nguyên tắc khi triển khai (từ 2 skill)

- **Không rewrite**: làm việc trên stack hiện có (Tailwind v4, shadcn/Base UI, Flutter Material 3); small targeted improvements.
- Mọi component mới phải **dùng lại được** cho ≥2 màn hình; không hardcode màu/radius/spacing ngoài tokens.
- Trạng thái **bắt buộc 4 loại**: loading (skeleton) · empty (có CTA) · error (có retry) · success (toast/inline).
- Ngôn ngữ: sentence case, tiếng Việt, không dấu `!` trong thông báo thành công, không exclamation/“Oops!”.
- Kiểm thử theo `docs/15-testing.md` sau mỗi batch; không phá luồng RLS/role-guard hiện có (`lib/auth.ts`, server actions).

---

## 8. Nhật ký triển khai

### Batch P0 (2026-10-29) — đã hoàn thành

**Web-admin:**
- Fix font: `app/globals.css` — `--font-sans`/`--font-heading` tự tham chiếu → trỏ đúng `--font-geist-sans` (Geist giờ được áp dụng).
- Component mới:
  - `components/ui/alert-dialog.tsx` — wrapper Base UI `AlertDialog` theo style shadcn (dùng `Button` render).
  - `components/confirm-dialog.tsx` — hook `useConfirm()` (Promise<boolean>) và `usePrompt()` (Promise<string|null>, validate minLength) thay `window.confirm`/`window.prompt`.
  - `components/migration-notice.tsx` — banner chỉ hiện hướng dẫn migration cho **admin**, role khác thấy thông báo thân thiện.
- Thay **toàn bộ 11 `window.confirm` + 4 `window.prompt`** còn sót: `record-actions`, `checklist-manager`, `document-manager`, `report-detail-actions`, `request-detail-actions`, `report-form` (submit chuyển sang `requestSubmit()` sau confirm), `work-location-form` (delete).
- Ẩn lỗi hạ tầng: 4 trang `intern/reports`, `intern/requests`, `admin/reports`, `admin/requests` dùng `MigrationNotice`.
- Verify: `tsc --noEmit` sạch, `eslint` 0 lỗi (4 warning `img` có sẵn từ trước).

**Mobile (Flutter):**
- Empty state không còn chặn pull-to-refresh: `reports_screen`, `requests_screen`, `notifications_screen` — `RefreshIndicator` bọc ngoài cùng, `EmptyView`/`ErrorView` bọc scrollable.
- Login: validate email định dạng + password không rỗng (errorText inline), nút show/hide mật khẩu, map lỗi auth sang tiếng Việt ("Email hoặc mật khẩu không đúng"...), lỗi lạ → debugPrint + thông báo chung.
- Ẩn lỗi kỹ thuật: helper `lib/shared/snackbar.dart` (`friendlyErrorSnack`) thay 10 chỗ `Text('$e')` trong `task_detail`, `reports`, `requests`; bỏ banner migration trong UI mobile.
- Confirm: đăng xuất (`profile_screen`), xóa thông báo (`notifications_screen`), chuyển task/sub-task sang "Đã hủy" (`task_detail_screen` — `_confirmCancel`).
- Verify: `flutter analyze` — 0 issue.

### Batch P1 (2026-10-29) — đã hoàn thành

**Web-admin:**
- Nav chia nhóm: `features/nav.ts` viết lại theo `navSections` (Tổng quan / Nhân sự / Onboarding / Vận hành / Kết quả / Hệ thống) + `getNavSections(role)`; sidebar (`components/layout/sidebar.tsx`) render theo section có nhãn nhóm, bỏ prop `compact` dead code.
- Breadcrumb tự sinh: `components/layout/breadcrumbs.tsx` (mới) từ pathname + `routeLabels`/`routeLabel()` — ẩn ở màn nhỏ, tự truncate >3 cấp. Topbar thêm DropdownMenu tài khoản (avatar + họ tên + role + Đăng xuất) thay nút logout trần.
- `components/data-table.tsx` nâng cấp: `searchText` (tìm chuỗi lồng nhau), `toolbar` (khu bộ lọc), `emptyState`, `rowKey`, chọn pageSize 10/25/50/100 (mặc định 25). Viết lại `features/reports/reports-table.tsx` + `features/requests/requests-table.tsx` trên DataTable (bỏ `<table>` thô + ô select search trùng lặp).
- Hợp nhất copy-paste: `components/stat-card.tsx` (mới, thay 3 kiểu stat card) + `components/export-csv-button.tsx` (mới, thay 5 bản nút Xuất CSV).
- Trạng thái bắt buộc: `components/skeletons.tsx` (`DashboardSkeleton`, `TableSkeleton`) + 12 file `loading.tsx` cho (dashboard), interns, tasks, attendance, evaluations, admin/{reports,requests,onboarding}, mentor/onboarding, intern/{reports,requests,onboarding}; `app/error.tsx` (branded, retry + về trang chủ) và `app/not-found.tsx` (404 branded).
- Verify: `tsc --noEmit` 0 lỗi, `eslint` chỉ còn 4 warning `img` có sẵn.

**Mobile (Flutter):**
- Theme tokens: `lib/core/theme/app_theme.dart` (mới) — `AppColors` (seed emerald `0xFF059669` khớp web, thay indigo `0xFF3F51B5`), `AppSpacing` (bội 4/8), `AppRadius`, `buildAppTheme()`; `main.dart` dùng lại thay theme inline.
- `StatusPill` thật: nền màu 12% + viền 25% + bo pill, màu theo bảng token (`lib/shared/status_pill.dart`).
- Skeleton: `lib/shared/skeleton.dart` (mới — `SkeletonBox`/`SkeletonListTile`/`SkeletonListView`, nhấp nháy nhẹ) thay `CircularProgressIndicator` ở dashboard, tasks, task_detail, notifications, reports, requests (6 màn).
- Checkin: bỏ màu hardcode (`Colors.green.shade50`, `redAccent`...) → `AppColors` + `statusColors`.
- FCM deep link: `_onOpened` đọc `data['table']`/`data['id']` — `tasks` → `TaskDetailScreen` (fetch role qua `get_my_role`), các bảng khác → màn thông báo; badge bell dashboard đổi sang `AppColors.danger`.
- Verify: `flutter analyze` — 0 issue.

### Batch P3 (2026-10-29) — cửa sổ nhỏ căn giữa màn hình

**Web-admin:**
- Component mới `components/ui/dialog.tsx` — dialog Base UI **căn giữa viewport** (`top-1/2 left-1/2 -translate`), `max-h-[calc(100svh-4rem)]` + `overflow-y-auto`, có overlay tối, nút Đóng góc phải, API giống hệt `Sheet` để thay thế trực tiếp.
- Chuyển **19 file form** từ `Sheet` (trượt từ phải) sang `Dialog` căn giữa: intern/mentor/batch/cert/department/task/eval/settings form, work-location, adjust-dialog, request-form, wizard import CSV, và toàn bộ onboarding managers (create/edit-record, checklist, configuration, document, catalog-document, intern-profile).
- `Sheet` chỉ còn 1 chỗ dùng đúng mục đích: nav drawer mobile trong `topbar.tsx` (trượt từ trái — chuẩn UX cho menu).
- AlertDialog/confirm-dialog/command palette đã căn giữa từ trước — giữ nguyên.
- Verify: `tsc --noEmit` 0 lỗi, `eslint` 0 lỗi (4 warning `img` có sẵn).

**Mobile (Flutter):**
- Rà lại: `showDialog` (AlertDialog) đã căn giữa mặc định của Material ✅; `showModalBottomSheet` từ dưới lên là chuẩn UX mobile cho form dài/filter — giữ nguyên, không đổi.
- Verify: `flutter analyze` — 0 issue.

### Batch P2 (2026-10-29) — đã hoàn thành

**Web-admin:**
- Dark mode thật: `app/layout.tsx` bọc `ThemeProvider` (next-themes, `attribute="class"`, `defaultTheme="system"`); CSS `.dark` tokens có sẵn trong `globals.css` giờ được kích hoạt. `components/theme-toggle.tsx` (mới) — nút Moon/Sun dùng `useSyncExternalStore` để tránh hydration mismatch, đặt trong topbar.
- Command palette ⌘K/Ctrl+K: `components/command-palette.tsx` (mới) — lọc nav items theo role, điều hướng bằng phím ↑/↓/Enter/Esc, không thêm dependency. Trigger "Tìm trang... ⌘K" trong topbar.
- Charts: `components/charts/dashboard-charts.tsx` (mới, recharts) — BarChart "Task theo trạng thái" + Donut "Tình hình thực tập sinh", thay 2 RecentList text; có empty state. Colors dùng CSS vars `--chart-1..5` (tự thích ứng dark mode).
- Kanban drag-and-drop: `tasks/tasks-board.tsx` — card `draggable`, cột nhận drop với ring highlight, gọi `updateTaskStatus` + toast + `router.refresh()`; chỉ staff được kéo (prop `canManage`), pending state làm mờ card.
- Review queue Mentor: `/mentor/review` (mới, gồm `page.tsx` + `review-queue.tsx` + `loading.tsx`) — gộp báo cáo + đơn từ chờ duyệt (RLS tự lọc theo mentor), duyệt nhanh approve/request_revision/reject ngay trên card bằng `useConfirm`/`usePrompt`; nav thêm "Hàng đợi duyệt" cho mentor.
- Wizard import CSV 3 bước: `interns/import-csv.tsx` viết lại — thanh tiến trình (Chọn file → Xác nhận → Kết quả), tách bước chọn file / cấu hình đợt + xem trước / kết quả (card thành công/thất bại + tải báo cáo lỗi), reset khi đóng sheet.
- Verify: `tsc --noEmit` 0 lỗi, `eslint` 0 lỗi (4 warning `img` có sẵn).

**Mobile (Flutter):**
- Mentor intern list: `lib/features/mentors/mentor_interns_screen.dart` (mới) — danh sách intern phụ trách (RLS tự lọc internships), bottom sheet chi tiết + lối tắt tới công việc/báo cáo/đơn; dashboard mentor thêm quick action "Intern phụ trách" (`_QuickAction.badge` giờ optional).
- Swipe approve: `reports_screen` + `requests_screen` ở approveMode — card `Dismissible` (vuốt phải = phê duyệt, vuốt trái = yêu cầu chỉnh sửa/bổ sung), có confirm dialog trước khi chốt, background màu AppColors; reload list sau thao tác.
- Peak moment check-in: `_SuccessBanner` trong `checkin_screen` — icon check "nảy" (elasticOut scale) khi điểm danh thành công.
- Verify: `flutter analyze` — 0 issue.
