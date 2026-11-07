// tests/ui/ui-regression.mjs — Regression guard cho UI/UX sau nâng cấp IMS.
// Chạy zero-dep bằng node:test (Node 24 type-stripping):
//   node --test tests/ui/
// Không yêu cầu DB / trình duyệt. Các case bắt buộc có trình duyệt
// (E2E, responsive chụp màn hình, thao tác form thật) được ghi NOT RUN
// trong báo cáo docs/21-ui-ux-test-report.md và không fake PASS tại đây.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

let stats, labels;
try {
  stats = await import("../../web-admin/features/attendance/stats.ts");
  labels = await import("../../web-admin/features/labels.ts");
} catch (e) {
  throw new Error(`import pure TS modules failed: ${e.message}`);
}

// ---------------------------------------------------------------------------
// Nhóm: Design tokens (globals.css)
// ---------------------------------------------------------------------------
test("UI-013/014/015/016/017: token success/warning/info + focus + reduced-motion", () => {
  const css = read("web-admin/app/globals.css");
  assert.match(css, /--success:\s*oklch/);
  assert.match(css, /--warning:\s*oklch/);
  assert.match(css, /--info:\s*oklch/);
  assert.match(css, /--color-success:\s*var\(--success\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /::selection/);
});

test("UI-028: badge variant success/orange/outline giữ đủ", () => {
  const badge = read("web-admin/components/ui/badge.tsx");
  for (const v of ["success:", "orange:", "outline:"]) {
    assert.ok(badge.includes(v), `badge missing ${v}`);
  }
});

// ---------------------------------------------------------------------------
// Nhóm: Layout / Sidebar / Header / Breadcrumb
// ---------------------------------------------------------------------------
test("UI-002/009/034: Sidebar dùng token primary, badge, aria-current, chữ >=11px", () => {
  const s = read("web-admin/components/layout/sidebar.tsx");
  assert.match(s, /aria-label="Điều hướng chính"/);
  assert.match(s, /aria-current=\{active \? "page"/);
  assert.match(s, /pathname === item\.href/);
  assert.match(s, /text-\[11px\]/);
  assert.doesNotMatch(s, /text-\[10px\]/);
  assert.doesNotMatch(s, /bg-emerald-/);
  assert.match(s, /<Badge variant="success"/);
  assert.match(s, /motion-safe:animate-ping/);
});

test("UI-003: Topbar initials đúng, sheet không nút đóng đè logo, badge role", () => {
  const t = read("web-admin/components/layout/topbar.tsx");
  assert.match(t, /function getInitials\(/);
  assert.doesNotMatch(t, /\{user\.full_name\.slice\(0, 2\)/);
  assert.match(t, /showCloseButton=\{false\}/);
  assert.match(t, /<Badge variant="success"/);
  assert.match(t, /aria-label="Mở menu"/);
});

test("UI-005: Breadcrumb ellipsis theo thứ tự, truncate, tiếng Việt", () => {
  const b = read("web-admin/components/layout/breadcrumbs.tsx");
  assert.match(b, /visible = truncated \? \[crumbs\[0\]/);
  assert.match(b, /showEllipsis/);
  assert.match(b, /truncate/);
  const ui = read("web-admin/components/ui/breadcrumb.tsx");
  assert.match(ui, /Xem thêm/);
  assert.doesNotMatch(ui, /sr-only">More/);
  const sheet = read("web-admin/components/ui/sheet.tsx");
  assert.match(sheet, /sr-only">Đóng/);
  assert.doesNotMatch(sheet, /sr-only">Close/);
});

test("UI-004/UI-010: PageHeader wrap actions, không tràn mobile", () => {
  const p = read("web-admin/components/page-header.tsx");
  assert.match(p, /flex-wrap/);
  assert.match(p, /truncate/);
  assert.match(p, /aria-hidden/);
});

test("UI-029: StatCard tone semantic + motion-reduce", () => {
  const sc = read("web-admin/components/stat-card.tsx");
  assert.match(sc, /"success" \| "warning" \| "info"/);
  assert.match(sc, /bg-warning/);
  assert.match(sc, /bg-info/);
  assert.match(sc, /motion-reduce/);
});

// ---------------------------------------------------------------------------
// Nhóm: DataTable (tìm kiếm cột lồng nhau — fix P0-1)
// ---------------------------------------------------------------------------
test("UI-087/UI-091: DataTable dot-path, search icon + clear, pagination label", () => {
  const d = read("web-admin/components/data-table.tsx");
  assert.match(d, /function getNestedValue\(/);
  assert.match(d, /path\.split\("\."\)/);
  assert.match(d, /from "lucide-react"/);
  assert.match(d, /aria-label="Xóa tìm kiếm"/);
  assert.match(d, /aria-label=\{searchLabel \?\? searchPlaceholder\}/);
  assert.match(d, /aria-label="Số dòng mỗi trang"/);
  assert.match(d, /htmlFor="data-table-page-size"/);
  assert.doesNotMatch(d, /hover:bg-emerald/);
  assert.match(d, /hover:bg-primary\/5/);
});

test("UI-091/UI-092: EmptyState icon mặc định + action slot", () => {
  const e = read("web-admin/components/empty-state.tsx");
  assert.match(e, /action\?: ReactNode/);
  assert.match(e, /<Inbox/);
  const sk = read("web-admin/components/skeletons.tsx");
  assert.match(sk, /TableSkeleton/);
});

test("UI-025: ExportCsvButton dùng Button chuẩn", () => {
  const x = read("web-admin/components/export-csv-button.tsx");
  assert.match(x, /nativeButton=\{false\}/);
  assert.match(x, /size="sm"/);
  assert.doesNotMatch(x, /h-9.*rounded-md/);
});

// ---------------------------------------------------------------------------
// Nhóm: Labels / StatusBadge
// ---------------------------------------------------------------------------
test("UI-018/UI-028: labels đầy đủ, không dùng sai 'cancelled' cho inactive", () => {
  assert.equal(labels.getStatusLabel("inactive"), "Không hoạt động");
  assert.equal(labels.getStatusLabel("finalized"), "Đã chốt điểm");
  assert.equal(labels.getStatusLabel("reviewed"), "Đã xem xét");
  assert.equal(labels.getStatusLabel("present"), "Có mặt");
  assert.equal(labels.getStatusVariant("inactive"), "outline");
  assert.equal(labels.getStatusVariant("finalized"), "success");
  const dep = read("web-admin/app/(dashboard)/departments/departments-table.tsx");
  assert.match(dep, /"inactive"/);
  assert.doesNotMatch(dep, /"cancelled"/);
  const men = read("web-admin/app/(dashboard)/mentors/mentors-table.tsx");
  assert.match(men, /"inactive"/);
});

// ---------------------------------------------------------------------------
// Nhóm: Chart / Command Palette / Intern Detail
// ---------------------------------------------------------------------------
test("UI-026/ACC: DashboardCharts có role=img + sr-only table", () => {
  const c = read("web-admin/components/charts/dashboard-charts.tsx");
  assert.match(c, /role="img"/);
  assert.match(c, /aria-label=\{`Biểu đồ/);
  assert.match(c, /className="sr-only"/);
  assert.match(c, /var\(--popover\)/);
});

test("UI-031/UI-106/UI-113: CommandPalette aria-modal + mobile trigger + lock scroll", () => {
  const cp = read("web-admin/components/command-palette.tsx");
  assert.match(cp, /aria-modal="true"/);
  assert.match(cp, /aria-label="Tìm trang \(⌘K\)"/);
  assert.doesNotMatch(cp, /hidden h-8.*md:flex/);
  assert.match(cp, /overflow = "hidden"/);
  assert.match(cp, /triggerRef/);
});

test("UI-111/Navigation: InternDetail tab semantics + scroll mobile + feedback có nhãn", () => {
  const id = read("web-admin/app/(dashboard)/interns/[id]/intern-detail.tsx");
  assert.match(id, /role="tablist"/);
  assert.match(id, /aria-selected=\{selected\}/);
  assert.match(id, /role="tabpanel"/);
  assert.match(id, /overflow-x-auto/);
  assert.match(id, /Nhận xét/);
  assert.doesNotMatch(id, /\{\s*r\.feedback \?\? "Chưa có nhận xét"\s*\}/);
});

test("UI-101/UI-099 Regression: interns page không còn vỡ actions", () => {
  const p = read("web-admin/app/(dashboard)/interns/page.tsx");
  assert.match(p, /flex-wrap items-center gap-2/);
});

test("UI-109: Toast có position + closeButton", () => {
  const s = read("web-admin/components/ui/sonner.tsx");
  assert.match(s, /position="bottom-right"/);
  assert.match(s, /closeButton/);
});

// ---------------------------------------------------------------------------
// Nhóm: Logic thuần (attendance stats) — regression không đổi nghiệp vụ
// ---------------------------------------------------------------------------
test("REG-062: summarizeAttendance đếm đúng (pure, không DB)", () => {
  const rows = [
    { status: "present", check_in_at: "2026-11-01T01:00:00Z", check_out_at: "2026-11-01T10:00:00Z" },
    { status: "present", check_in_at: "2026-11-02T01:00:00Z", check_out_at: "2026-11-02T10:00:00Z" },
    { status: "late", check_in_at: "2026-11-03T02:00:00Z", check_out_at: "2026-11-03T10:00:00Z" },
    { status: "absent" },
    { status: "leave" },
    { status: "wfh" },
    { status: "early_leave", check_in_at: "2026-11-04T01:00:00Z", check_out_at: "2026-11-04T08:00:00Z" },
    { status: "present", check_in_at: "2026-11-05T01:00:00Z", check_out_at: null },
  ];
  const s = stats.summarizeAttendance(rows);
  assert.equal(s.total, 8);
  assert.equal(s.present, 3);
  assert.equal(s.late, 1);
  assert.equal(s.attendanceRate, 50);
  assert.deepEqual(stats.summarizeAttendance([]).total, 0);
});

test("REG-062d: getTodayVN khớp Asia/Ho_Chi_Minh", () => {
  const viaIntl = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  assert.equal(stats.getTodayVN(), viaIntl);
});
