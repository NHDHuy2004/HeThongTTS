// ==========================================================================
// 99-cleanup.test.mjs — Dọn TOÀN BỘ dữ liệu TEST-QA- sau khi chạy xong.
// Chạy cuối cùng (thứ tự alphabet + --test-concurrency=1).
// ==========================================================================
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

import { PREFIX, cleanupWorld, svc } from "./helpers.mjs";

test("Cleanup: xóa hết dữ liệu TEST-QA- khỏi remote và local", async () => {
  await cleanupWorld();

  // Remote phải sạch
  const locs = await svc(`/rest/v1/attendance_locations?code=like.${PREFIX}*&select=id`);
  assert.deepEqual(locs.data, [], "không còn địa điểm TEST-QA-");

  const interns = await svc(`/rest/v1/interns?student_code=like.${PREFIX}*&select=id`);
  assert.deepEqual(interns.data, [], "không còn intern TEST-QA-");

  const att = await svc(`/rest/v1/attendance?select=id&intern_id=not.is.null&limit=1`);
  assert.ok(att.ok, "bảng attendance vẫn truy cập được sau cleanup");

  const deps = await svc(`/rest/v1/departments?code=like.${PREFIX}*&select=id`);
  assert.deepEqual(deps.data, [], "không còn phòng ban TEST-QA-");

  // Không còn user test
  const users = await svc("/auth/v1/admin/users?page=1&per_page=200");
  const leaked = (users.data?.users || []).filter((u) => u.email?.startsWith("test-qa-"));
  assert.deepEqual(leaked.map((u) => u.email), [], "không còn tài khoản test");

  // World file local đã xóa
  assert.equal(existsSync(new URL("./.world.json", import.meta.url)), false, "world file đã xóa");
});
