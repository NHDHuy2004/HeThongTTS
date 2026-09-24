"use server";

import { createClient } from "@/lib/supabase/server";

export type EvalFormState = { error?: string };

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

  if (!internship_id || !period_label) {
    return { error: "Vui lòng chọn intern và nhập kỳ đánh giá." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("evaluations").insert({
    internship_id,
    reviewer_id: user?.id ?? "",
    type: type as "weekly" | "midterm" | "final" | "feedback_360",
    period_label,
    due_date,
  });

  if (error) return { error: error.message };
  return {};
}

export async function submitEvaluation(id: string) {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr" && role !== "mentor") {
    return { error: "Bạn không có quyền nộp đánh giá." };
  }
  const { error } = await supabase
    .from("evaluations")
    .update({ submitted_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error?.message ?? undefined };
}