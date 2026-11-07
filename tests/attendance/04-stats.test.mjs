// ==========================================================================
// 04-stats.test.mjs — Nhóm 5: Tìm kiếm, lọc, thống kê.
//   * Unit test logic stats.ts bằng node:test + type stripping (zero-dep).
//   * Đối chiếu RPC thống kê với số liệu đếm tay từ DB (ground truth).
// ==========================================================================
import assert from "node:assert/strict";
import { before, test } from "node:test";

import {
  getWorld,
  login,
  rpc,
  svc,
  todayVN,
  userApi,
  emails,
} from "./helpers.mjs";
// Node24 type-stripping: import trực tiếp .ts (chỉ có type-import bị loại bỏ,
// không phụ thuộc path alias runtime).
import { getTodayVN, summarizeAttendance } from "../../web-admin/features/attendance/stats.ts";

let W;
const T = {};

before(async () => {
  W = await getWorld();
  T.hr = await login(emails.hr);
});

// --------------------------------------------------------------------------
// Unit test — features/attendance/stats.ts
// --------------------------------------------------------------------------

test("AT-062a summarizeAttendance đếm đúng từng trạng thái + tỷ lệ chuyên cần", () => {
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
  const s = summarizeAttendance(rows);
  assert.equal(s.total, 8);
  assert.equal(s.present, 3);
  assert.equal(s.late, 1);
  assert.equal(s.absent, 1);
  assert.equal(s.leave, 1);
  assert.equal(s.wfh, 1);
  assert.equal(s.earlyLeave, 1);
  assert.equal(s.missingCheckout, 1, "1 bản ghi có check-in nhưng thiếu check-out");
  // (present + late) / total * 100 = 4/8 → 50.0
  assert.equal(s.attendanceRate, 50);
});

test("AT-062b summarizeAttendance với dữ liệu rỗng → toàn 0", () => {
  const s = summarizeAttendance([]);
  assert.deepEqual(s, {
    total: 0,
    present: 0,
    late: 0,
    absent: 0,
    leave: 0,
    wfh: 0,
    earlyLeave: 0,
    missingCheckout: 0,
    attendanceRate: 0,
  });
});

test("AT-062c attendanceRate làm tròn 1 chữ số (66.666 → 66.7)", () => {
  const rows = [
    { status: "present" },
    { status: "late" },
    { status: "absent" },
  ];
  const s = summarizeAttendance(rows);
  assert.equal(s.attendanceRate, 66.7);
});

test("AT-062d getTodayVN = ngày hôm nay theo Asia/Ho_Chi_Minh", () => {
  const viaIntl = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  assert.equal(getTodayVN(), viaIntl, "getTodayVN phải khớp giờ VN chuẩn");
  assert.equal(getTodayVN(), todayVN(), "khớp helper todayVN của test suite");
});

// --------------------------------------------------------------------------
// Integration — lọc / phân trang / RPC thống kê
// --------------------------------------------------------------------------

test("AT-058 Lọc theo ngày → đúng ngày, không lệch", async () => {
  const day = todayVN(-5);
  const r = await userApi(T.hr, `/rest/v1/attendance?work_date=eq.${day}&select=work_date&limit=1000`);
  assert.equal(r.status, 200);
  assert.ok(r.data.length > 0, "phải có dữ liệu ngày -5 (đã seed 500 dòng)");
  assert.ok(r.data.every((x) => x.work_date === day));
});

test("AT-059 Lọc theo trạng thái → chỉ trả trạng thái đó", async () => {
  const r = await userApi(T.hr, "/rest/v1/attendance?status=eq.late&select=status&limit=1000");
  assert.ok(r.data.length > 0, "dữ liệu seed phải có bản ghi late");
  assert.ok(r.data.every((x) => x.status === "late"));
});

test("AT-060 Lọc theo intern + đợt thực tập kết hợp", async () => {
  const r = await userApi(
    T.hr,
    `/rest/v1/attendance?intern_id=eq.${W.interns["01"]}&internship_id=eq.${W.internships.intern01}&select=intern_id,internship_id&limit=1000`,
  );
  assert.ok(r.data.length > 0);
  assert.ok(
    r.data.every((x) => x.intern_id === W.interns["01"] && x.internship_id === W.internships.intern01),
  );
});

test("AT-061 Kết hợp lọc + phân trang server-side (content-range chính xác)", async () => {
  const url = `/rest/v1/attendance?select=id&limit=50&offset=0`;
  const page1 = await userApi(T.hr, url, { headers: { Prefer: "count=exact" } });
  const total = Number(page1.headers["content-range"]?.split("/")[1]);
  assert.ok(Number.isFinite(total) && total > 50, `content-range=${page1.headers["content-range"]}`);
  assert.equal(page1.data.length, 50, "trang 1 đúng 50 dòng (không tải hết bảng)");

  // Tổng số phải khớp đếm chính xác
  const countOnly = await userApi(T.hr, "/rest/v1/attendance?select=id&limit=1", {
    headers: { Prefer: "count=exact" },
  });
  const exact = Number(countOnly.headers["content-range"]?.split("/")[1]);
  assert.equal(total, exact, "tổng trong content-range phải bằng số dòng thật");

  // Trang 2 không trùng trang 1
  const page2 = await userApi(T.hr, "/rest/v1/attendance?select=id&limit=50&offset=50");
  const ids1 = new Set(page1.data.map((x) => x.id));
  assert.ok(page2.data.every((x) => !ids1.has(x.id)), "không trùng dòng giữa các trang");
});

test("AT-063 RPC attendance_rate khớp số liệu đếm tay từ DB", async () => {
  const internshipId = W.internships.intern01;
  const rows = await svc(`/rest/v1/attendance?internship_id=eq.${internshipId}&select=status`);
  const total = rows.data.length;
  assert.ok(total > 0, "intern01 phải có dữ liệu điểm danh");
  const attended = rows.data.filter((x) => x.status === "present" || x.status === "late").length;
  const expected = total === 0 ? 0 : Math.round((1000 * attended) / total) / 10;

  const r = await rpc("attendance_rate", { p_internship_id: internshipId }, T.hr);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(Number(r.data), expected, `RPC=${r.data} vs đếm tay=${expected} (tổng ${total}, có mặt ${attended})`);
});

test("AT-064 get_request_stats khớp DB (RPC vs REST vs service)", async () => {
  const r = await rpc("get_request_stats", {}, T.hr);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(r.data && typeof r.data.total === "number", JSON.stringify(r.data));

  // Ground truth: service role (bypass RLS)
  const truth = await svc("/rest/v1/requests?select=status&limit=10000");
  const counts = {};
  for (const row of truth.data) counts[row.status] = (counts[row.status] || 0) + 1;

  assert.equal(r.data.total, truth.data.length, "tổng số đơn phải khớp DB");

  // HR REST cũng phải thấy đủ (RLS không làm mất dữ liệu HR được phép thấy)
  const rest = await userApi(T.hr, "/rest/v1/requests?select=status&limit=10000");
  assert.equal(rest.data.length, truth.data.length, "HR thấy đủ mọi đơn qua REST");

  const restCounts = {};
  for (const row of rest.data) restCounts[row.status] = (restCounts[row.status] || 0) + 1;
  assert.deepEqual(r.data.by_status, counts, "by_status khớp ground truth");
  assert.deepEqual(restCounts, counts, "REST khớp ground truth");
});
