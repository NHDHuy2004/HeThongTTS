import { createAdminClient } from "../_shared/supabase.ts";
import { AppError, errorFrom, errorJson, json } from "../_shared/errors.ts";
import { handleCors } from "../_shared/cors.ts";
import { getCallerUser } from "../_shared/auth.ts";
import { sendFcm } from "../_shared/fcm.ts";

const ALLOWED_TYPES = [
  "task_assigned",
  "task_updated",
  "task_review_approved",
  "task_review_changes",
  "report_approved",
  "report_rejected",
  "request_approved",
  "request_rejected",
  "evaluation",
  "certificate",
  "system",
  "message",
  "onboarding_assigned",
  "onboarding_updated",
  "onboarding_due_soon",
  "onboarding_overdue",
  "onboarding_checklist_submitted",
  "onboarding_document_submitted",
  "onboarding_document_reviewed",
  "onboarding_completed",
  "onboarding_reopened",
  "onboarding_cancelled",
];

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") {
      return errorJson("METHOD_NOT_ALLOWED", "Chỉ hỗ trợ POST", 405);
    }

    const body = (await req.json().catch(() => null)) as {
      user_id?: string;
      type?: string;
      title?: string;
      body?: string;
      data?: Record<string, string>;
      push_only?: boolean;
    } | null;

    if (!body?.user_id) return errorJson("VALIDATION_ERROR", "Thiếu user_id");
    if (!body.title) return errorJson("VALIDATION_ERROR", "Thiếu title");
    if (!body.type || !ALLOWED_TYPES.includes(body.type)) {
      return errorJson("VALIDATION_ERROR", `type phải thuộc: ${ALLOWED_TYPES.join(", ")}`);
    }

    const caller = await getCallerUser(req);
    if (!caller?.role) return errorJson("AUTH_ERROR", "Vui lòng đăng nhập", 401);

    const supabase = createAdminClient();

    // Phân quyền tạo thông báo (mirror policy notifications_insert_user).
    // Admin/HR: mọi user. Mentor: chính mình hoặc intern phụ trách. Intern: chỉ mình.
    let allowedToSend = caller.user.id === body.user_id;
    if (!allowedToSend && (caller.role === "admin" || caller.role === "hr")) {
      allowedToSend = true;
    }
    if (!allowedToSend && caller.role === "mentor") {
      const { data: isMentor } = await supabase.rpc("is_mentor_of", {
        target_user_id: body.user_id,
      });
      allowedToSend = isMentor === true;
    }
    if (!allowedToSend) {
      return errorJson("PERMISSION_DENIED", "Bạn không có quyền gửi thông báo này", 403);
    }

    // push_only=true: dòng notification đã được trigger DB tạo sẵn (migration 0010),
    // đây chỉ gửi FCM để tránh bản tin trùng.
    let notification;
    let insErr;
    if (body.push_only) {
      notification = { id: body.data?.notification_id ?? null };
    } else {
      const inserted = await supabase
        .from("notifications")
        .insert({
          user_id: body.user_id,
          type: body.type as never,
          title: body.title,
          body: body.body,
          data: body.data,
        })
        .select()
        .single();
      notification = inserted.data;
      insErr = inserted.error;
    }
    if (insErr) throw new AppError("DB_ERROR", insErr.message, 500, insErr);

    // Push FCM tới mọi thiết bị của người nhận
    const { data: devices, error: devErr } = await supabase
      .from("notification_devices")
      .select("id, device_token")
      .eq("user_id", body.user_id);
    if (devErr) throw new AppError("DB_ERROR", devErr.message, 500, devErr);

    let pushed = 0;
    let removed = 0;
    for (const device of devices ?? []) {
      const ok = await sendFcm({
        token: device.device_token,
        title: body.title,
        body: body.body ?? "",
        data: { ...(body.data ?? {}), notification_id: notification.id, type: body.type },
      });
      if (ok) pushed += 1;
      else {
        await supabase.from("notification_devices").delete().eq("id", device.id);
        removed += 1;
      }
    }

    return json({
      success: true,
      notification_id: notification.id,
      devices: devices?.length ?? 0,
      pushed,
      removed,
    }, 201);
  } catch (e) {
    return errorFrom(e);
  }
});