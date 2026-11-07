// ==========================================================================
// 06-api-route.test.mjs — Test HTTP thật với web-admin đang chạy (next start).
//   * POST /api/attendance/check: xác thực, phân quyền, chống giả mạo user_id,
//     thời gian do client gửi bị bỏ qua, các kiểm tra backend vẫn enforced.
//   * Smoke SSR các trang Attendance (redirect khi chưa đăng nhập).
// Yêu cầu: server chạy tại WEB_URL (mặc định http://localhost:3100).
// ==========================================================================
import assert from "node:assert/strict";
import { before, test } from "node:test";

import {
  PROJECT_REF,
  WEB_URL,
  emails,
  getWorld,
  login,
  saveWorld,
  svc,
  todayVN,
} from "./helpers.mjs";

let W;
const T = {};
let serverUp = false;

/** Cookie phiên @supabase/ssr: sb-<ref>-auth-token = base64url(JSON session). */
function sessionCookie(accessToken) {
  const session = JSON.stringify({
    access_token: accessToken,
    refresh_token: `rt-${Date.now()}`,
    expires_at: Math.floor(Date.now() / 1000) + 1800,
    expires_in: 1800,
    token_type: "bearer",
  });
  const encoded = Buffer.from(session, "utf8").toString("base64url");
  return `sb-${PROJECT_REF}-auth-token=base64-${encoded}`;
}

async function postCheck(cookie, body) {
  const res = await fetch(`${WEB_URL}/api/attendance/check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

before(async () => {
  W = await getWorld();
  T.intern07 = await login(emails.intern07);
  T.intern08 = await login(emails.intern08);
  T.hr = await login(emails.hr);
  T.admin = await login(emails.admin);
  try {
    const probe = await fetch(`${WEB_URL}/login`, { redirect: "manual" });
    serverUp = probe.status < 500;
  } catch {
    serverUp = false;
  }
});

function needServer(t) {
  if (!serverUp) {
    t.skip(`web server không chạy tại ${WEB_URL} — chạy "npx next start -p 3100" trước`);
    return false;
  }
  return true;
}

// --------------------------------------------------------------------------

test("AT-005/AT-049 POST /api/attendance/check chưa đăng nhập → 401", async (t) => {
  if (!needServer(t)) return;
  const r = await postCheck(null, {
    action: "CHECK_IN",
    latitude: 10.7626,
    longitude: 106.66,
    accuracy: 10,
  });
  assert.equal(r.status, 401, JSON.stringify(r.data));
  assert.equal(r.data?.error?.code, "AUTH_ERROR");
});

test("AT-005 Body thiếu tọa độ → 400 VALIDATION_ERROR", async (t) => {
  if (!needServer(t)) return;
  const r = await postCheck(sessionCookie(T.intern08), { action: "CHECK_IN", accuracy: 10 });
  assert.equal(r.status, 400, JSON.stringify(r.data));
  assert.equal(r.data?.error?.code, "VALIDATION_ERROR");
});

test("AT-014 Giả mạo user_id trong body → vẫn ghi cho phiên đăng nhập", async (t) => {
  if (!needServer(t)) return;
  // intern08 đăng nhập nhưng gửi user_id của intern07 + giờ check-in giả mạo
  const fakeTime = "2000-01-01T00:00:00.000Z";
  const r = await postCheck(sessionCookie(T.intern08), {
    action: "CHECK_IN",
    latitude: 10.7626,
    longitude: 106.66,
    accuracy: 10,
    user_id: W.users.intern07,
    p_user_id: W.users.intern07,
    check_in_at: fakeTime,
    checkInAt: fakeTime,
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.success, true, JSON.stringify(r.data));

  const row08 = (
    await svc(`/rest/v1/attendance?intern_id=eq.${W.interns["08"]}&work_date=eq.${todayVN()}&select=*`)
  ).data[0];
  assert.ok(row08, "bản ghi phải thuộc intern08 (phiên đăng nhập)");
  const row07 = (
    await svc(`/rest/v1/attendance?intern_id=eq.${W.interns["07"]}&work_date=eq.${todayVN()}&select=id`)
  ).data;
  assert.equal(row07.length, 0, "KHÔNG được tạo bản ghi cho intern07 bị giả mạo");

  // AT-020: thời gian client gửi bị bỏ qua — check_in_at = giờ server
  const serverMs = Date.now();
  assert.ok(
    Math.abs(new Date(row08.check_in_at).getTime() - serverMs) < 120000,
    `check_in_at=${row08.check_in_at} phải là giờ server, không phải ${fakeTime}`,
  );
});

test("AT-012 Check-in lần 2 qua API → 400 ALREADY_CHECKED_IN, không tạo bản mới", async (t) => {
  if (!needServer(t)) return;
  const r = await postCheck(sessionCookie(T.intern08), {
    action: "CHECK_IN",
    latitude: 10.7626,
    longitude: 106.66,
    accuracy: 10,
  });
  assert.equal(r.status, 400, JSON.stringify(r.data));
  assert.equal(r.data?.error?.code, "ALREADY_CHECKED_IN");
  const rows = (
    await svc(`/rest/v1/attendance?intern_id=eq.${W.interns["08"]}&work_date=eq.${todayVN()}&select=id`)
  ).data;
  assert.equal(rows.length, 1, "vẫn chỉ 1 bản ghi");
});

test("AT-015 Bypass giao diện: gọi API trực tiếp ngoài bán kính → vẫn bị backend từ chối", async (t) => {
  if (!needServer(t)) return;
  const r = await postCheck(sessionCookie(T.intern08), {
    action: "CHECK_OUT",
    latitude: 10.7826, // ~2.7km — ngoài vị trí
    longitude: 106.68,
    accuracy: 10,
  });
  assert.equal(r.status, 400, JSON.stringify(r.data));
  assert.equal(r.data?.error?.code, "LOCATION_OUT_OF_RANGE");
});

test("AT-015b Nhân viên HR gọi API điểm danh → 403 (phân quyền ở backend)", async (t) => {
  if (!needServer(t)) return;
  const r = await postCheck(sessionCookie(T.hr), {
    action: "CHECK_IN",
    latitude: 10.7626,
    longitude: 106.66,
    accuracy: 10,
  });
  assert.equal(r.status, 403, JSON.stringify(r.data));
  assert.equal(r.data?.error?.code, "PERMISSION_DENIED");
});

test("AT-066 Chưa đăng nhập vào /attendance → redirect /login", async (t) => {
  if (!needServer(t)) return;
  const res = await fetch(`${WEB_URL}/attendance`, { redirect: "manual" });
  assert.ok([301, 302, 307, 308].includes(res.status), `status=${res.status}`);
  assert.match(res.headers.get("location") || "", /\/login/, "redirect về trang đăng nhập");
});

test("AT-067 Trang /attendance render khi đã đăng nhập (intern)", async (t) => {
  if (!needServer(t)) return;
  const res = await fetch(`${WEB_URL}/attendance`, {
    headers: { Cookie: sessionCookie(T.intern07) },
    redirect: "manual",
  });
  assert.equal(res.status, 200, `status=${res.status}`);
  const html = await res.text();
  assert.ok(html.length > 3000, "trang phải render đủ nội dung");
  assert.ok(!html.includes("Application error"), "không có lỗi ứng dụng SSR");
});

test("AT-068 Trang /admin/attendance render khi đăng nhập bằng Admin", async (t) => {
  if (!needServer(t)) return;
  const res = await fetch(`${WEB_URL}/admin/attendance`, {
    headers: { Cookie: sessionCookie(T.admin) },
    redirect: "manual",
  });
  assert.equal(res.status, 200, `status=${res.status}`);
  const html = await res.text();
  assert.ok(html.length > 3000, "trang phải render đủ nội dung");
  assert.ok(!html.includes("Application error"));
});

test("Bảo vệ trang admin: chưa đăng nhập vào /admin/attendance → không render dữ liệu", async (t) => {
  if (!needServer(t)) return;
  const res = await fetch(`${WEB_URL}/admin/attendance`, { redirect: "manual" });
  assert.ok(
    [301, 302, 307, 308, 401, 403].includes(res.status),
    `phải redirect hoặc chặn khi chưa đăng nhập, nhận status=${res.status}`,
  );
});

test("RG-006 Smoke trang khác sau thay đổi: /dashboard, /requests", async (t) => {
  if (!needServer(t)) return;
  for (const p of ["/dashboard", "/requests"]) {
    const res = await fetch(`${WEB_URL}${p}`, {
      headers: { Cookie: sessionCookie(T.admin) },
      redirect: "manual",
    });
    assert.equal(res.status, 200, `${p} phải render 200 (nhận ${res.status})`);
  }
});
