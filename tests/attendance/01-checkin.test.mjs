// ==========================================================================
// 01-checkin.test.mjs — Nhóm 1 & 2: Check-in/Check-out + toàn vẹn dữ liệu
// Chạy thật RPC `attendance_check` trên Supabase remote bằng service role
// (function chỉ grant service_role — đúng như thiết kế edge function/API).
// ==========================================================================
import assert from "node:assert/strict";
import { before, test } from "node:test";

import {
  PREFIX,
  emails,
  getWorld,
  login,
  rpc,
  svc,
  todayVN,
  userApi,
  vnClock,
} from "./helpers.mjs";

let W;
let tIntern01;
let att01; // bản ghi hôm nay của intern01 (AT-001)

const MAIN = { lat: 10.7626, lon: 106.66 };      // trong bán kính MAIN
const FAR = { lat: 10.7826, lon: 106.68 };       // ~2.7km — ngoài mọi địa điểm
const WINDOW = { lat: 10.7726, lon: 106.67 };    // địa điểm khung giờ luôn đóng
const EARLY = { lat: 10.7526, lon: 106.65 };     // địa điểm check_out_start=23:59

async function checkIn(internKey, pos, accuracy = 10) {
  return rpc("attendance_check", {
    p_user_id: W.users[internKey],
    p_action: "CHECK_IN",
    p_latitude: pos.lat,
    p_longitude: pos.lon,
    p_accuracy: accuracy,
  });
}

async function checkOut(internKey, pos, accuracy = 10) {
  return rpc("attendance_check", {
    p_user_id: W.users[internKey],
    p_action: "CHECK_OUT",
    p_latitude: pos.lat,
    p_longitude: pos.lon,
    p_accuracy: accuracy,
  });
}

async function todayRow(internNum) {
  const r = await svc(
    `/rest/v1/attendance?intern_id=eq.${W.interns[internNum]}&work_date=eq.${todayVN()}&select=*`,
  );
  return r.data[0] || null;
}

async function countToday(internNum) {
  const r = await svc(
    `/rest/v1/attendance?intern_id=eq.${W.interns[internNum]}&work_date=eq.${todayVN()}&select=id`,
  );
  return r.data.length;
}

before(async () => {
  W = await getWorld();
  tIntern01 = await login(emails.intern01);
  // Reset bản ghi HÔM NAY của 10 intern test (chỉ dữ liệu TEST-QA-) để test
  // check-in chạy trên trạng thái sạch, không phụ thuộc thứ tự lần chạy trước.
  const ids = Object.values(W.interns).join(",");
  await svc(`/rest/v1/attendance?intern_id=in.(${ids})&work_date=eq.${todayVN()}`, {
    method: "DELETE",
  });
});

// --------------------------------------------------------------------------
// Nhóm 1 — Check-in / Check-out
// --------------------------------------------------------------------------

test("AT-001 Check-in tại địa điểm hợp lệ → tạo bản ghi đúng", async () => {
  const t0 = Date.now();
  const r = await checkIn("intern01", MAIN);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.success, true, JSON.stringify(r.data));
  assert.ok(["present", "late"].includes(r.data.status), `status=${r.data.status}`);
  assert.ok(r.data.distance_meters <= 100, `distance=${r.data.distance_meters}`);

  att01 = await todayRow("01");
  assert.ok(att01, "phải có bản ghi attendance hôm nay");
  assert.equal(att01.work_date, todayVN(), "work_date phải là hôm nay (giờ VN)");
  assert.equal(att01.is_geo_validated, true);
  const ci = new Date(att01.check_in_at).getTime();
  assert.ok(Math.abs(ci - t0) < 120000, `check_in_at=${att01.check_in_at} phải ≈ giờ server`);

  const logs = await svc(
    `/rest/v1/attendance_verification_logs?attendance_id=eq.${att01.id}&is_valid=eq.true&select=id`,
  );
  assert.ok(logs.data.length >= 1, "phải có log xác minh thành công");
});

test("AT-007/AT-017/AT-012 Check-in lần 2 → ALREADY_CHECKED_IN, không ghi đè, không tạo bản mới", async () => {
  assert.ok(att01, "AT-001 phải chạy trước");
  const beforeIn = att01.check_in_at;
  const r = await checkIn("intern01", MAIN);
  assert.equal(r.data.success, false, JSON.stringify(r.data));
  assert.equal(r.data.code, "ALREADY_CHECKED_IN");

  const row = await todayRow("01");
  assert.equal(row.check_in_at, beforeIn, "check_in_at không được bị ghi đè");
  assert.equal(await countToday("01"), 1, "chỉ 1 bản ghi/ngày");

  // Log phải ghi nhận lần từ chối
  const failLogs = await svc(
    `/rest/v1/attendance_verification_logs?attendance_id=eq.${row.id}&failure_reason=eq.ALREADY_CHECKED_IN&select=id`,
  );
  assert.ok(failLogs.data.length >= 1, "phải có log ALREADY_CHECKED_IN");
});

test("AT-002 Check-in ngoài bán kính → LOCATION_OUT_OF_RANGE, không tạo bản ghi", async () => {
  const r = await checkIn("intern02", FAR);
  assert.equal(r.data.success, false, JSON.stringify(r.data));
  assert.equal(r.data.code, "LOCATION_OUT_OF_RANGE");
  assert.equal(await countToday("02"), 0, "không tạo bản ghi ngoài vị trí");

  const failLogs = await svc(
    `/rest/v1/attendance_verification_logs?user_id=eq.${W.users.intern02}&failure_reason=eq.LOCATION_OUT_OF_RANGE&select=id`,
  );
  assert.ok(failLogs.data.length >= 1, "phải có log LOCATION_OUT_OF_RANGE");
});

test("AT-006 GPS accuracy thấp (100 > ngưỡng 50) → ACCURACY_NOT_MET", async () => {
  const r = await checkIn("intern02", MAIN, 100);
  assert.equal(r.data.success, false, JSON.stringify(r.data));
  assert.equal(r.data.code, "ACCURACY_NOT_MET");
  assert.equal(await countToday("02"), 0);

  const failLogs = await svc(
    `/rest/v1/attendance_verification_logs?user_id=eq.${W.users.intern02}&failure_reason=eq.ACCURACY_NOT_MET&select=id`,
  );
  assert.ok(failLogs.data.length >= 1);
});

test("AT-005 GPS không xác định (toạ độ null / ngoài dải) → VALIDATION_ERROR", async () => {
  const r1 = await rpc("attendance_check", {
    p_user_id: W.users.intern02,
    p_action: "CHECK_IN",
    p_latitude: null,
    p_longitude: null,
    p_accuracy: 10,
  });
  assert.equal(r1.data.success, false);
  assert.equal(r1.data.code, "VALIDATION_ERROR");

  const r2 = await rpc("attendance_check", {
    p_user_id: W.users.intern02,
    p_action: "CHECK_IN",
    p_latitude: 91,
    p_longitude: 200,
    p_accuracy: 10,
  });
  assert.equal(r2.data.success, false);
  assert.equal(r2.data.code, "VALIDATION_ERROR");
  assert.equal(await countToday("02"), 0, "không tạo bản ghi với toạ độ hỏng");
});

test("AT-013 Tọa độ giả mạo (đặt vị trí khác) → backend tự tính khoảng cách và từ chối", async () => {
  const r = await checkIn("intern03", FAR);
  assert.equal(r.data.success, false);
  assert.equal(r.data.code, "LOCATION_OUT_OF_RANGE", "client không thể ép kết quả thành công");
  assert.equal(await countToday("03"), 0);
});

test("Khung giờ: CHECK_IN khi cửa sổ đóng → CHECK_IN_WINDOW_CLOSED", async () => {
  const r = await checkIn("intern03", WINDOW);
  assert.equal(r.data.success, false, JSON.stringify(r.data));
  assert.equal(r.data.code, "CHECK_IN_WINDOW_CLOSED");
  assert.equal(await countToday("03"), 0);
});

test("Khung giờ: CHECK_OUT khi cửa sổ đóng → CHECK_OUT_WINDOW_CLOSED", async () => {
  const r = await checkOut("intern03", WINDOW);
  assert.equal(r.data.success, false, JSON.stringify(r.data));
  assert.equal(r.data.code, "CHECK_OUT_WINDOW_CLOSED");
  assert.equal(await countToday("03"), 0);
});

test("AT-008 Check-out khi chưa check-in → NEED_CHECK_IN, không tạo bản ghi", async () => {
  const r = await checkOut("intern06", MAIN);
  assert.equal(r.data.success, false, JSON.stringify(r.data));
  assert.equal(r.data.code, "NEED_CHECK_IN");
  assert.equal(await countToday("06"), 0);
});

test("AT-010 Check-out ngoài vị trí → LOCATION_OUT_OF_RANGE, check_out_at vẫn null", async () => {
  const rIn = await checkIn("intern04", EARLY);
  assert.equal(rIn.data.success, true, JSON.stringify(rIn.data));

  const r = await checkOut("intern04", FAR);
  assert.equal(r.data.success, false, JSON.stringify(r.data));
  assert.equal(r.data.code, "LOCATION_OUT_OF_RANGE");

  const row = await todayRow("04");
  assert.equal(row.check_out_at, null, "check_out_at phải vẫn null");
});

test("AT-011/AT-023 Check-out hợp lệ → lưu đúng giờ server, status early_leave trước giờ ca", async () => {
  const t0 = Date.now();
  const r = await checkOut("intern04", EARLY);
  assert.equal(r.data.success, true, JSON.stringify(r.data));

  const row = await todayRow("04");
  assert.ok(row.check_out_at, "phải có check_out_at");
  const co = new Date(row.check_out_at).getTime();
  assert.ok(Math.abs(co - t0) < 120000, `check_out_at=${row.check_out_at} ≈ giờ server`);
  // EARLY có check_out_start=23:59 → check-out trước 23:59 giờ VN → early_leave
  if (vnClock() < "23:59") {
    assert.equal(row.status, "early_leave", "status phải là early_leave trước giờ ca");
  }
});

test("AT-009 Check-out lần 2 → ALREADY_CHECKED_OUT, không ghi đè giờ ra", async () => {
  const row0 = await todayRow("04");
  const r = await checkOut("intern04", EARLY);
  assert.equal(r.data.success, false, JSON.stringify(r.data));
  assert.equal(r.data.code, "ALREADY_CHECKED_OUT");
  const row1 = await todayRow("04");
  assert.equal(row1.check_out_at, row0.check_out_at, "check_out_at không được đổi");
  assert.equal(await countToday("04"), 1);
});

// --------------------------------------------------------------------------
// Nhóm 2 — Tính toàn vẹn dữ liệu
// --------------------------------------------------------------------------

test("AT-016 Một bản ghi/ngày: insert trùng (intern_id, work_date) bị unique chặn", async () => {
  const r = await svc("/rest/v1/attendance", {
    method: "POST",
    body: JSON.stringify([
      {
        intern_id: W.interns["01"],
        internship_id: W.internships.intern01,
        work_date: todayVN(),
        status: "present",
      },
    ]),
  });
  assert.equal(r.status, 409, `mong đợi 409 unique violation, nhận ${r.status}: ${JSON.stringify(r.data)}`);
  assert.equal(r.data?.code, "23505", JSON.stringify(r.data));
  assert.equal(await countToday("01"), 1, "vẫn chỉ 1 bản ghi");
});

test("AT-021 Timezone VN: work_date = ngày VN tại thời điểm check-in", async () => {
  const row = await todayRow("01");
  assert.ok(row);
  assert.equal(row.work_date, todayVN());
  // check_in_at là timestamptz — trích ngày theo UTC+7 từ instant đã lưu
  // phải khớp work_date (cách RPC 0016 tính work_date).
  const instant = new Date(row.check_in_at).getTime();
  const vnDateOfCheckIn = new Date(instant + 7 * 3600 * 1000).toISOString().slice(0, 10);
  assert.equal(row.work_date, vnDateOfCheckIn, "work_date phải là ngày VN của check_in_at");
});

test("AT-024 DB ↔ API đồng nhất: dữ liệu đọc qua REST giống hệt DB", async () => {
  const r = await userApi(tIntern01, `/rest/v1/attendance?work_date=eq.${todayVN()}&select=*`);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const mine = r.data.filter((x) => x.intern_id === W.interns["01"]);
  assert.equal(mine.length, 1, "intern01 chỉ thấy đúng 1 bản ghi của mình hôm nay");

  const dbRow = await todayRow("01");
  for (const k of ["id", "work_date", "status", "check_in_at", "check_out_at", "is_geo_validated"]) {
    assert.deepEqual(mine[0][k], dbRow[k], `field ${k} phải giống nhau`);
  }
});
