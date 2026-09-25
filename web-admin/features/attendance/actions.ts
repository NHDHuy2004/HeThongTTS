"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/types/database";

export type AdjustState = {
  error?: string;
  success?: string;
};

export async function adjustAttendanceAction(
  _previous: AdjustState,
  formData: FormData,
): Promise<AdjustState> {
  try {
    const attendanceId = String(formData.get("attendance_id") ?? "");
    const status = String(formData.get("status") ?? "") as AttendanceStatus;
    const note = ((formData.get("note") as string) || "").trim() || null;
    const reason = ((formData.get("reason") as string) || "").trim();

    if (!attendanceId) return { error: "Thiếu bản ghi điểm danh." };
    if (!reason || reason.length < 5) {
      return { error: "Vui lòng nhập lý do điều chỉnh (tối thiểu 5 ký tự)." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("adjust_attendance", {
      p_attendance_id: attendanceId,
      p_status: status,
      p_note: note,
      p_reason: reason,
    });

    if (error) return { error: error.message };

    const result = data as { success?: boolean; message?: string };
    if (!result?.success) {
      return { error: result?.message ?? "Không thể điều chỉnh điểm danh." };
    }

    revalidatePath("/admin/attendance");
    revalidatePath("/attendance");
    return { success: "Đã điều chỉnh điểm danh." };
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
