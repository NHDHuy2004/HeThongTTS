"use server";

import { createClient } from "@/lib/supabase/server";

type RequestKind = "leave" | "wfh" | "late";

export async function reviewRequest(
  kind: RequestKind,
  id: string,
  approved: boolean,
  note: string,
) {
  const supabase = await createClient();

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr" && role !== "mentor") {
    return { error: "Bạn không có quyền duyệt đơn." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    status: approved ? ("approved" as const) : ("rejected" as const),
    reviewed_by: user?.id ?? null,
    reviewed_at: new Date().toISOString(),
    review_note: note || null,
  };

  const table =
    kind === "leave"
      ? "leave_requests"
      : kind === "wfh"
        ? "work_from_home_requests"
        : "late_requests";

  const { error } = await supabase
    .from(table as "leave_requests" | "work_from_home_requests" | "late_requests")
    .update(payload)
    .eq("id", id);

  return { error: error?.message ?? undefined };
}