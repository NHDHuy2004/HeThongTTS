"use server";

import { createClient } from "@/lib/supabase/server";

export type EvalFormState = { error?: string; id?: string };

export async function createEvaluation(
  prevState: EvalFormState,
  formData: FormData,
): Promise<EvalFormState> {
  const supabase = await createClient();

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr" && role !== "mentor") {
    return { error: "Bạn không có quyền tạo đánh giá." };
  }

  const internship_id = String(formData.get("internship_id") ?? "");
  const type = (formData.get("type") as string) || "weekly";
  const period_label = String(formData.get("period_label") ?? "").trim();
  const due_date = (formData.get("due_date") as string) || null;
  const period_start = (formData.get("period_start") as string) || null;
  const period_end = (formData.get("period_end") as string) || null;

  if (!internship_id || !period_label) {
    return { error: "Vui lòng chọn intern và nhập kỳ đánh giá." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn chưa đăng nhập." };

  // Mentor chỉ được tạo đánh giá cho intern được phân công (RLS đã enforcing,
  // kiểm tra thêm tại server để báo lỗi rõ ràng).
  if (role === "mentor") {
    const { data: mentor } = await supabase
      .from("mentors")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: ip } = await supabase
      .from("internships")
      .select("mentor_id")
      .eq("id", internship_id)
      .maybeSingle();
    if (!mentor || !ip || ip.mentor_id !== mentor.id) {
      return { error: "Bạn chỉ được đánh giá thực tập sinh được phân công." };
    }
  }

  // Chặn tạo trùng trước khi insert (unique internship_id+reviewer_id+type+period_label
  // và unique midterm/final theo internship_id+type).
  const { data: existing } = await supabase
    .from("evaluations")
    .select("id")
    .eq("internship_id", internship_id)
    .eq("type", type as "weekly" | "midterm" | "final" | "feedback_360")
    .eq("period_label", period_label)
    .maybeSingle();
  if (existing) {
    return { error: "Đánh giá cho kỳ này đã tồn tại. Vui lòng mở phiếu hiện có để cập nhật.", id: existing.id };
  }

  const { data, error } = await supabase
    .from("evaluations")
    .insert({
      internship_id,
      reviewer_id: user.id,
      type: type as "weekly" | "midterm" | "final" | "feedback_360",
      period_label,
      due_date: due_date || null,
      period_start: period_start || null,
      period_end: period_end || null,
    })
    .select("id")
    .single();

  if (error) {
    const msg = (error as { code?: string; message?: string }).message ?? error.message;
    if ((error as { code?: string }).code === "23505" || /duplicate|unique/i.test(String(msg))) {
      return { error: "Đánh giá cho kỳ này đã tồn tại. Vui lòng mở phiếu hiện có để cập nhật." };
    }
    return { error: String(msg) };
  }
  return { id: data?.id };
}

export async function submitEvaluation(id: string) {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr" && role !== "mentor") {
    return { error: "Bạn không có quyền nộp đánh giá." };
  }
  const { error } = await supabase
    .from("evaluations")
    .update({ submitted_at: new Date().toISOString(), status: "submitted" })
    .eq("id", id);
  return { error: error?.message ?? undefined };
}

export async function saveEvaluationScores(
  evaluationId: string,
  scores: { criterion_id: string; score: number; comment: string | null }[],
) {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr" && role !== "mentor") {
    return { error: "Bạn không có quyền lưu điểm." };
  }
  const { data: ev } = await supabase
    .from("evaluations")
    .select("status")
    .eq("id", evaluationId)
    .maybeSingle();
  if (!ev) return { error: "Không tìm thấy phiếu đánh giá." };
  if (ev.status === "finalized") {
    return { error: "Phiếu đã chốt điểm (finalized), không thể chỉnh sửa." };
  }
  for (const s of scores) {
    if (s.score < 0 || s.score > 10) return { error: "Điểm phải từ 0 đến 10." };
    const { error } = await supabase
      .from("evaluation_scores")
      .upsert(
        {
          evaluation_id: evaluationId,
          criterion_id: s.criterion_id,
          score: s.score,
          comment: s.comment,
        },
        { onConflict: "evaluation_id,criterion_id" },
      );
    if (error) return { error: error.message };
  }
  return {};
}

export async function updateEvaluationSummary(
  id: string,
  summary: string | null,
  strengths?: string | null,
  needs_improvement?: string | null,
  recommendation?: string | null,
) {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr" && role !== "mentor") {
    return { error: "PERMISSION_DENIED" };
  }
  const { data: cur } = await supabase
    .from("evaluations")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!cur) return { error: "Không tìm thấy phiếu đánh giá." };
  if (cur.status === "finalized") {
    return { error: "Phiếu đã chốt điểm (finalized), không thể chỉnh sửa." };
  }
  const { error } = await supabase
    .from("evaluations")
    .update({ summary, strengths, needs_improvement, recommendation })
    .eq("id", id);
  return { error: error?.message ?? undefined };
}

export async function setEvaluationStatus(
  id: string,
  status: "draft" | "submitted" | "reviewed" | "finalized",
) {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr" && role !== "mentor") {
    return { error: "PERMISSION_DENIED" };
  }
  const { data: cur } = await supabase
    .from("evaluations")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!cur) return { error: "Không tìm thấy phiếu đánh giá." };
  if (cur.status === "finalized" && status !== "finalized") {
    return { error: "Phiếu đã chốt điểm (finalized), không thể thay đổi trạng thái." };
  }
  const patch: Record<string, unknown> = { status };
  if (status === "submitted") patch.submitted_at = new Date().toISOString();
  if (status === "reviewed") patch.reviewed_at = new Date().toISOString();
  if (status === "finalized") patch.reviewed_at = new Date().toISOString();
  const { error } = await supabase.from("evaluations").update(patch).eq("id", id);
  return { error: error?.message ?? undefined };
}