"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ReportActionState = {
  error?: string;
  success?: string;
  report_id?: string;
  report_code?: string;
};

function revalidateReports() {
  revalidatePath("/intern/reports");
  revalidatePath("/admin/reports");
  revalidatePath("/reports");
}

const REPORT_TYPES = new Set(["daily", "weekly", "monthly", "final"]);

type RpcResult = {
  success?: boolean;
  code?: string;
  message?: string;
  report_id?: string;
  report_code?: string;
};

async function parseReportForm(formData: FormData) {
  const reportType = String(formData.get("report_type") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const periodStart = ((formData.get("period_start") as string) || "").trim();
  const periodEnd = ((formData.get("period_end") as string) || "").trim();
  const dueDate = ((formData.get("due_date") as string) || "").trim() || null;
  const contentRaw = String(formData.get("content") ?? "");
  const linksRaw = String(formData.get("links") ?? "").trim();
  const taskIdsRaw = String(formData.get("task_ids") ?? "").trim();
  const attachmentsRaw = String(formData.get("attachment_paths") ?? "").trim();

  if (!REPORT_TYPES.has(reportType)) return { error: "Vui lòng chọn loại báo cáo." };
  if (title.length < 5) return { error: "Tiêu đề báo cáo phải có ít nhất 5 ký tự." };
  if (!periodStart || !periodEnd) return { error: "Vui lòng chọn kỳ báo cáo." };
  if (periodEnd < periodStart) return { error: "Ngày kết thúc không được trước ngày bắt đầu." };

  let content: Record<string, string> = {};
  try {
    const parsed = JSON.parse(contentRaw || "{}") as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      content = parsed as Record<string, string>;
    }
  } catch {
    return { error: "Nội dung báo cáo không hợp lệ." };
  }

  let links: { url: string; label?: string }[] = [];
  if (linksRaw) {
    try {
      const parsed = JSON.parse(linksRaw) as unknown;
      if (Array.isArray(parsed)) links = parsed as { url: string; label?: string }[];
    } catch {
      return { error: "Danh sách liên kết không hợp lệ." };
    }
  }

  let taskIds: string[] = [];
  if (taskIdsRaw) {
    try {
      const parsed = JSON.parse(taskIdsRaw) as unknown;
      if (Array.isArray(parsed)) taskIds = parsed.map((t) => String(t));
    } catch {
      return { error: "Danh sách nhiệm vụ liên quan không hợp lệ." };
    }
  }

  let attachments: string[] = [];
  if (attachmentsRaw) {
    try {
      const parsed = JSON.parse(attachmentsRaw) as unknown;
      if (!Array.isArray(parsed)) throw new Error("invalid");
      attachments = parsed.map((p) => String(p));
    } catch {
      return { error: "Danh sách tài liệu đính kèm không hợp lệ." };
    }
  }

  return {
    reportType,
    title,
    periodStart,
    periodEnd,
    dueDate,
    content,
    links,
    taskIds,
    attachments,
  };
}

/** Intern tạo báo cáo mới (nháp hoặc nộp ngay). */
export async function createReportAction(
  _previous: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  try {
    const parsed = await parseReportForm(formData);
    if ("error" in parsed) return { error: parsed.error };
    const submit = String(formData.get("submit") ?? "") === "1";

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_report", {
      p_report_type: parsed.reportType,
      p_title: parsed.title,
      p_period_start: parsed.periodStart,
      p_period_end: parsed.periodEnd,
      p_content: parsed.content,
      p_links: parsed.links,
      p_task_ids: parsed.taskIds,
      p_due_date: parsed.dueDate,
      p_attachment_paths: parsed.attachments,
      p_submit: submit,
    });

    if (error) return { error: error.message };

    const result = data as RpcResult;
    if (!result?.success) {
      return { error: result?.message ?? "Không thể tạo báo cáo." };
    }

    revalidateReports();
    return {
      success: result.message ?? "Đã tạo báo cáo.",
      report_id: result.report_id,
      report_code: result.report_code,
    };
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      String((e as { digest?: unknown }).digest).includes("NEXT_REDIRECT")
    ) {
      throw e;
    }
    return { error: "Đã xảy ra lỗi không mong muốn." };
  }
}

/** Intern chỉnh sửa báo cáo nháp / bị yêu cầu chỉnh sửa (kèm nộp ngay tùy chọn). */
export async function updateReportAction(
  _previous: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  try {
    const reportId = String(formData.get("report_id") ?? "");
    if (!reportId) return { error: "Thiếu mã báo cáo." };

    const parsed = await parseReportForm(formData);
    if ("error" in parsed) return { error: parsed.error };
    const submit = String(formData.get("submit") ?? "") === "1";

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("update_report", {
      p_report_id: reportId,
      p_title: parsed.title,
      p_period_start: parsed.periodStart,
      p_period_end: parsed.periodEnd,
      p_content: parsed.content,
      p_links: parsed.links,
      p_task_ids: parsed.taskIds,
      p_due_date: parsed.dueDate,
      p_attachment_paths: parsed.attachments,
      p_submit: submit,
    });

    if (error) return { error: error.message };

    const result = data as RpcResult;
    if (!result?.success) {
      return { error: result?.message ?? "Không thể cập nhật báo cáo." };
    }

    revalidateReports();
    revalidatePath(`/intern/reports/${reportId}`);
    revalidatePath(`/admin/reports/${reportId}`);
    return { success: result.message ?? "Đã cập nhật báo cáo." };
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      String((e as { digest?: unknown }).digest).includes("NEXT_REDIRECT")
    ) {
      throw e;
    }
    return { error: "Đã xảy ra lỗi không mong muốn." };
  }
}

/** Intern nộp báo cáo nháp / bị yêu cầu chỉnh sửa. */
export async function createReportClientSubmit(
  _previous: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  try {
    const reportId = String(formData.get("report_id") ?? "");
    if (!reportId) return { error: "Thiếu mã báo cáo." };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_report", {
      p_report_id: reportId,
    });

    if (error) return { error: error.message };

    const result = data as RpcResult;
    if (!result?.success) {
      return { error: result?.message ?? "Không thể nộp báo cáo." };
    }

    revalidateReports();
    revalidatePath(`/intern/reports/${reportId}`);
    return { success: result.message ?? "Đã nộp báo cáo." };
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      String((e as { digest?: unknown }).digest).includes("NEXT_REDIRECT")
    ) {
      throw e;
    }
    return { error: "Đã xảy ra lỗi không mong muốn." };
  }
}

const REVIEW_ACTIONS = new Set([
  "take",
  "approve",
  "reject",
  "request_revision",
  "cancel",
]);

/** Xử lý báo cáo: tiếp nhận / phê duyệt / từ chối / yêu cầu chỉnh sửa / hủy. */
export async function reviewReportAction(
  _previous: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  try {
    const reportId = String(formData.get("report_id") ?? "");
    const action = String(formData.get("action") ?? "");
    const comment = ((formData.get("comment") as string) || "").trim() || null;

    if (!reportId) return { error: "Thiếu mã báo cáo." };
    if (!REVIEW_ACTIONS.has(action)) return { error: "Hành động không hợp lệ." };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("review_report", {
      p_report_id: reportId,
      p_action: action,
      p_comment: comment,
    });

    if (error) return { error: error.message };

    const result = data as RpcResult;
    if (!result?.success) {
      return { error: result?.message ?? "Không thể xử lý báo cáo." };
    }

    revalidateReports();
    revalidatePath(`/admin/reports/${reportId}`);
    revalidatePath(`/intern/reports/${reportId}`);
    return { success: result.message ?? "Đã cập nhật báo cáo." };
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      String((e as { digest?: unknown }).digest).includes("NEXT_REDIRECT")
    ) {
      throw e;
    }
    return { error: "Đã xảy ra lỗi không mong muốn." };
  }
}
