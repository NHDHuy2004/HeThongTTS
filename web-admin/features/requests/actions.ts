"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type RequestActionState = {
  error?: string;
  success?: string;
};

function revalidateRequests() {
  revalidatePath("/intern/requests");
  revalidatePath("/admin/requests");
  revalidatePath("/requests");
}

/** Intern tạo & gửi đơn mới (kèm đường dẫn file đã upload lên Storage). */
export async function createRequestAction(
  _previous: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  try {
    const type = String(formData.get("request_type") ?? "");
    const title = String(formData.get("title") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    const description = ((formData.get("description") as string) || "").trim() || null;
    const startDate = ((formData.get("start_date") as string) || "").trim() || null;
    const endDate = ((formData.get("end_date") as string) || "").trim() || null;
    const startTime = ((formData.get("start_time") as string) || "").trim() || null;
    const endTime = ((formData.get("end_time") as string) || "").trim() || null;
    const payloadRaw = String(formData.get("payload") ?? "").trim();
    const attachmentsRaw = String(formData.get("attachment_paths") ?? "").trim();

    if (!type) return { error: "Vui lòng chọn loại đơn." };
    if (title.length < 3) return { error: "Tiêu đề đơn phải có ít nhất 3 ký tự." };
    if (reason.length < 5) return { error: "Vui lòng nhập lý do (tối thiểu 5 ký tự)." };

    let payload: Record<string, string | null> = {};
    if (payloadRaw) {
      try {
        payload = JSON.parse(payloadRaw) as Record<string, string | null>;
      } catch {
        return { error: "Dữ liệu đề xuất không hợp lệ." };
      }
    }

    let attachments: string[] = [];
    if (attachmentsRaw) {
      try {
        const parsed = JSON.parse(attachmentsRaw) as unknown;
        if (!Array.isArray(parsed)) throw new Error("invalid");
        attachments = parsed.map((p) => String(p));
      } catch {
        return { error: "Danh sách tài liệu đính kèm không hợp lệ." };
      }
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_request", {
      p_request_type: type,
      p_title: title,
      p_reason: reason,
      p_start_date: startDate,
      p_end_date: endDate,
      p_start_time: startTime,
      p_end_time: endTime,
      p_payload: payload,
      p_description: description,
      p_attachment_paths: attachments,
    });

    if (error) return { error: error.message };

    const result = data as {
      success?: boolean;
      code?: string;
      message?: string;
      request_code?: string;
    };
    if (!result?.success) {
      return { error: result?.message ?? "Không thể tạo đơn." };
    }

    revalidateRequests();
    return { success: result.message ?? `Đã gửi đơn ${result.request_code ?? ""}.` };
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

const REVIEW_ACTIONS = new Set([
  "take",
  "approve",
  "reject",
  "request_revision",
  "cancel",
  "resubmit",
]);

/** Xử lý đơn: tiếp nhận / duyệt / từ chối / yêu cầu bổ sung / hủy / gửi lại. */
export async function reviewRequestAction(
  _previous: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  try {
    const requestId = String(formData.get("request_id") ?? "");
    const action = String(formData.get("action") ?? "");
    const comment = ((formData.get("comment") as string) || "").trim() || null;

    if (!requestId) return { error: "Thiếu mã đơn." };
    if (!REVIEW_ACTIONS.has(action)) return { error: "Hành động không hợp lệ." };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("review_request", {
      p_request_id: requestId,
      p_action: action,
      p_comment: comment,
    });

    if (error) return { error: error.message };

    const result = data as { success?: boolean; message?: string };
    if (!result?.success) {
      return { error: result?.message ?? "Không thể xử lý đơn." };
    }

    revalidateRequests();
    revalidatePath(`/admin/requests/${requestId}`);
    revalidatePath(`/intern/requests/${requestId}`);
    return { success: result.message ?? "Đã cập nhật đơn." };
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
