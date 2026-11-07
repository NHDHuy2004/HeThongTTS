import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// ==========================================================================
// POST /api/attendance/check — Check-in / Check-out GPS cho Intern (web).
//
// Tái sử dụng RPC `attendance_check` (0016) — MỘT nguồn xác minh duy nhất
// (cùng edge function `attendance-check` dùng cho mobile):
//   - Server tự xác định người dùng từ Supabase Auth (không tin user_id
//     hay trạng thái do client gửi).
//   - Chỉ role `intern` được điểm danh.
//   - Postgres tự chọn địa điểm theo phòng ban/đợt, tính khoảng cách,
//     kiểm bán kính, độ chính xác, khung giờ và dùng thời gian SERVER.
//   - Service role chỉ dùng để gọi RPC (RPC chỉ grant cho service_role).
// ==========================================================================

type CheckResult = {
  success?: boolean;
  code?: string;
  message?: string;
  status?: string;
  action?: string;
  attendance_id?: string;
  distance_meters?: number | null;
};

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  try {
    // 1) Xác thực phiên đăng nhập phía server.
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      return errorResponse("AUTH_ERROR", "Vui lòng đăng nhập.", 401);
    }

    // 2) Phân quyền ở backend (không chỉ ẩn nút ở frontend).
    const { data: role } = await supabase.rpc("get_my_role");
    if (role !== "intern") {
      return errorResponse(
        "PERMISSION_DENIED",
        "Chỉ thực tập sinh mới được điểm danh.",
        403,
      );
    }

    // 3) Tọa độ GPS — cùng kiểm tra như edge function attendance-check.
    let body: Record<string, unknown> | null = null;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = null;
    }
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Body không hợp lệ.", 400);
    }

    const rawAction =
      typeof body.action === "string"
        ? body.action.trim().toUpperCase().replace(/-/g, "_")
        : "";
    const action =
      rawAction === "CHECK_IN" || rawAction === "CHECK_OUT" ? rawAction : null;
    if (!action) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Thiếu action CHECK_IN hoặc CHECK_OUT.",
        400,
      );
    }

    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Không thể xác định vị trí hiện tại. Vui lòng thử lại.",
        400,
      );
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Tọa độ GPS ngoài phạm vi hợp lệ.",
        400,
      );
    }

    const accuracy = Number(body.accuracy);
    if (!Number.isFinite(accuracy) || accuracy <= 0) {
      return errorResponse(
        "ACCURACY_NOT_MET",
        "Vui lòng bật GPS để thực hiện điểm danh.",
        400,
      );
    }

    // 4) Xác minh & ghi nhận tại Postgres (thời gian server làm chuẩn).
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("attendance_check", {
      p_user_id: user.id,
      p_action: action,
      p_latitude: latitude,
      p_longitude: longitude,
      p_accuracy: accuracy,
      p_note:
        typeof body.note === "string" ? body.note.slice(0, 500) : null,
    });

    if (error) {
      // Chi tiết kỹ thuật giữ ở server; client nhận thông báo chung.
      console.error("[attendance/check] rpc error", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return errorResponse(
        "DB_ERROR",
        "Không thể ghi nhận điểm danh. Vui lòng thử lại.",
        500,
      );
    }

    const result = (data ?? {}) as CheckResult;
    if (!result.success) {
      const code = result.code ?? "ATTENDANCE_REJECTED";
      const status =
        code === "AUTH_ERROR" || code === "PERMISSION_DENIED" ? 403 : 400;
      return errorResponse(code, result.message ?? "Điểm danh bị từ chối", status);
    }

    return NextResponse.json({
      success: true,
      action: result.action ?? action,
      status: result.status,
      message: result.message ?? "Điểm danh thành công.",
      attendance_id: result.attendance_id,
      distance_meters: result.distance_meters,
    });
  } catch (e) {
    console.error("[attendance/check] unexpected", e);
    return errorResponse(
      "INTERNAL_ERROR",
      "Đã xảy ra lỗi không mong muốn.",
      500,
    );
  }
}
