"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  ReviewCompletion,
  ReviewDecision,
  TaskStatus,
} from "@/types/database";

export type TaskFormState = { error?: string };

const TASK_ALLOWED = new Set([
  "not_started",
  "in_progress",
  "in_review",
  "changes_requested",
  "completed",
  "cancelled",
]);
const FINAL_STATES = new Set(["completed", "cancelled"]);

function text(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function requireRole(): Promise<string | null> {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("get_my_role");
  return ((role as string) ?? null);
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function isStaff(role: string | null): boolean {
  return role === "admin" || role === "hr" || role === "mentor";
}

// ==========================================================================
// CREATE TASK (individual / team + deliverables + optional attachment)
// ==========================================================================
export async function createTask(
  prevState: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const role = await requireRole();
  if (!isStaff(role)) return { error: "Bạn không có quyền tạo công việc." };

  const supabase = await createClient();
  const userId = await currentUserId();

  const internship_id = text(formData, "internship_id");
  const title = text(formData, "title");
  if (!internship_id || !title) {
    return { error: "Vui lòng chọn intern và nhập tiêu đề." };
  }

  const assignment_type = (formData.get("assignment_type") as string) === "team"
    ? ("team" as const)
    : ("individual" as const);
  const deliverables = (formData.getAll("deliverables") as string[]).filter(Boolean);
  const internIds = (formData.getAll("intern_ids") as string[]).filter(Boolean);

  if (assignment_type === "team" && internIds.length === 0) {
    return { error: "Task nhóm cần ít nhất một thành viên." };
  }

  const deadline = text(formData, "deadline");
  const start_date = text(formData, "start_date");

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      internship_id,
      title,
      description: text(formData, "description"),
      assignment_type,
      project: text(formData, "project"),
      module: text(formData, "module"),
      task_type: text(formData, "task_type"),
      objective: text(formData, "objective"),
      requirements: text(formData, "requirements"),
      acceptance_criteria: text(formData, "acceptance_criteria"),
      deliverables,
      priority: (text(formData, "priority") ?? "medium") as
        | "low"
        | "medium"
        | "high"
        | "urgent",
      status: "not_started",
      start_date,
      deadline,
      estimated_hours: text(formData, "estimated_hours")
        ? Number(formData.get("estimated_hours"))
        : null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Gán thành viên (team) hoặc gán chính intern (individual)
  const assigneeIds = assignment_type === "team"
    ? internIds
    : [internship_id];
  if (assigneeIds.length > 0) {
    const interns = await supabase
      .from("internships")
      .select("intern_id")
      .in("id", assigneeIds);
    const rows = (interns.data ?? []).map((ip) => ({
      task_id: task.id,
      intern_id: ip.intern_id,
      role: "assignee",
      assigned_by: userId,
    }));
    await supabase.from("task_assignees").insert(rows);
  }

  // File đính kèm (mentor/HR giao việc bằng file)
  const file = formData.get("attachment");
  if (file instanceof File && file.size > 0) {
    const res = await uploadFileToStorage(task.id, "attachments", file);
    if (!res.path) return { error: "Không upload được file đính kèm." };
    await supabase.from("task_attachments").insert({
      task_id: task.id,
      uploaded_by: userId,
      file_path: res.path,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size,
    });
  }

  return {};
}

// ==========================================================================
// TASK STATUS (theo luồng spec)
// ==========================================================================
export async function updateTaskStatus(id: string, status: string) {
  if (!TASK_ALLOWED.has(status)) return { error: "Trạng thái không hợp lệ." };

  const role = await requireRole();
  const supabase = await createClient();

  const isIntern = role === "intern";
  if (isIntern) {
    // Intern chỉ được tự đổi sang các trạng thái làm việc, không completed/cancelled
    if (FINAL_STATES.has(status)) {
      return { error: "Bạn không được tự đánh dấu hoàn thành." };
    }
  } else if (!isStaff(role)) {
    return { error: "PERMISSION_DENIED" };
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      status: status as TaskStatus,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  return { error: error?.message ?? undefined };
}

// ==========================================================================
// SUB-TASK
// ==========================================================================
export async function createSubtask(
  taskId: string,
  prevState: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const role = await requireRole();
  if (!isStaff(role)) return { error: "Bạn không có quyền tạo sub-task." };
  const supabase = await createClient();

  const title = text(formData, "title");
  if (!title) return { error: "Vui lòng nhập tiêu đề sub-task." };

  const { error } = await supabase.from("task_subtasks").insert({
    task_id: taskId,
    title,
    description: text(formData, "description"),
    assignee_id: text(formData, "assignee_id"),
    start_date: text(formData, "start_date"),
    due_date: text(formData, "due_date"),
    priority: (text(formData, "priority") ?? "medium") as
      | "low"
      | "medium"
      | "high"
      | "urgent",
    deliverable: text(formData, "deliverable"),
    created_by: await currentUserId(),
  });

  return { error: error?.message ?? undefined };
}

export async function updateSubtaskStatus(id: string, status: string) {
  if (!TASK_ALLOWED.has(status)) return { error: "Trạng thái không hợp lệ." };

  const role = await requireRole();
  if (role === "intern" && FINAL_STATES.has(status)) {
    return { error: "Bạn không được tự đánh dấu hoàn thành." };
  }
  if (!role) return { error: "PERMISSION_DENIED" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_subtasks")
    .update({ status: status as TaskStatus })
    .eq("id", id);

  return { error: error?.message ?? undefined };
}

// ==========================================================================
// SUBMIT TASK (intern) — text + links + files
// ==========================================================================
export async function submitTask(
  taskId: string,
  prevState: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const role = await requireRole();
  if (!role) return { error: "PERMISSION_DENIED" };

  const supabase = await createClient();
  const userId = await currentUserId();

  const subtask_id = text(formData, "subtask_id");

  let submissionNo = 1;
  const { data: last } = await supabase
    .from("task_submissions")
    .select("submission_no")
    .eq("task_id", taskId)
    .order("submission_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last?.submission_no) submissionNo = (last.submission_no as number) + 1;

  const { data: submission, error } = await supabase
    .from("task_submissions")
    .insert({
      task_id: taskId,
      subtask_id,
      submitted_by: userId!,
      work_summary: text(formData, "work_summary"),
      implementation_details: text(formData, "implementation_details"),
      problems: text(formData, "problems"),
      solutions: text(formData, "solutions"),
      notes: text(formData, "notes"),
      submission_no: submissionNo,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Links: field "links" dạng JSON [{title,url}]
  const linksRaw = text(formData, "links");
  if (linksRaw) {
    try {
      const links = JSON.parse(linksRaw) as { title?: string; url: string }[];
      const rows = links
        .filter((l) => l?.url?.trim())
        .map((l) => ({
          submission_id: submission.id,
          title: l.title?.trim() || null,
          url: l.url.trim(),
        }));
      if (rows.length) {
        const { error: linkErr } = await supabase
          .from("task_submission_links")
          .insert(rows);
        if (linkErr) return { error: linkErr.message };
      }
    } catch {
      return { error: "Danh sách link không hợp lệ." };
    }
  }

  // Files
  for (const file of formData.getAll("files")) {
    if (!(file instanceof File) || file.size === 0) continue;
    const res = await uploadFileToStorage(taskId, `submissions/${submission.id}`, file);
    if (!res.path) continue;
    await supabase.from("task_submission_files").insert({
      submission_id: submission.id,
      file_path: res.path,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size,
    });
  }

  return {};
}

// ==========================================================================
// REVIEW TASK (mentor/hr/admin)
// ==========================================================================
export async function createReview(
  prevState: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const role = await requireRole();
  if (!isStaff(role)) return { error: "Bạn không có quyền đánh giá." };

  const supabase = await createClient();
  const task_id = text(formData, "task_id");
  if (!task_id) return { error: "Thiếu task." };

  const decision = (formData.get("decision") as string) ?? "";
  if (!["approved", "changes_requested", "rejected"].includes(decision)) {
    return { error: "Lựa chọn đánh giá không hợp lệ." };
  }

  const num = (k: string) => {
    const v = text(formData, k);
    return v ? Number(v) : null;
  };

  const { error } = await supabase.from("task_reviews").insert({
    task_id,
    subtask_id: text(formData, "subtask_id"),
    submission_id: text(formData, "submission_id"),
    reviewer_id: (await currentUserId())!,
    decision: decision as ReviewDecision,
    completion: ((formData.get("completion") as string) ?? "complete") as ReviewCompletion,
    completion_pct: num("completion_pct"),
    quality_score: num("quality_score"),
    technical_score: num("technical_score"),
    documentation_score: num("documentation_score"),
    soft_score: num("soft_score"),
    deadline_bucket: (formData.get("deadline_bucket") as string) || null,
    feedback: text(formData, "feedback"),
    strengths: text(formData, "strengths"),
    weaknesses: text(formData, "weaknesses"),
    improvements: text(formData, "improvements"),
  });

  return { error: error?.message ?? undefined };
}

// ==========================================================================
// ATTACHMENT (staff upload file giao việc)
// ==========================================================================
export async function uploadTaskAttachment(
  taskId: string,
  prevState: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const role = await requireRole();
  if (!isStaff(role)) return { error: "Bạn không có quyền đính kèm file." };

  const supabase = await createClient();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Chưa chọn file." };
  }

  const res = await uploadFileToStorage(taskId, "attachments", file);
  if (!res.path) return { error: "Không upload được file." };

  const { error } = await supabase.from("task_attachments").insert({
    task_id: taskId,
    uploaded_by: await currentUserId(),
    file_path: res.path,
    file_name: file.name,
    mime_type: file.type || null,
    file_size: file.size,
  });

  return { error: error?.message ?? undefined };
}

// ==========================================================================
// Storage helper (service role — bỏ qua RLS storage)
// ==========================================================================
async function uploadFileToStorage(
  taskId: string,
  subPath: string,
  file: File,
): Promise<{ path: string | null; error?: string }> {
  try {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${taskId}/${subPath}/${Date.now()}-${safeName}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const admin = createAdminClient();
    const { error } = await admin.storage
      .from("task-attachments")
      .upload(path, buf, {
        contentType: file.type || undefined,
        upsert: false,
      });
    if (error) return { path: null, error: error.message };
    return { path };
  } catch (e) {
    return { path: null, error: e instanceof Error ? e.message : "upload error" };
  }
}