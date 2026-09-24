"use server";

import { createClient } from "@/lib/supabase/server";

export type OnboardingFormState = { error?: string };

export async function createChecklist(
  prevState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const supabase = await createClient();

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr") {
    return { error: "Bạn không có quyền tạo checklist onboarding." };
  }

  const intern_id = String(formData.get("intern_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const due_date = (formData.get("due_date") as string) || null;

  if (!intern_id || !title) {
    return { error: "Vui lòng chọn intern và nhập tiêu đề." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("onboarding_checklists").insert({
    intern_id,
    title,
    due_date,
    status: "not_started",
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };
  return {};
}

export async function toggleChecklist(id: string, done: boolean) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn chưa đăng nhập." };

  const { data: role } = await supabase.rpc("get_my_role");

  let query = supabase.from("onboarding_checklists").update({
    status: done ? "completed" : "not_started",
    completed_at: done ? new Date().toISOString() : null,
  });

  if (role === "intern") {
    const { data: myIntern } = await supabase
      .from("interns")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!myIntern) return { error: "Không tìm thấy hồ sơ intern của bạn." };
    query = query.eq("intern_id", myIntern.id);
  }

  const { error } = await query.eq("id", id);
  return { error: error?.message ?? undefined };
}