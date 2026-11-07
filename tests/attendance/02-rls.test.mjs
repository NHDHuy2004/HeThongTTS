// ==========================================================================
// 02-rls.test.mjs — Nhóm 4: Phân quyền & RLS bằng JWT THẬT từng role.
// Không làm suy yếu RLS: mọi thao tác ghi đều thử đúng cách client gọi
// (PostgREST với JWT) và kỳ vọng bị chặn theo thiết kế.
// ==========================================================================
import assert from "node:assert/strict";
import { before, test } from "node:test";

import {
  ANON_KEY,
  PASSWORD,
  PREFIX,
  SUPABASE_URL,
  emails,
  getWorld,
  login,
  rpc,
  saveWorld,
  svc,
  todayVN,
  userApi,
} from "./helpers.mjs";

let W;
const T = {}; // token theo key

async function loginDirect(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const data = await res.json();
  assert.ok(res.ok, `đăng nhập ${email} phải thành công: ${JSON.stringify(data)}`);
  return data.access_token;
}

before(async () => {
  W = await getWorld();
  T.admin = await login(emails.admin);
  T.hr = await login(emails.hr);
  T.mentor1 = await login(emails.mentor1);
  T.mentor2 = await login(emails.mentor2);
  T.intern01 = await login(emails.intern01);
  T.intern02 = await login(emails.intern02);
  T.intern06 = await login(emails.intern06);
});

const MENTOR1_INTERNS = ["01", "02", "03", "04", "05"];
const MENTOR2_INTERNS = ["06", "07", "08", "09", "10"];

// --------------------------------------------------------------------------
test("RG-001 Đăng nhập 4 phân quyền qua GoTrue → nhận JWT", async () => {
  await loginDirect(emails.admin);
  await loginDirect(emails.hr);
  await loginDirect(emails.mentor1);
  await loginDirect(emails.intern01);
});

test("AT-044 Intern chỉ thấy điểm danh của chính mình", async () => {
  const r = await userApi(T.intern01, "/rest/v1/attendance?select=intern_id&limit=1000");
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(r.data.length > 0, "intern01 phải có dữ liệu điểm danh (đã seed)");
  const foreign = r.data.filter((x) => x.intern_id !== W.interns["01"]);
  assert.deepEqual(foreign, [], "không được thấy dòng của người khác");
});

test("AT-045 Mentor chỉ thấy intern được phân công", async () => {
  const r1 = await userApi(T.mentor1, "/rest/v1/attendance?select=intern_id&limit=1000");
  assert.ok(r1.data.length > 0);
  const allowed1 = new Set(MENTOR1_INTERNS.map((i) => W.interns[i]));
  assert.ok(
    r1.data.every((x) => allowed1.has(x.intern_id)),
    "mentor01 chỉ thấy intern 01-05",
  );
  assert.ok(
    !r1.data.some((x) => x.intern_id === W.interns["06"]),
    "mentor01 không được thấy intern06",
  );

  const r2 = await userApi(T.mentor2, "/rest/v1/attendance?select=intern_id&limit=1000");
  const allowed2 = new Set(MENTOR2_INTERNS.map((i) => W.interns[i]));
  assert.ok(r2.data.every((x) => allowed2.has(x.intern_id)), "mentor02 chỉ thấy intern 06-10");
  assert.ok(!r2.data.some((x) => x.intern_id === W.interns["01"]), "mentor02 không thấy intern01");
});

test("AT-046 HR/Admin thấy toàn bộ (nhiều intern, nhiều đợt thực tập)", async () => {
  for (const token of [T.hr, T.admin]) {
    const r = await userApi(token, "/rest/v1/attendance?select=intern_id&limit=1000");
    assert.ok(r.data.length > 0);
    const ids = new Set(r.data.map((x) => x.intern_id));
    assert.ok(ids.has(W.interns["01"]), "thấy intern đợt 1");
    assert.ok(ids.has(W.interns["06"]), "thấy intern đợt 2");
  }
});

test("AT-047 Chưa đăng nhập (anon) → không thấy dữ liệu điểm danh", async () => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance?select=id&limit=10`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  assert.equal(res.status, 200, "PostgREST trả 200 với 0 dòng (RLS lọc)");
  const data = await res.json();
  assert.deepEqual(data, [], "anon không được thấy dòng nào");
});

test("AT-048 Intern không tự nâng role của mình được", async () => {
  const r = await userApi(
    T.intern01,
    `/rest/v1/profiles?id=eq.${W.users.intern01}`,
    { method: "PATCH", body: JSON.stringify({ role_id: W.roles.admin }) },
  );
  // Kỳ vọng: RLS chặn (0 dòng cập nhật /403)
  const after = await svc(`/rest/v1/profiles?id=eq.${W.users.intern01}&select=role_id`);
  assert.notEqual(
    after.data[0].role_id,
    W.roles.admin,
    `intern không được đổi role (HTTP ${r.status})`,
  );
  const internRole = await svc(`/rest/v1/roles?id=eq.${after.data[0].role_id}&select=code`);
  assert.equal(internRole.data[0].code, "intern", "vai trò vẫn là intern");
});

test("AT-049 Gọi RPC attendance_check bằng JWT authenticated → bị chặn", async () => {
  const r = await rpc(
    "attendance_check",
    { p_user_id: W.users.intern01, p_action: "CHECK_IN", p_latitude: 10.7626, p_longitude: 106.66, p_accuracy: 10 },
    T.intern01,
  );
  assert.ok(
    [401, 403].includes(r.status),
    `mong đợi bị chặn (401/403), nhận ${r.status}: ${JSON.stringify(r.data)}`,
  );
});

test("AT-050 adjust_attendance bằng HR → hoạt động (BUG-ATT-001 nếu lỗi 42703)", async () => {
  const row = (
    await svc(`/rest/v1/attendance?intern_id=eq.${W.interns["01"]}&select=id&limit=1`)
  ).data[0];
  assert.ok(row, "cần có dữ liệu điểm danh để test");
  const r = await rpc(
    "adjust_attendance",
    {
      p_attendance_id: row.id,
      p_status: "late",
      p_note: `${PREFIX}QA adjust`,
      p_reason: `${PREFIX} ly do dieu chinh QA`,
    },
    T.hr,
  );
  assert.equal(
    r.data?.success,
    true,
    `BUG-ATT-001: adjust_attendance phải chạy được cho HR — nhận HTTP ${r.status}: ${JSON.stringify(r.data)}`,
  );
});

test("AT-051 adjust_attendance bằng Intern → PERMISSION_DENIED (không sửa được dữ liệu)", async () => {
  const row = (
    await svc(`/rest/v1/attendance?intern_id=eq.${W.interns["01"]}&select=id,status&limit=1`)
  ).data[0];
  const r = await rpc(
    "adjust_attendance",
    {
      p_attendance_id: row.id,
      p_status: "absent",
      p_note: "hack",
      p_reason: "intern cuop du lieu QA",
    },
    T.intern01,
  );
  // Kỳ vọng: trả về PERMISSION_DENIED (dù bị chặn thì cũng phải là mã lỗi nghiệp vụ)
  assert.equal(
    r.data?.code,
    "PERMISSION_DENIED",
    `BUG-ATT-001: mong đợi PERMISSION_DENIED, nhận HTTP ${r.status}: ${JSON.stringify(r.data)}`,
  );
  const after = await svc(`/rest/v1/attendance?id=eq.${row.id}&select=status`);
  assert.equal(after.data[0].status, row.status, "trạng thái không bị đổi");
});

test("AT-052 Ma trận RLS: intern/mentor không INSERT/UPDATE/DELETE attendance", async () => {
  const target = (
    await svc(`/rest/v1/attendance?intern_id=eq.${W.interns["01"]}&select=id&limit=1`)
  ).data[0];
  assert.ok(target);

  const ins = await userApi(T.intern01, "/rest/v1/attendance", {
    method: "POST",
    body: JSON.stringify({
      intern_id: W.interns["01"],
      internship_id: W.internships.intern01,
      work_date: todayVN(10),
      status: "present",
    }),
  });
  assert.ok([401, 403].includes(ins.status), `INSERT phải bị chặn, nhận ${ins.status}`);

  const upd = await userApi(T.intern01, `/rest/v1/attendance?id=eq.${target.id}`, {
    method: "PATCH",
    body: JSON.stringify({ note: "intern sua truc tiep" }),
  });
  // PostgREST trả 200 + [] khi RLS lọc hết dòng (không phải 403) — kiểm tra số dòng
  assert.ok(
    [401, 403].includes(upd.status) || (Array.isArray(upd.data) && upd.data.length === 0),
    `UPDATE phải bị RLS lọc (0 dòng), nhận HTTP ${upd.status}: ${JSON.stringify(upd.data)}`,
  );

  const del = await userApi(T.intern01, `/rest/v1/attendance?id=eq.${target.id}`, {
    method: "DELETE",
  });
  assert.ok(
    [401, 403].includes(del.status) || (Array.isArray(del.data) && del.data.length === 0),
    `DELETE phải bị RLS lọc (0 dòng), nhận HTTP ${del.status}: ${JSON.stringify(del.data)}`,
  );

  const delMentor = await userApi(T.mentor1, `/rest/v1/attendance?id=eq.${target.id}`, {
    method: "DELETE",
  });
  assert.ok(
    [401, 403].includes(delMentor.status) || (Array.isArray(delMentor.data) && delMentor.data.length === 0),
    `mentor DELETE phải bị RLS lọc (0 dòng), nhận HTTP ${delMentor.status}`,
  );

  const still = await svc(`/rest/v1/attendance?id=eq.${target.id}&select=id,note`);
  assert.equal(still.data.length, 1, "bản ghi phải còn nguyên vẹn");
  assert.notEqual(still.data[0].note, "intern sua truc tiep", "ghi chú intern không được lọt vào DB");
});

test("AT-053 HR/Admin DELETE attendance từ client → phải bị chặn (BUG-ATT-002 nếu xóa được)", async () => {
  // Tạo 1 dòng dùng một lần (dữ liệu TEST-QA-, ngày tương lai)
  const ins = await svc("/rest/v1/attendance", {
    method: "POST",
    body: JSON.stringify({
      intern_id: W.interns["01"],
      internship_id: W.internships.intern01,
      work_date: todayVN(5),
      status: "present",
      note: `${PREFIX} disposable delete probe`,
    }),
  });
  assert.equal(ins.status, 201, JSON.stringify(ins.data));
  const id = ins.data[0].id;

  const r = await userApi(T.hr, `/rest/v1/attendance?id=eq.${id}`, { method: "DELETE" });
  // Thiết kế (test_rls.sql L158-168): client KHÔNG được delete attendance
  const blocked =
    [401, 403].includes(r.status) || (r.status === 200 && Array.isArray(r.data) && r.data.length === 0);
  assert.ok(
    blocked,
    `BUG-ATT-002: HR bị chặn DELETE attendance từ client — nhận HTTP ${r.status}, xóa ${r.data?.length ?? "?"} dòng`,
  );

  // Nếu bị chặn thì dòng phải còn; nếu xóa được thì ghi nhận bug (dòng TEST-QA- đã mất — chấp nhận)
  const after = await svc(`/rest/v1/attendance?id=eq.${id}&select=id`);
  if (blocked) assert.equal(after.data.length, 1);
});

test("AT-054 Intern không đọc được log điểm danh người khác", async () => {
  const r = await userApi(T.intern01, "/rest/v1/attendance_verification_logs?select=user_id&limit=1000");
  assert.ok(r.data.length > 0, "intern01 phải thấy log của chính mình (từ các test check-in)");
  const foreign = r.data.filter((x) => x.user_id !== W.users.intern01);
  assert.deepEqual(foreign, [], "không được thấy log của người khác");

  const r2 = await userApi(T.intern02, "/rest/v1/attendance_verification_logs?select=user_id&limit=1000");
  assert.ok(r2.data.every((x) => x.user_id === W.users.intern02), "intern02 chỉ thấy log của mình");
});

test("AT-055 Địa điểm làm việc: intern đọc được, không ghi được", async () => {
  const read = await userApi(T.intern01, "/rest/v1/attendance_locations?select=id,code&limit=100");
  assert.equal(read.status, 200);
  assert.ok(read.data.length >= 3, "thấy ít nhất 3 địa điểm TEST-QA-");

  const upd = await userApi(
    T.intern01,
    `/rest/v1/attendance_locations?id=eq.${W.locs.main}`,
    { method: "PATCH", body: JSON.stringify({ radius_m: 999 }) },
  );
  const after = await svc(`/rest/v1/attendance_locations?id=eq.${W.locs.main}&select=radius_m`);
  assert.equal(
    Number(after.data[0].radius_m),
    100,
    `intern không được đổi bán kính (HTTP ${upd.status})`,
  );
});

test("AT-056 Storage: không đọc được file đính kèm của người khác", async () => {
  const uniq = Date.now();
  const path = `${W.users.intern01}/qa-attachment-${uniq}.pdf`;
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/request-attachments/${path}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${T.intern01}`,
      "Content-Type": "application/pdf",
      "x-upsert": "true",
    },
    body: "%PDF-1.4 QA test attachment",
  });
  assert.ok(up.ok, `upload bởi chủ sở hữu phải thành công — ${up.status}: ${await up.text()}`);
  W.uploads = [...(W.uploads || []), path];
  saveWorld(W);

  const owner = await fetch(`${SUPABASE_URL}/storage/v1/object/request-attachments/${path}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${T.intern01}` },
  });
  assert.ok(owner.ok, "chủ sở hữu phải đọc được file của mình");

  const other = await fetch(`${SUPABASE_URL}/storage/v1/object/request-attachments/${path}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${T.intern06}` },
  });
  assert.ok(!other.ok, `intern06 không được đọc file của intern01 (nhận ${other.status})`);
});

test("AT-057 Không giả mạo internship_id / intern_id khi gửi đơn", async () => {
  const r = await rpc(
    "create_request",
    {
      p_request_type: "late",
      p_title: `${PREFIX} Don kiem tra spoof`,
      p_reason: `${PREFIX} ly do kiem tra spoof`,
      p_start_date: todayVN(-3),
      p_end_date: todayVN(-3),
      p_start_time: null,
      p_end_time: null,
      p_payload: { internship_id: W.internships.intern06, intern_id: W.interns["06"] },
    },
    T.intern01,
  );
  assert.equal(r.data?.success, true, JSON.stringify(r.data));
  const reqId = r.data.request_id;
  const db = await svc(`/rest/v1/requests?id=eq.${reqId}&select=intern_id,internship_id,user_id`);
  assert.equal(db.data[0].internship_id, W.internships.intern01, "phải lấy internship của chính mình");
  assert.equal(db.data[0].intern_id, W.interns["01"], "phải lấy intern của chính mình");

  // Insert trực tiếp với intern_id giả mạo → phải bị RLS chặn
  const spoof = await userApi(T.intern01, "/rest/v1/requests", {
    method: "POST",
    body: JSON.stringify({
      request_code: `${PREFIX}SPOOF-01`,
      user_id: W.users.intern01,
      intern_id: W.interns["06"],
      internship_id: W.internships.intern06,
      request_type: "leave",
      title: `${PREFIX} spoof`,
      reason: `${PREFIX} spoof reason`,
      start_date: todayVN(-4),
      status: "pending",
    }),
  });
  assert.ok(
    [401, 403].includes(spoof.status),
    `insert trực tiếp requests phải bị chặn, nhận ${spoof.status}`,
  );
});
