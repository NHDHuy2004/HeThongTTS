"use server";

import { createClient } from "@/lib/supabase/server";

export type TaskFormState = { error?: string };

export async function createTask(
  prevState: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const supabase = await createClient();

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr" && role !== "mentor") {
    return { error: "Bạn không có quyền tạo công việc." };
  }

  const internship_id = String(formData.get("internship_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = (formData.get("description") as string) || null;
  const priority = ((formData.get("priority") as string) || "medium") as
    | "low"
    | "medium"
    | "high"
    | "urgent";
  const deadline = (formData.get("deadline") as string) || null;

  if (!internship_id || !title) {
    return { error: "Vui lòng chọn intern và nhập tiêu đề." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("tasks").insert({
    internship_id,
    title,
    description,
    priority,
    deadline,
    status: "todo",
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };
  return {};
}

export async function updateTaskStatus(id: string, status: string) {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr" && role !== "mentor" && role !== "intern") {
    return { error: "PERMISSION_DENIED" };
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      status: status as "todo" | "in_progress" | "review" | "done",
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  return { error: error?.message ?? undefined };
}