// ==========================================================================
// 05-perf.test.mjs — Nhóm 7: Hiệu năng & race condition.
// Đo trên môi trường thực (Supabase remote) với ~500 dòng TEST-QA-.
// ==========================================================================
import assert from "node:assert/strict";
import { before, test } from "node:test";

import { emails, getWorld, login, rpc, svc, todayVN, userApi } from "./helpers.mjs";

let W;
const T = {};

before(async () => {
  W = await getWorld();
  T.hr = await login(emails.hr);
  // Đảm bảo intern06 "sạch" hôm nay cho AT-077 (idempotent mọi lần chạy)
  await svc(
    `/rest/v1/attendance?intern_id=eq.${W.interns["06"]}&work_date=eq.${todayVN()}`,
    { method: "DELETE" },
  );
});

test("AT-074 Danh sách ~500 dòng: tải 50 dòng đầu < 1000ms", async () => {
  // Chắc chắn đủ dữ liệu (500 dòng seed + dữ liệu phát sinh)
  const count = await svc("/rest/v1/attendance?select=id&limit=1");
  assert.ok(count.ok);

  // Đo 3 lần lấy min (loại cold-start/cold-connection của remote) — ghi lại
  // cả 3 lần trong log test để thấy độ đều đặn.
  const times = [];
  let r;
  for (let i = 0; i < 3; i += 1) {
    const t0 = Date.now();
    r = await userApi(
      T.hr,
      "/rest/v1/attendance?select=id,intern_id,work_date,status&limit=50",
      { headers: { Prefer: "count=exact" } },
    );
    times.push(Date.now() - t0);
  }
  const ms = Math.min(...times);
  console.log(`AT-074 times=${times.join(",")}ms`);
  // PostgREST trả 206 khi có limit (Range) — chấp nhận 200/206
  assert.ok([200, 206].includes(r.status), `status=${r.status}`);
  assert.equal(r.data.length, 50);
  assert.ok(ms < 1000, `min time = ${ms}ms among ${times.join("/")} (kỳ vọng < 1000ms)`);
});

test("AT-075 Phân trang ở phía Database: content-range = tổng dòng thật", async () => {
  const page = await userApi(
    T.hr,
    "/rest/v1/attendance?select=id&limit=50&offset=100",
    { headers: { Prefer: "count=exact" } },
  );
  const [range, total] = (page.headers["content-range"] || "").split("/");
  assert.equal(range, "100-149", `content-range=${page.headers["content-range"]}`);
  const exact = await svc("/rest/v1/attendance?select=id&limit=1", {
    headers: { Prefer: "count=exact" },
  });
  assert.equal(Number(total), Number(exact.headers["content-range"].split("/")[1]));
  assert.ok(Number(total) >= 500, `tổng dòng TEST-QA- phải ≥ 500 (nhận ${total})`);
});

test("AT-076 Không N+1: 1 request REST lấy đủ danh sách kèm tên intern (join sẵn)", async () => {
  const t0 = Date.now();
  const r = await userApi(
    T.hr,
    "/rest/v1/attendance?select=id,status,work_date,intern_id,interns(full_name)&limit=50",
  );
  const ms = Date.now() - t0;
  assert.equal(r.status, 200);
  assert.equal(r.data.length, 50);
  // Mỗi dòng đã kèm thông tin intern — client KHÔNG cần thêm 1 request/intern
  const missing = r.data.filter((x) => !x.interns || !x.interns.full_name);
  assert.deepEqual(missing, [], "mọi dòng phải có sẵn tên intern trong cùng 1 request");
  assert.ok(ms < 1500, `1 request join = ${ms}ms`);
});

test("AT-077 Race condition: 2 check-in đồng thời → chỉ 1 thành công, 1 bản ghi", async () => {
  // intern06 chưa có bản ghi hôm nay (01-checkin chỉ thử CHECK_OUT và bị từ chối)
  const beforeRows = await svc(
    `/rest/v1/attendance?intern_id=eq.${W.interns["06"]}&work_date=eq.${todayVN()}&select=id`,
  );
  assert.equal(beforeRows.data.length, 0, "intern06 phải sạch trước khi test race");

  const call = () =>
    rpc("attendance_check", {
      p_user_id: W.users.intern06,
      p_action: "CHECK_IN",
      p_latitude: 10.7626,
      p_longitude: 106.66,
      p_accuracy: 10,
    });
  const [a, b] = await Promise.all([call(), call()]);
  const successes = [a, b].filter((x) => x.data?.success === true);
  const rejected = [a, b].filter((x) => x.data?.success !== true);

  assert.equal(successes.length, 1, `đúng 1 lần check-in thành công — A=${JSON.stringify(a.data)} B=${JSON.stringify(b.data)}`);
  assert.equal(rejected.length, 1);
  assert.equal(
    rejected[0].data?.code,
    "ALREADY_CHECKED_IN",
    `lần thứ 2 phải bị chặn, nhận ${JSON.stringify(rejected[0].data)}`,
  );

  const after = await svc(
    `/rest/v1/attendance?intern_id=eq.${W.interns["06"]}&work_date=eq.${todayVN()}&select=id`,
  );
  assert.equal(after.data.length, 1, "chỉ tồn tại đúng 1 bản ghi");
});
