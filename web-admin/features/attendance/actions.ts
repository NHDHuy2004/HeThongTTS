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

export type CreateAttendanceState = {
  error?: string;
  success?: string;
};

const CREATE_STATUS = new Set<AttendanceStatus>([
  "present",
  "late",
  "early_leave",
  "absent",
  "leave",
  "wfh",
]);

// Giờ HH:MM từ <input type="time">.
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Tạo bản ghi điểm danh thủ công (HR/Admin) — Trường hợp A.
 * Toàn bộ validate nghiệp vụ + chống trùng + audit nằm trong RPC
 * `create_attendance` (security definer, không mở RLS INSERT).
 */
export async function createAttendanceAction(
  _previous: CreateAttendanceState,
  formData: FormData,
): Promise<CreateAttendanceState> {
  try {
    const internshipId = String(formData.get("internship_id") ?? "");
    const workDate = String(formData.get("work_date") ?? "");
    const status = String(formData.get("status") ?? "absent") as AttendanceStatus;
    const checkIn = String(formData.get("check_in_time") ?? "").trim();
    const checkOut = String(formData.get("check_out_time") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim() || null;
    const reason = String(formData.get("reason") ?? "").trim();

    if (!internshipId) return { error: "Vui lòng chọn thực tập sinh." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
      return { error: "Vui lòng chọn ngày điểm danh hợp lệ." };
    }
    if (!CREATE_STATUS.has(status)) {
      return { error: "Trạng thái điểm danh không hợp lệ." };
    }
    if (checkIn && !TIME_RE.test(checkIn)) {
      return { error: "Giờ check-in không hợp lệ." };
    }
    if (checkOut && !TIME_RE.test(checkOut)) {
      return { error: "Giờ check-out không hợp lệ." };
    }
    if (checkIn && checkOut && checkOut < checkIn) {
      return { error: "Giờ check-out phải lớn hơn hoặc bằng giờ check-in." };
    }
    if (!reason || reason.length < 5) {
      return { error: "Vui lòng nhập lý do tạo bản ghi (tối thiểu 5 ký tự)." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_attendance", {
      p_internship_id: internshipId,
      p_work_date: workDate,
      p_status: status,
      p_check_in_time: checkIn || null,
      p_check_out_time: checkOut || null,
      p_note: note,
      p_reason: reason,
    });

    if (error) {
      // Giữ chi tiết kỹ thuật ở server; client chỉ nhận thông báo chung.
      console.error("[create_attendance] rpc error", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return {
        error:
          "Không thể tạo bản ghi điểm danh. Vui lòng thử lại hoặc liên hệ quản trị viên.",
      };
    }

    const result = data as { success?: boolean; code?: string; message?: string };
    if (!result?.success) {
      return {
        error: result?.message ?? "Không thể tạo bản ghi điểm danh.",
      };
    }

    revalidatePath("/admin/attendance");
    revalidatePath("/attendance");
    return { success: result.message ?? "Đã tạo bản ghi điểm danh." };
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      String((e as { digest?: unknown }).digest).includes("NEXT_REDIRECT")
    ) {
      throw e;
    }
    console.error("[create_attendance] unexpected", e);
    return { error: "Đã xảy ra lỗi không mong muốn." };
  }
}
