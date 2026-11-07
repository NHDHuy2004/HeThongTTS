// ==========================================================================
// helpers.mjs — dùng chung cho test suite Attendance (node:test, zero-dep).
//   * Nạp credentials từ web-admin/.env.local (không hardcode secret).
//   * Tạo/dọn dữ liệu test theo tiền tố TEST-QA- bằng service role.
//   * Đăng nhập JWT thật từng role qua GoTrue để test RLS.
//   * KHÔNG đụng dữ liệu có sẵn; KHÔNG làm suy yếu RLS.
// ==========================================================================
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const WORLD_PATH = path.join(HERE, ".world.json");

export const PREFIX = "TEST-QA-";
export const PASSWORD = "Test@1234";

// --------------------------------------------------------------------------
// Credentials
// --------------------------------------------------------------------------
function loadEnv() {
  const file = path.join(ROOT, "web-admin", ".env.local");
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = loadEnv();
export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
export const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
export const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
export const WEB_URL = process.env.WEB_URL || "http://localhost:3100";

// --------------------------------------------------------------------------
// HTTP helpers
// --------------------------------------------------------------------------
async function parse(res) {
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return {
    status: res.status,
    ok: res.ok,
    data,
    headers: Object.fromEntries(res.headers.entries()),
  };
}

/** Gọi Supabase (REST/Storage/Auth) bằng SERVICE ROLE — bypass RLS, chỉ để seed/dọn. */
export async function svc(pathAndQuery, init = {}) {
  const res = await fetch(SUPABASE_URL + pathAndQuery, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  return parse(res);
}

/** Gọi Supabase bằng JWT người dùng (apikey anon + bearer user) — thử RLS thật. */
export async function userApi(token, pathAndQuery, init = {}) {
  const res = await fetch(SUPABASE_URL + pathAndQuery, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  return parse(res);
}

/** Gọi RPC: token=null → service role (attendance_check chỉ grant service_role). */
export async function rpc(name, body, token = null) {
  const p = `/rest/v1/rpc/${name}`;
  const init = { method: "POST", body: JSON.stringify(body) };
  return token ? userApi(token, p, init) : svc(p, init);
}

/** Đăng nhập qua GoTrue password grant → access_token (JWT). Retry khi 429. */
const tokenCache = new Map();
export async function login(email, password = PASSWORD) {
  if (tokenCache.has(email)) return tokenCache.get(email);
  let lastError = null;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      tokenCache.set(email, data.access_token);
      return data.access_token;
    }
    lastError = new Error(`login failed ${email}: ${JSON.stringify(data)}`);
    if (res.status !== 429 && res.status < 500) break;
    // Backoff về rate-limit (Supabase remote limit thấp khi chạy suite)
    await new Promise((resolve) => setTimeout(resolve, 500 + attempt * 400));
  }
  throw lastError;
}

/** Tạo (hoặc lấy lại) user qua Admin API — trigger handle_new_user tự tạo profile. */
export async function ensureUser(email) {
  const created = await svc("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  if (created.ok) return created.data.id;
  const listed = await svc("/auth/v1/admin/users?page=1&per_page=200");
  const found = (listed.data?.users || []).find((u) => u.email === email);
  if (!found) throw new Error(`cannot create/find user ${email}: ${JSON.stringify(created.data)}`);
  return found.id;
}

/** Danh sách auth user test (email tiền tố TEST-QA-). */
export async function listTestUserIds() {
  const ids = [];
  for (let page = 1; page <= 10; page += 1) {
    const listed = await svc(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const users = listed.data?.users || [];
    for (const u of users) if (u.email?.startsWith(PREFIX.toLowerCase()) || u.email?.startsWith(PREFIX)) ids.push(u.id);
    if (users.length < 200) break;
  }
  return ids;
}

// --------------------------------------------------------------------------
// Thời gian theo VN (khớp cách RPC tính work_date — 0016 L260-261)
// --------------------------------------------------------------------------
export function todayVN(offsetDays = 0) {
  const t = new Date(Date.now() + offsetDays * 86400000 + 7 * 3600 * 1000);
  return t.toISOString().slice(0, 10);
}

export function vnClock() {
  // HH:MM theo giờ VN
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(11, 16);
}

// --------------------------------------------------------------------------
// World (seed dữ liệu test)
// --------------------------------------------------------------------------
const USER_SPECS = [
  ["admin", `${PREFIX}admin@qa.ims.local`, "admin"],
  ["hr", `${PREFIX}hr@qa.ims.local`, "hr"],
  ["mentor1", `${PREFIX}mentor1@qa.ims.local`, "mentor"],
  ["mentor2", `${PREFIX}mentor2@qa.ims.local`, "mentor"],
  ...Array.from({ length: 10 }, (_, i) => [
    `intern${String(i + 1).padStart(2, "0")}`,
    `${PREFIX}intern${String(i + 1).padStart(2, "0")}@qa.ims.local`,
    "intern",
  ]),
];

export const emails = Object.fromEntries(USER_SPECS.map(([k, e]) => [k, e]));

export function vnIso(daysOffset, hour, minute) {
  // Thời gian ISO có offset +07:00 (múi giờ VN)
  const d = new Date(Date.now() + daysOffset * 86400000);
  const vn = new Date(d.getTime() + 7 * 3600 * 1000);
  const date = vn.toISOString().slice(0, 10);
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+07:00`;
}

async function fetchOrCreateByCode(table, codeField, code) {
  const q = await svc(`/rest/v1/${table}?${codeField}=eq.${encodeURIComponent(code)}&select=*`);
  if (q.ok && q.data?.length) return q.data[0];
  return null;
}

/** Đảm bảo 1 dòng tồn tại theo mã (fetch nếu có, insert nếu thiếu). */
async function ensureRow(table, codeField, code, payload) {
  const found = await fetchOrCreateByCode(table, codeField, code);
  if (found) return found;
  const r = await svc(`/rest/v1/${table}`, { method: "POST", body: JSON.stringify(payload) });
  if (!r.ok || !r.data?.[0]) {
    throw new Error(`ensureRow ${table}/${code} failed: ${JSON.stringify(r.data)}`);
  }
  return r.data[0];
}

async function seedWorld() {
  // 0) Dọn tàn dư lần chạy trước (chỉ dữ liệu TEST-QA-)
  await purgeTestData();

  // 1) roles
  const rolesRes = await svc("/rest/v1/roles?select=id,code");
  const roles = Object.fromEntries(rolesRes.data.map((r) => [r.code, r.id]));

  // 2) users + role
  const users = {};
  for (const [key, email] of USER_SPECS) {
    users[key] = await ensureUser(email);
  }
  for (const [key, , role] of USER_SPECS) {
    const r = await svc(`/rest/v1/profiles?id=eq.${users[key]}`, {
      method: "PATCH",
      body: JSON.stringify({ role_id: roles[role] }),
    });
    if (!r.ok) throw new Error(`set role ${key} failed: ${JSON.stringify(r.data)}`);
  }

  // 3) departments
  const depA = await ensureRow("departments", "code", `${PREFIX}DEP-A`, {
    name: `${PREFIX}Phong A`,
    code: `${PREFIX}DEP-A`,
  });
  const depB = await ensureRow("departments", "code", `${PREFIX}DEP-B`, {
    name: `${PREFIX}Phong B`,
    code: `${PREFIX}DEP-B`,
  });

  // 4) batches
  const batch1 = await ensureRow("internship_batches", "code", `${PREFIX}BATCH-1`, {
    name: `${PREFIX}Dot 1`,
    code: `${PREFIX}BATCH-1`,
    start_date: todayVN(-40),
    end_date: todayVN(50),
  });
  const batch2 = await ensureRow("internship_batches", "code", `${PREFIX}BATCH-2`, {
    name: `${PREFIX}Dot 2`,
    code: `${PREFIX}BATCH-2`,
    start_date: todayVN(-30),
    end_date: todayVN(60),
  });

  // 5) interns (10)
  const interns = {};
  const internRows = [];
  for (let i = 1; i <= 10; i += 1) {
    const key = `intern${String(i).padStart(2, "0")}`;
    internRows.push({
      student_code: `${PREFIX}SV${String(i).padStart(2, "0")}`,
      full_name: `${PREFIX} Intern ${String(i).padStart(2, "0")}`,
      email: emails[key],
      user_id: users[key],
      status: "active",
    });
  }
  {
    const existing = await svc(`/rest/v1/interns?student_code=like.${PREFIX}*&select=id,student_code`);
    const have = new Set(existing.data.map((r) => r.student_code));
    const missing = internRows.filter((r) => !have.has(r.student_code));
    if (missing.length) {
      await svc("/rest/v1/interns", { method: "POST", body: JSON.stringify(missing) });
    }
    const all = await svc(`/rest/v1/interns?student_code=like.${PREFIX}*&select=id,student_code`);
    for (const r of all.data) interns[r.student_code.slice(-2)] = r.id;
  }

  // 6) mentors (2)
  const mentors = {};
  {
    const specs = [
      { key: "m1", code: `${PREFIX}MEN-01`, email: emails.mentor1, name: `${PREFIX} Mentor 01`, dep: depA.id },
      { key: "m2", code: `${PREFIX}MEN-02`, email: emails.mentor2, name: `${PREFIX} Mentor 02`, dep: depB.id },
    ];
    for (const s of specs) {
      const found = await fetchOrCreateByCode("mentors", "employee_code", s.code);
      if (found) {
        mentors[s.key] = found.id;
        continue;
      }
      const r = await svc("/rest/v1/mentors", {
        method: "POST",
        body: JSON.stringify({
          employee_code: s.code,
          full_name: s.name,
          email: s.email,
          user_id: users[s.key === "m1" ? "mentor1" : "mentor2"],
          department_id: s.dep,
        }),
      });
      mentors[s.key] = r.data[0].id;
    }
  }

  // 7) internships (10) — intern01..05 → mentor1/batch1/depA, intern06..10 → mentor2/batch2/depB
  const internships = {};
  {
    const existing = await svc(
      `/rest/v1/internships?intern_id=in.(${Object.values(interns).join(",")})&select=id,intern_id`,
    );
    const have = new Set(existing.data.map((r) => r.intern_id));
    const missing = [];
    for (let i = 1; i <= 10; i += 1) {
      const ikey = `intern${String(i).padStart(2, "0")}`;
      const iid = interns[String(i).padStart(2, "0")];
      if (have.has(iid)) continue;
      const m1 = i <= 5;
      missing.push({
        intern_id: iid,
        batch_id: m1 ? batch1.id : batch2.id,
        department_id: m1 ? depA.id : depB.id,
        mentor_id: m1 ? mentors.m1 : mentors.m2,
        status: "active",
        start_date: todayVN(-40),
        end_date: todayVN(50),
        created_by: users.admin,
      });
    }
    if (missing.length) await svc("/rest/v1/internships", { method: "POST", body: JSON.stringify(missing) });
    const all = await svc(
      `/rest/v1/internships?intern_id=in.(${Object.values(interns).join(",")})&select=id,intern_id`,
    );
    for (const r of all.data) {
      const idx = Object.entries(interns).find(([, id]) => id === r.intern_id)?.[0];
      if (idx) internships[`intern${idx}`] = r.id; // key đồng bộ tên user: intern01..intern10
    }
  }

  // 8) locations (3) — toạ độ cách nhau để không vô tình match chéo
  const locs = {};
  {
    const specs = [
      {
        key: "main",
        code: `${PREFIX}LOC-MAIN`,
        name: `${PREFIX} Van phong MAIN`,
        latitude: 10.7626,
        longitude: 106.66,
        radius_m: 100,
        min_accuracy_meters: 50,
        // Khung giờ mở hoàn toàn (không rơi vào window closed khi test chạy)
        check_in_start_time: "00:00",
        check_in_end_time: null,
        check_out_start_time: null,
        check_out_end_time: null,
      },
      {
        key: "window",
        code: `${PREFIX}LOC-WINDOW`,
        name: `${PREFIX} Van phong WINDOW`,
        latitude: 10.7726,
        longitude: 106.67,
        radius_m: 100,
        min_accuracy_meters: 50,
        // Luôn đóng: local_time > 00:00 gần như mọi thời điểm trong ngày
        check_in_start_time: "00:00",
        check_in_end_time: "00:00",
        check_out_start_time: null,
        check_out_end_time: "00:00",
      },
      {
        key: "early",
        code: `${PREFIX}LOC-EARLY`,
        name: `${PREFIX} Van phong EARLY`,
        latitude: 10.7526,
        longitude: 106.65,
        radius_m: 100,
        min_accuracy_meters: 50,
        check_in_start_time: "00:00",
        check_in_end_time: null,
        check_out_start_time: "23:59", // check-out trước 23:59 → early_leave
        check_out_end_time: null,
      },
    ];
    for (const s of specs) {
      const found = await fetchOrCreateByCode("attendance_locations", "code", s.code);
      if (found) {
        locs[s.key] = found.id;
        continue;
      }
      const { key, ...row } = s; // `key` chỉ để đánh dấu trong JS, không phải cột DB
      const r = await svc("/rest/v1/attendance_locations", {
        method: "POST",
        body: JSON.stringify({ ...row, is_active: true }),
      });
      if (!r.ok || !r.data?.[0]) {
        throw new Error(`seed location ${s.code} failed: ${JSON.stringify(r.data)}`);
      }
      locs[s.key] = r.data[0].id;
    }
  }

  // 9) attendance history: 10 interns × 50 ngày quá khứ (~500 dòng) — dùng cho
  //    lọc/phân trang/thống kê/hiệu năng. KHÔNG đụng ngày hôm nay (test check-in).
  {
    const statuses = [
      "present", "present", "present", "late", "absent",
      "leave", "wfh", "early_leave", "present", "late",
    ];
    const rows = [];
    for (let i = 1; i <= 10; i += 1) {
      const ikey = `intern${String(i).padStart(2, "0")}`;
      for (let d = 1; d <= 50; d += 1) {
        const status = statuses[(i + d) % statuses.length];
        const hasIn = status !== "absent" && status !== "leave";
        rows.push({
          intern_id: interns[String(i).padStart(2, "0")],
          internship_id: internships[ikey],
          location_id: locs.main,
          work_date: todayVN(-d),
          status,
          check_in_at: hasIn ? vnIso(-d, 8, 10 + (d % 20)) : null,
          check_out_at: hasIn && status !== "leave" && d % 3 !== 0 ? vnIso(-d, 17, 5) : null,
          is_geo_validated: hasIn,
        });
      }
    }
    await svc("/rest/v1/attendance", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    });
  }

  // 10) requests mẫu nhiều trạng thái (cho test thống kê)
  {
    const reqSpecs = [
      { code: `${PREFIX}REQ-01`, type: "leave", status: "pending", intern: "01" },
      { code: `${PREFIX}REQ-02`, type: "late", status: "approved", intern: "01" },
      { code: `${PREFIX}REQ-03`, type: "leave", status: "rejected", intern: "02" },
      { code: `${PREFIX}REQ-04`, type: "wfh", status: "approved", intern: "02" },
      { code: `${PREFIX}REQ-05`, type: "late", status: "pending", intern: "06" },
      { code: `${PREFIX}REQ-06`, type: "attendance_adjustment", status: "pending", intern: "07" },
    ];
    const existing = await svc(`/rest/v1/requests?request_code=like.${PREFIX}*&select=id`);
    if (!existing.data.length) {
      await svc("/rest/v1/requests", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(
          reqSpecs.map((r, i) => {
            const ikey = `intern${r.intern}`;
            return {
              request_code: r.code,
              user_id: users[ikey],
              intern_id: interns[r.intern],
              internship_id: internships[ikey],
              request_type: r.type,
              title: `${PREFIX} Don ${r.code.slice(-2)}`,
              reason: `${PREFIX} Ly do mau cho test`,
              start_date: todayVN(-(i + 1)),
              end_date: todayVN(-(i + 1)),
              status: r.status,
              submitted_at: new Date().toISOString(),
              payload: {},
            };
          }),
        ),
      });
    }
  }

  const world = {
    createdAt: Date.now(),
    users,
    roles,
    interns,
    internships,
    mentors,
    deps: { a: depA.id, b: depB.id },
    batches: { 1: batch1.id, 2: batch2.id },
    locs,
    uploads: [],
  };
  writeFileSync(WORLD_PATH, JSON.stringify(world, null, 2));
  return world;
}

/** Đọc world (tạo mới nếu chưa có / quá hạn / dữ liệu remote đã bị dọn). */
export async function getWorld() {
  if (existsSync(WORLD_PATH)) {
    try {
      const w = JSON.parse(readFileSync(WORLD_PATH, "utf8"));
      if (Date.now() - w.createdAt < 4 * 3600 * 1000) {
        const probe = await svc(
          `/rest/v1/attendance_locations?id=eq.${w.locs.main}&select=id`,
        );
        const depProbe = await svc(
          `/rest/v1/departments?code=eq.${PREFIX}DEP-A&select=id`,
        );
        if (probe.data?.length && depProbe.data?.length) return w;
      }
    } catch {
      // world hỏng → seed lại
    }
  }
  return seedWorld();
}

export function saveWorld(world) {
  writeFileSync(WORLD_PATH, JSON.stringify(world, null, 2));
}

// --------------------------------------------------------------------------
// Dọn dữ liệu test (chỉ dữ liệu TEST-QA-)
// --------------------------------------------------------------------------
async function del(table, query, extra = {}) {
  const r = await svc(`/rest/v1/${table}?${query}`, { method: "DELETE", ...extra });
  if (!r.ok) throw new Error(`cleanup ${table} failed: ${JSON.stringify(r.data)}`);
}

async function listStorage(prefix = "", bucket = "request-attachments") {
  const r = await svc(`/storage/v1/object/list/${bucket}`, {
    method: "POST",
    body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } }),
  });
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

export async function purgeTestData() {
  // 0) File storage đã upload trong các lần chạy trước (world.uploads)
  try {
    if (existsSync(WORLD_PATH)) {
      const w = JSON.parse(readFileSync(WORLD_PATH, "utf8"));
      const paths = Array.isArray(w.uploads) ? w.uploads : [];
      if (paths.length) {
        await svc("/storage/v1/object/request-attachments", {
          method: "DELETE",
          body: JSON.stringify(paths),
        });
      }
    }
  } catch {
    // bỏ qua
  }

  // 1) Storage: xóa thư mục TEST-QA-* trong request-attachments
  try {
    const root = await listStorage("");
    const paths = [];
    for (const e of root) {
      if (!e.name?.startsWith(PREFIX)) continue;
      if (e.id) {
        paths.push(e.name); // file ở root
      } else {
        const files = await listStorage(e.name);
        for (const f of files) if (f.id) paths.push(`${e.name}/${f.name}`);
      }
    }
    if (paths.length) {
      await svc("/storage/v1/object/request-attachments", {
        method: "DELETE",
        body: JSON.stringify(paths),
      });
    }
  } catch {
    // storage list không chạy được → bỏ qua (test upload sẽ tự dọn theo world.uploads)
  }

  // 2) Interns (lấy id trước để lần theo các bảng con)
  const internsRes = await svc(`/rest/v1/interns?student_code=like.${PREFIX}*&select=id`);
  const internIds = (internsRes.data || []).map((r) => r.id);

  // 3) Requests của intern test → approval_logs, attachments, requests
  if (internIds.length) {
    const reqs = await svc(
      `/rest/v1/requests?intern_id=in.(${internIds.join(",")})&select=id`,
    );
    const reqIds = (reqs.data || []).map((r) => r.id);
    if (reqIds.length) {
      const idList = reqIds.join(",");
      await svc(`/rest/v1/request_approval_logs?request_id=in.(${idList})`, { method: "DELETE" });
      await svc(`/rest/v1/request_attachments?request_id=in.(${idList})`, { method: "DELETE" });
      await svc(`/rest/v1/requests?id=in.(${idList})`, { method: "DELETE" });
    }
  }

  // 4) Auth user test (id cần cho notifications/verification logs)
  const userIds = await listTestUserIds();

  // 5) Attendance verification logs
  if (userIds.length) {
    await svc(`/rest/v1/attendance_verification_logs?user_id=in.(${userIds.join(",")})`, {
      method: "DELETE",
    });
  }
  if (internIds.length) {
    const att = await svc(`/rest/v1/attendance?intern_id=in.(${internIds.join(",")})&select=id`);
    const attIds = (att.data || []).map((r) => r.id);
    if (attIds.length) {
      await svc(`/rest/v1/attendance_verification_logs?attendance_id=in.(${attIds.join(",")})`, {
        method: "DELETE",
      });
      await svc(`/rest/v1/attendance?id=in.(${attIds.join(",")})`, { method: "DELETE" });
    }
  }

  // 6) Notifications của user test (nếu bảng có cột user_id)
  if (userIds.length) {
    try {
      await svc(`/rest/v1/notifications?user_id=in.(${userIds.join(",")})`, { method: "DELETE" });
    } catch {
      // bỏ qua
    }
  }

  // 7) Internships / interns / mentors / locations / batches / departments
  if (internIds.length) {
    await svc(`/rest/v1/internships?intern_id=in.(${internIds.join(",")})`, { method: "DELETE" });
  }
  await del("interns", `student_code=like.${PREFIX}*`);
  await del("mentors", `employee_code=like.${PREFIX}*`);
  await del("attendance_locations", `code=like.${PREFIX}*`);
  await del("internship_batches", `code=like.${PREFIX}*`);
  await del("departments", `code=like.${PREFIX}*`);

  // 8) Auth users (cascade profiles)
  for (const id of userIds) {
    await svc(`/auth/v1/admin/users/${id}`, { method: "DELETE" });
  }
}

/** Cleanup toàn bộ (gọi ở cuối suite). */
export async function cleanupWorld() {
  await purgeTestData();
  if (existsSync(WORLD_PATH)) unlinkSync(WORLD_PATH);
  tokenCache.clear();
}
