"use server";

import { createClient } from "@/lib/supabase/server";

type ReportKind = "daily" | "weekly";

export async function reviewReport(kind: ReportKind, id: string, feedback: string, score: string) {
  const supabase = await createClient();

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr" && role !== "mentor") {
    return { error: "Bạn không có quyền nhận xét báo cáo." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const numericScore = score === "" ? null : Number(score);
  if (numericScore !== null && (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 100)) {
    return { error: "Điểm phải nằm trong khoảng 0 – 100." };
  }

  const payload = {
    feedback: feedback || null,
    score: numericScore,
    reviewed_by: user?.id ?? null,
    reviewed_at: new Date().toISOString(),
  };

  const table = kind === "daily" ? "daily_reports" : "weekly_reports";

  const { error } = await supabase
    .from(table as "daily_reports" | "weekly_reports")
    .update(payload)
    .eq("id", id);

  return { error: error?.message ?? undefined };
}