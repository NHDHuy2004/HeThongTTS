import { createAdminClient } from "../_shared/supabase.ts";
import { AppError, errorFrom, errorJson, json } from "../_shared/errors.ts";
import { handleCors } from "../_shared/cors.ts";
import { getCallerUser } from "../_shared/auth.ts";

// ==========================================================================
// attendance-check — Xác minh điểm danh GPS phía backend.
// Quy trình: Auth → tìm intern → gọi RPC attendance_check (Postgres tự
// xác định địa điểm, tính khoảng cách, kiểm khung giờ và ghi bản ghi).
// Client KHÔNG gửi user_id, địa điểm, bán kính hay trạng thái — mọi kết
// quả do server quyết định bằng thời gian server.
// ==========================================================================

type AttendancePayload = {
  action?: string; // "CHECK_IN" | "CHECK_OUT"
  latitude?: number;
  longitude?: number;
  accuracy?: number; // độ chính xác GPS (mét)
  note?: string;
};

function normalizeAction(value: unknown): "CHECK_IN" | "CHECK_OUT" | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase().replace(/-/g, "_");
  if (v === "CHECK_IN" || v === "CHECKIN" || v === "IN") return "CHECK_IN";
  if (v === "CHECK_OUT" || v === "CHECKOUT" || v === "OUT") return "CHECK_OUT";
  return null;
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") {
      return errorJson("METHOD_NOT_ALLOWED", "Chỉ hỗ trợ POST", 405);
    }

    const body = (await req.json().catch(() => null)) as AttendancePayload | null;
    if (!body) return errorJson("VALIDATION_ERROR", "Body không hợp lệ");

    // 1. Xác thực phiên đăng nhập (không tin user_id từ client)
    const caller = await getCallerUser(req);
    if (!caller?.user) {
      return errorJson("AUTH_ERROR", "Vui lòng đăng nhập", 401);
    }
    if (caller.role !== "intern") {
      return errorJson(
        "PERMISSION_DENIED",
        "Chỉ thực tập sinh mới được điểm danh",
        403,
      );
    }

    // 2. Hành động (hỗ trợ payload cũ { check_out: boolean })
    const legacy = (body as { check_out?: boolean }).check_out;
    const action = normalizeAction(body.action) ??
      (legacy === true ? "CHECK_OUT" : legacy === false ? "CHECK_IN" : null);
    if (!action) {
      return errorJson("VALIDATION_ERROR", "Thiếu action CHECK_IN hoặc CHECK_OUT");
    }

    // 3. Tọa độ GPS
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return errorJson(
        "VALIDATION_ERROR",
        "Không thể xác định vị trí hiện tại. Vui lòng thử lại.",
      );
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return errorJson("VALIDATION_ERROR", "Tọa độ GPS ngoài phạm vi hợp lệ");
    }

    // 4. Độ chính xác GPS (mét) — bắt buộc
    const accuracy = Number(body.accuracy);
    if (!Number.isFinite(accuracy) || accuracy <= 0) {
      return errorJson("ACCURACY_NOT_MET", "Vui lòng bật GPS để thực hiện điểm danh.");
    }

    // 5. Xác minh & ghi nhận tại Postgres (cùng một transaction logic)
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("attendance_check", {
      p_user_id: caller.user.id,
      p_action: action,
      p_latitude: latitude,
      p_longitude: longitude,
      p_accuracy: accuracy,
      p_note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
    });

    if (error) throw new AppError("DB_ERROR", error.message, 500, error);

    const result = (data ?? {}) as {
      success?: boolean;
      code?: string;
      message?: string;
      status?: string;
      action?: string;
      attendance_id?: string;
      distance_meters?: number;
    };

    if (!result.success) {
      const code = result.code ?? "ATTENDANCE_REJECTED";
      const status =
        code === "AUTH_ERROR" || code === "PERMISSION_DENIED" ? 403 : 400;
      return errorJson(code, result.message ?? "Điểm danh bị từ chối", status);
    }

    return json({
      success: true,
      action: result.action ?? action,
      status: result.status,
      message: result.message ?? "Điểm danh thành công.",
      attendance_id: result.attendance_id,
      distance_meters: result.distance_meters,
    });
  } catch (e) {
    return errorFrom(e);
  }
});
