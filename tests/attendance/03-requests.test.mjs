// ==========================================================================
// 03-requests.test.mjs — Nhóm 3: Yêu cầu điều chỉnh điểm danh.
// Chạy thật `create_request` / `review_request` bằng JWT từng role,
// đối chiếu trạng thái DB + log + ảnh hưởng tới bảng attendance.
// ==========================================================================
import assert from "node:assert/strict";
import { before, test } from "node:test";

import {
  ANON_KEY,
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
  vnIso,
} from "./helpers.mjs";

let W;
const T = {};
let REQ_ADJ_MAIN; // đơn điều chỉnh chính (AT-025 → AT-037 → AT-038)

async function createRequest(internKey, args, token) {
  return rpc(
    "create_request",
    {
      p_request_type: "late",
      p_title: `${PREFIX} Don test`,
      p_reason: `${PREFIX} ly do duoc tao boi test tu dong`,
      p_start_date: todayVN(-6),
      p_end_date: todayVN(-6),
      p_start_time: null,
      p_end_time: null,
      p_payload: {},
      p_description: null,
      p_attachment_paths: [],
      ...args,
    },
    token,
  );
}

async function requestRow(id) {
  const r = await svc(`/rest/v1/requests?id=eq.${id}&select=*`);
  return r.data[0];
}

before(async () => {
  W = await getWorld();
  T.intern01 = await login(emails.intern01);
  T.intern02 = await login(emails.intern02);
  T.intern06 = await login(emails.intern06);
  T.mentor1 = await login(emails.mentor1);
  T.hr = await login(emails.hr);

  // Trạng thái sạch: xóa mọi đơn của intern test (kèm log + attachment)
  const internIds = Object.values(W.interns).join(",");
  const reqs = await svc(`/rest/v1/requests?intern_id=in.(${internIds})&select=id`);
  const reqIds = (reqs.data || []).map((r) => r.id);
  if (reqIds.length) {
    const list = reqIds.join(",");
    await svc(`/rest/v1/request_approval_logs?request_id=in.(${list})`, { method: "DELETE" });
    await svc(`/rest/v1/request_attachments?request_id=in.(${list})`, { method: "DELETE" });
    await svc(`/rest/v1/requests?id=in.(${list})`, { method: "DELETE" });
  }
});

// --------------------------------------------------------------------------

test("AT-025 Intern gửi yêu cầu điều chỉnh hợp lệ → đơn pending", async () => {
  const r = await createRequest(
    "intern01",
    {
      p_request_type: "attendance_adjustment",
      p_title: "Dieu chinh chieu nay",
      p_reason: "Quen check-in vi GPS bi loi",
      p_start_date: todayVN(),
      p_end_date: todayVN(),
      p_payload: {
        proposed_check_in: vnIso(0, 9, 0),
        proposed_check_out: vnIso(0, 17, 30),
      },
    },
    T.intern01,
  );
  assert.equal(r.data?.success, true, JSON.stringify(r.data));
  assert.ok(r.data.request_code, "phải có request_code");
  REQ_ADJ_MAIN = r.data.request_id;
  const row = await requestRow(REQ_ADJ_MAIN);
  assert.equal(row.status, "pending");
  assert.equal(row.intern_id, W.interns["01"]);
  assert.equal(row.request_type, "attendance_adjustment");
});

test("AT-026 Tạo đơn thiếu lý do → VALIDATION_ERROR, không tạo đơn", async () => {
  const before = (await svc(`/rest/v1/requests?intern_id=eq.${W.interns["01"]}&select=id`)).data.length;
  const r = await createRequest("intern01", { p_reason: "ab" }, T.intern01);
  assert.equal(r.data?.success, false);
  assert.equal(r.data?.code, "VALIDATION_ERROR");
  const after = (await svc(`/rest/v1/requests?intern_id=eq.${W.interns["01"]}&select=id`)).data.length;
  assert.equal(after, before, "không tạo đơn");
});

test("AT-027 Tạo đơn thiếu ngày áp dụng → DATE_REQUIRED", async () => {
  const r = await createRequest(
    "intern01",
    { p_request_type: "attendance_adjustment", p_start_date: null, p_end_date: null, p_payload: { proposed_check_in: vnIso(0, 9, 0) } },
    T.intern01,
  );
  assert.equal(r.data?.success, false);
  assert.equal(r.data?.code, "DATE_REQUIRED");
});

test("AT-028 Đơn điều chỉnh thiếu giờ đề xuất → VALIDATION_ERROR", async () => {
  const r = await createRequest(
    "intern01",
    { p_request_type: "attendance_adjustment", p_start_date: todayVN(), p_end_date: todayVN(), p_payload: {} },
    T.intern01,
  );
  assert.equal(r.data?.success, false);
  assert.equal(r.data?.code, "VALIDATION_ERROR");
});

test("AT-029 Đính kèm hợp lệ → upload OK + bản ghi request_attachments", async () => {
  const uniq = Date.now();
  const path = `${W.users.intern01}/qa-request-attach-${uniq}.pdf`;
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/request-attachments/${path}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${T.intern01}`,
      "Content-Type": "application/pdf",
      "x-upsert": "true",
    },
    body: "%PDF-1.4 QA attachment",
  });
  assert.ok(up.ok, `upload phải thành công: ${up.status} ${await up.text()}`);
  W.uploads = [...(W.uploads || []), path];
  saveWorld(W);

  const r = await createRequest(
    "intern01",
    {
      p_request_type: "attendance_adjustment",
      p_title: "Don co dinh kem",
      p_start_date: todayVN(-2),
      p_end_date: todayVN(-2),
      p_payload: { proposed_check_in: vnIso(-2, 9, 0) },
      p_attachment_paths: [path],
    },
    T.intern01,
  );
  assert.equal(r.data?.success, true, JSON.stringify(r.data));
  const atts = await svc(
    `/rest/v1/request_attachments?request_id=eq.${r.data.request_id}&select=file_path`,
  );
  assert.equal(atts.data.length, 1, "phải có 1 bản ghi đính kèm");
  assert.equal(atts.data[0].file_path, path);
});

test("AT-030 Upload file không được hỗ trợ (.exe) → bị Storage từ chối", async () => {
  const path = `${W.users.intern01}/qa-malware.exe`;
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/request-attachments/${path}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${T.intern01}`,
      "Content-Type": "application/x-msdownload",
      "x-upsert": "true",
    },
    body: "MZ fake-binary",
  });
  assert.ok(!up.ok, `file .exe phải bị từ chối, nhận ${up.status}`);
  if (up.ok) {
    W.uploads = [...(W.uploads || []), path];
    saveWorld(W);
  }
});

test("AT-031 Mentor phê duyệt đơn trong phạm vi → approved", async () => {
  const created = await createRequest("intern01", { p_start_date: todayVN(-6), p_end_date: todayVN(-6) }, T.intern01);
  assert.equal(created.data?.success, true, JSON.stringify(created.data));
  const id = created.data.request_id;

  const r = await rpc("review_request", { p_request_id: id, p_action: "approve", p_comment: "Duyet OK" }, T.mentor1);
  assert.equal(r.data?.success, true, JSON.stringify(r.data));
  assert.equal(r.data?.status, "approved");
  const row = await requestRow(id);
  assert.equal(row.status, "approved");
  assert.equal(row.reviewer_id, W.users.mentor1);
});

test("AT-032 Mentor xử lý đơn của intern ngoài phạm vi → PERMISSION_DENIED", async () => {
  const created = await createRequest("intern06", { p_start_date: todayVN(-6), p_end_date: todayVN(-6) }, T.intern06);
  assert.equal(created.data?.success, true, JSON.stringify(created.data));
  const id = created.data.request_id;

  const r = await rpc("review_request", { p_request_id: id, p_action: "approve", p_comment: "Duyet sai pham vi" }, T.mentor1);
  assert.equal(r.data?.success, false, JSON.stringify(r.data));
  assert.equal(r.data?.code, "PERMISSION_DENIED");
  assert.equal((await requestRow(id)).status, "pending", "đơn vẫn pending");
});

test("AT-033 Mentor KHÔNG được duyệt đơn điều chỉnh chấm công", async () => {
  const created = await createRequest(
    "intern01",
    {
      p_request_type: "attendance_adjustment",
      p_title: "Don dieu chinh mentor khong duyet duoc",
      p_start_date: todayVN(-7),
      p_end_date: todayVN(-7),
      p_payload: { proposed_check_in: vnIso(-7, 9, 0) },
    },
    T.intern01,
  );
  assert.equal(created.data?.success, true, JSON.stringify(created.data));
  const id = created.data.request_id;

  const r = await rpc("review_request", { p_request_id: id, p_action: "approve" }, T.mentor1);
  assert.equal(r.data?.success, false);
  assert.equal(r.data?.code, "PERMISSION_DENIED");
  assert.match(r.data?.message ?? "", /HR\/Admin/, "thông báo phải nêu rõ HR/Admin xử lý");
  assert.equal((await requestRow(id)).status, "pending");
});

test("AT-035 HR từ chối thiếu lý do → COMMENT_REQUIRED", async () => {
  const created = await createRequest("intern01", { p_start_date: todayVN(-8), p_end_date: todayVN(-8) }, T.intern01);
  const id = created.data.request_id;
  const r = await rpc("review_request", { p_request_id: id, p_action: "reject", p_comment: "ab" }, T.hr);
  assert.equal(r.data?.success, false);
  assert.equal(r.data?.code, "COMMENT_REQUIRED");
  assert.equal((await requestRow(id)).status, "pending");
});

test("AT-034 HR từ chối yêu cầu → rejected + lưu lý do từ chối", async () => {
  const created = await createRequest("intern01", { p_start_date: todayVN(-9), p_end_date: todayVN(-9) }, T.intern01);
  const id = created.data.request_id;
  const comment = `${PREFIX} ly do tu choi hop le`;
  const r = await rpc("review_request", { p_request_id: id, p_action: "reject", p_comment: comment }, T.hr);
  assert.equal(r.data?.success, true, JSON.stringify(r.data));
  const row = await requestRow(id);
  assert.equal(row.status, "rejected");
  assert.equal(row.rejection_reason, comment.trim());
});

test("AT-036 Intern tự xử lý đơn của mình → SELF_REVIEW", async () => {
  const created = await createRequest("intern01", { p_start_date: todayVN(-10), p_end_date: todayVN(-10) }, T.intern01);
  const id = created.data.request_id;
  const r = await rpc("review_request", { p_request_id: id, p_action: "approve" }, T.intern01);
  assert.equal(r.data?.success, false);
  assert.equal(r.data?.code, "SELF_REVIEW");
  assert.equal((await requestRow(id)).status, "pending");
});

test("AT-037 Intern tự sửa trạng thái đơn trực tiếp qua REST → không ảnh hưởng được", async () => {
  assert.ok(REQ_ADJ_MAIN, "AT-025 phải chạy trước");
  const before = await requestRow(REQ_ADJ_MAIN);
  const r = await userApi(T.intern01, `/rest/v1/requests?id=eq.${REQ_ADJ_MAIN}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "approved" }),
  });
  const after = await requestRow(REQ_ADJ_MAIN);
  assert.equal(
    after.status,
    before.status,
    `status không được đổi qua REST (HTTP ${r.status})`,
  );
  assert.notEqual(after.status, "approved", "intern không được tự duyệt");
});

test("AT-038 HR duyệt đơn điều chỉnh → cập nhật đúng bản ghi attendance", async () => {
  assert.ok(REQ_ADJ_MAIN);
  const rowBefore = (
    await svc(`/rest/v1/attendance?intern_id=eq.${W.interns["01"]}&work_date=eq.${todayVN()}&select=*`)
  ).data[0];
  assert.ok(rowBefore, "cần bản ghi attendance hôm nay (test 01-checkin đã tạo)");

  const r = await rpc(
    "review_request",
    { p_request_id: REQ_ADJ_MAIN, p_action: "approve", p_comment: "Duyet dieu chinh" },
    T.hr,
  );
  assert.equal(r.data?.success, true, JSON.stringify(r.data));
  assert.equal(r.data?.status, "approved");

  const rowAfter = (
    await svc(`/rest/v1/attendance?intern_id=eq.${W.interns["01"]}&work_date=eq.${todayVN()}&select=*`)
  ).data[0];
  const expectedIn = new Date(vnIso(0, 9, 0)).getTime();
  const expectedOut = new Date(vnIso(0, 17, 30)).getTime();
  assert.equal(
    new Date(rowAfter.check_in_at).getTime(),
    expectedIn,
    `check_in_at phải = giờ đề xuất 09:00 (nhận ${rowAfter.check_in_at})`,
  );
  assert.equal(new Date(rowAfter.check_out_at).getTime(), expectedOut, "check_out_at = 17:30 đề xuất");
  const reqCode = (await requestRow(REQ_ADJ_MAIN)).request_code;
  assert.match(rowAfter.note ?? "", new RegExp(reqCode.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")), "note chứa mã đơn");
});

test("AT-039 Duyệt đơn cho ngày chưa có bản ghi → tạo mới attendance", async () => {
  const created = await createRequest(
    "intern01",
    {
      p_request_type: "attendance_adjustment",
      p_title: "Dieu chinh ngay chua co ban ghi",
      p_start_date: todayVN(2),
      p_end_date: todayVN(2),
      p_payload: { proposed_check_in: vnIso(2, 9, 15) },
    },
    T.intern01,
  );
  assert.equal(created.data?.success, true, JSON.stringify(created.data));
  const id = created.data.request_id;

  const r = await rpc("review_request", { p_request_id: id, p_action: "approve" }, T.hr);
  assert.equal(r.data?.success, true, JSON.stringify(r.data));

  const row = (
    await svc(`/rest/v1/attendance?intern_id=eq.${W.interns["01"]}&work_date=eq.${todayVN(2)}&select=*`)
  ).data[0];
  assert.ok(row, "phải tạo mới bản ghi cho ngày chưa có");
  assert.equal(new Date(row.check_in_at).getTime(), new Date(vnIso(2, 9, 15)).getTime());
  assert.equal(row.is_geo_validated, false, "dữ liệu điều chỉnh không phải GPS thật");
  assert.equal(row.status, "present");
});

test("AT-040 Duyệt đơn → log phê duyệt + log ADJUST đồng bộ", async () => {
  assert.ok(REQ_ADJ_MAIN);
  const logs = await svc(
    `/rest/v1/request_approval_logs?request_id=eq.${REQ_ADJ_MAIN}&action=eq.approve&select=id,previous_status,new_status`,
  );
  assert.equal(logs.data.length, 1, "phải có log approve");
  assert.equal(logs.data[0].new_status, "approved");

  const attRow = (
    await svc(`/rest/v1/attendance?intern_id=eq.${W.interns["01"]}&work_date=eq.${todayVN()}&select=id`)
  ).data[0];
  const adjLogs = await svc(
    `/rest/v1/attendance_verification_logs?attendance_id=eq.${attRow.id}&action=eq.ADJUST&select=id`,
  );
  assert.ok(adjLogs.data.length >= 1, "phải có log ADJUST trong attendance_verification_logs");
});

test("AT-041 Hai người duyệt cùng lúc → chỉ 1 thành công, trạng thái nhất quán", async () => {
  const created = await createRequest("intern01", { p_start_date: todayVN(-11), p_end_date: todayVN(-11) }, T.intern01);
  const id = created.data.request_id;

  const [a, b] = await Promise.all([
    rpc("review_request", { p_request_id: id, p_action: "approve" }, T.hr),
    rpc("review_request", { p_request_id: id, p_action: "approve" }, T.hr),
  ]);
  const successes = [a, b].filter((x) => x.data?.success === true);
  assert.equal(successes.length, 1, `đúng 1 lần duyệt thành công — A=${JSON.stringify(a.data)} B=${JSON.stringify(b.data)}`);
  const failed = [a, b].find((x) => x.data?.success !== true);
  assert.equal(failed.data?.code, "INVALID_STATE", JSON.stringify(failed.data));
  assert.equal((await requestRow(id)).status, "approved", "trạng thái cuối = approved, không mâu thuẫn");
});

test("AT-042 Từ chối đơn → dữ liệu điểm danh không đổi", async () => {
  const snapshot = (
    await svc(`/rest/v1/attendance?intern_id=eq.${W.interns["02"]}&work_date=eq.${todayVN(-3)}&select=*`)
  ).data[0];
  assert.ok(snapshot, "intern02 cần bản ghi điểm danh có sẵn");

  const created = await createRequest(
    "intern02",
    {
      p_request_type: "attendance_adjustment",
      p_title: "Dieu chinh bi tu choi",
      p_start_date: todayVN(-3),
      p_end_date: todayVN(-3),
      p_payload: { proposed_check_in: vnIso(-3, 6, 0), proposed_check_out: vnIso(-3, 20, 0) },
    },
    T.intern02,
  );
  assert.equal(created.data?.success, true, JSON.stringify(created.data));
  const r = await rpc(
    "review_request",
    { p_request_id: created.data.request_id, p_action: "reject", p_comment: `${PREFIX} khong hop le` },
    T.hr,
  );
  assert.equal(r.data?.success, true, JSON.stringify(r.data));

  const after = (
    await svc(`/rest/v1/attendance?intern_id=eq.${W.interns["02"]}&work_date=eq.${todayVN(-3)}&select=*`)
  ).data[0];
  assert.deepEqual(
    { in: after.check_in_at, out: after.check_out_at, status: after.status, note: after.note },
    { in: snapshot.check_in_at, out: snapshot.check_out_at, status: snapshot.status, note: snapshot.note },
    "attendance không được thay đổi khi từ chối",
  );
});

test("AT-043 Hủy / yêu cầu bổ sung / gửi lại đơn đúng người", async () => {
  // a) Người khác không hủy được đơn của intern01
  const c1 = await createRequest("intern01", { p_start_date: todayVN(-12), p_end_date: todayVN(-12) }, T.intern01);
  const id1 = c1.data.request_id;
  const denied = await rpc("review_request", { p_request_id: id1, p_action: "cancel" }, T.intern06);
  assert.equal(denied.data?.success, false);
  assert.equal(denied.data?.code, "PERMISSION_DENIED");

  // b) Tác giả hủy được đơn của mình
  const cancel = await rpc("review_request", { p_request_id: id1, p_action: "cancel" }, T.intern01);
  assert.equal(cancel.data?.success, true, JSON.stringify(cancel.data));
  assert.equal((await requestRow(id1)).status, "cancelled");

  // c) HR yêu cầu bổ sung → intern gửi lại được
  const c2 = await createRequest("intern01", { p_start_date: todayVN(-13), p_end_date: todayVN(-13) }, T.intern01);
  const id2 = c2.data.request_id;
  const rev = await rpc(
    "review_request",
    { p_request_id: id2, p_action: "request_revision", p_comment: `${PREFIX} bo sung thong tin` },
    T.hr,
  );
  assert.equal(rev.data?.success, true, JSON.stringify(rev.data));
  assert.equal((await requestRow(id2)).status, "needs_revision");

  const resub = await rpc("review_request", { p_request_id: id2, p_action: "resubmit" }, T.intern01);
  assert.equal(resub.data?.success, true, JSON.stringify(resub.data));
  assert.equal((await requestRow(id2)).status, "pending");

  // d) Người khác không gửi lại được đơn không thuộc mình
  const resubDenied = await rpc("review_request", { p_request_id: id2, p_action: "resubmit" }, T.intern06);
  assert.equal(resubDenied.data?.success, false);
});
