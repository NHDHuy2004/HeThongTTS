"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";
import {
  checklistItemSchema,
  createOnboardingRecordSchema,
  documentRequestSchema,
  documentTypeSchema,
  documentUploadSchema,
  formObject,
  friendlyOnboardingError,
  internProfileSchema,
  reasonSchema,
  templateItemSchema,
  templateSchema,
  toActionState,
  updateOnboardingRecordSchema,
} from "./validation";
import type { ActionResult, ActionState } from "./types";

async function requireRoles(roles: UserRole[]) {
  const session = await requireAuth();
  const supabase = await createClient();
  const { data: roleData } = await supabase.rpc("get_my_role");
  const role = roleData as UserRole | null;

  if (!role || !roles.includes(role)) {
    throw new Error("PERMISSION_DENIED");
  }

  return { role, supabase, userId: session.user.id };
}

function revalidateOnboarding(recordId?: string) {
  revalidatePath("/admin/onboarding");
  revalidatePath("/mentor/onboarding");
  revalidatePath("/intern/onboarding");
  revalidatePath("/onboarding");
  if (recordId) {
    revalidatePath(`/admin/onboarding/${recordId}`);
    revalidatePath(`/mentor/onboarding/${recordId}`);
  }
}

export async function createOnboardingRecordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRoles(["admin", "hr"]);
    const input = createOnboardingRecordSchema.parse(formObject(formData));
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_onboarding_record", {
      p_internship_id: input.internship_id,
      p_assigned_hr_id: input.assigned_hr_id,
      p_onboarding_start_date: input.onboarding_start_date,
      p_due_date: input.due_date,
      p_template_id: input.template_id,
      p_notes: input.notes || null,
    });

    if (error) throw error;
    revalidateOnboarding(typeof data === "string" ? data : undefined);

    return {
      success: "Đã tạo hồ sơ onboarding và áp dụng mẫu checklist.",
      recordId: typeof data === "string" ? data : undefined,
    };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return toActionState(error);
  }
}

function rethrowIfNextRedirect(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).includes("NEXT_REDIRECT")
  ) {
    throw error;
  }
}

export async function updateOnboardingRecordAction(
  recordId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRoles(["admin", "hr"]);
    const input = updateOnboardingRecordSchema.parse(formObject(formData));
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_onboarding_record", {
      p_onboarding_id: recordId,
      p_assigned_hr_id: input.assigned_hr_id,
      p_start_date: input.start_date || null,
      p_end_date: input.end_date || null,
      p_onboarding_start_date: input.onboarding_start_date,
      p_due_date: input.due_date,
      p_department_id: input.department_id,
      p_mentor_id: input.mentor_id,
      p_notes: input.notes || null,
    });

    if (error) throw error;
    revalidateOnboarding(recordId);
    return { success: "Đã cập nhật hồ sơ onboarding." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return toActionState(error);
  }
}

export async function createChecklistItemAction(
  recordId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase } = await requireRoles(["admin", "hr"]);
    const input = checklistItemSchema.parse(formObject(formData));
    const { data: lastItem } = await supabase
      .from("onboarding_checklist_items")
      .select("sort_order")
      .eq("onboarding_id", recordId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("onboarding_checklist_items").insert({
      onboarding_id: recordId,
      title: input.title,
      description: input.description || null,
      category: input.category,
      assigned_to: input.assigned_to,
      performer_id: input.assigned_to,
      start_date: input.start_date,
      due_date: input.due_date,
      is_required: input.is_required,
      review_required: input.review_required,
      guide_document_id: input.guide_document_id,
      sort_order: (lastItem?.sort_order ?? 0) + 10,
    });

    if (error) throw error;
    revalidateOnboarding(recordId);
    return { success: "Đã thêm checklist." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return toActionState(error);
  }
}

export async function updateChecklistItemAction(
  itemId: string,
  recordId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRoles(["admin", "hr"]);
    const input = checklistItemSchema.parse(formObject(formData));

    if (input.status === "needs_revision" && !input.feedback) {
      return { error: "Vui lòng nhập lý do cần chỉnh sửa." };
    }

    const supabase = await createClient();
    const { error, data: updated } = await supabase
      .from("onboarding_checklist_items")
      .update({
        title: input.title,
        description: input.description || null,
        category: input.category,
        assigned_to: input.assigned_to,
        performer_id: input.assigned_to,
        start_date: input.start_date,
        due_date: input.due_date,
        is_required: input.is_required,
        review_required: input.review_required,
        guide_document_id: input.guide_document_id,
        status: input.status,
        feedback: input.feedback || null,
      })
      .eq("id", itemId)
      .eq("onboarding_id", recordId)
      .select("id");

    if (error) throw error;
    if (!updated?.length) return { error: "Không tìm thấy checklist để cập nhật." };
    revalidateOnboarding(recordId);
    return { success: "Đã cập nhật checklist." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return toActionState(error);
  }
}

export async function deleteChecklistItemAction(
  itemId: string,
  recordId: string,
): Promise<ActionResult> {
  try {
    await requireRoles(["admin", "hr"]);
    const supabase = await createClient();
    const { error, data: deleted } = await supabase
      .from("onboarding_checklist_items")
      .delete()
      .eq("id", itemId)
      .eq("onboarding_id", recordId)
      .select("id");

    if (error) throw error;
    if (!deleted?.length) return { error: "Không tìm thấy checklist để xóa." };
    revalidateOnboarding(recordId);
    return { success: "Đã xóa checklist." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return { error: friendlyOnboardingError(error) };
  }
}

export async function reviewChecklistItemAction(
  itemId: string,
  recordId: string,
  decision: "approved" | "needs_revision",
  feedback?: string,
): Promise<ActionResult> {
  try {
    await requireRoles(["admin", "hr", "mentor"]);
    const supabase = await createClient();
    const { error } = await supabase.rpc("review_onboarding_checklist_item", {
      p_item_id: itemId,
      p_decision: decision,
      p_feedback: feedback?.trim() || null,
    });

    if (error) throw error;
    revalidateOnboarding(recordId);
    return { success: decision === "approved" ? "Đã duyệt checklist." : "Đã yêu cầu chỉnh sửa." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return { error: friendlyOnboardingError(error) };
  }
}

export async function submitChecklistItemAction(
  itemId: string,
  recordId: string,
  status: "in_progress" | "pending_review" | "completed",
): Promise<ActionResult> {
  try {
    await requireRoles(["intern", "mentor"]);
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_onboarding_checklist_item", {
      p_item_id: itemId,
      p_status: status,
    });

    if (error) throw error;
    revalidateOnboarding(recordId);
    return {
      success: status === "pending_review"
        ? "Đã gửi checklist để HR duyệt."
        : status === "completed"
          ? "Đã hoàn thành checklist."
          : "Đã bắt đầu công việc.",
    };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return { error: friendlyOnboardingError(error) };
  }
}

export async function createDocumentRequestAction(
  recordId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRoles(["admin", "hr"]);
    const input = documentRequestSchema.parse(formObject(formData));
    const supabase = await createClient();
    const { data: documentType } = await supabase
      .from("onboarding_document_types")
      .select("id")
      .eq("code", input.document_type)
      .eq("is_active", true)
      .maybeSingle();
    if (!documentType) return { error: "Loại tài liệu không còn khả dụng." };
    const { error } = await supabase.from("onboarding_documents").insert({
      onboarding_id: recordId,
      catalog_document_id: input.catalog_document_id,
      document_name: input.document_name,
      document_type: input.document_type,
      description: input.description || null,
      is_required: input.is_required,
      visible_to_mentor: input.visible_to_mentor,
      due_date: input.due_date,
    });

    if (error) throw error;
    revalidateOnboarding(recordId);
    return { success: "Đã yêu cầu tài liệu." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return toActionState(error);
  }
}

export async function reviewOnboardingDocumentAction(
  documentId: string,
  recordId: string,
  versionId: string,
  approved: boolean,
  feedback?: string,
): Promise<ActionResult> {
  try {
    await requireRoles(["admin", "hr"]);
    const supabase = await createClient();
    const { error } = await supabase.rpc("review_onboarding_document", {
      p_document_id: documentId,
      p_version_id: versionId,
      p_approved: approved,
      p_feedback: feedback?.trim() || null,
    });

    if (error) throw error;
    revalidateOnboarding(recordId);
    return { success: approved ? "Đã duyệt tài liệu." : "Đã yêu cầu bổ sung tài liệu." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return { error: friendlyOnboardingError(error) };
  }
}

export async function finalizeOnboardingDocumentUpload(input: {
  documentId: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}): Promise<ActionResult> {
  try {
    await requireRoles(["intern"]);
    const parsed = documentUploadSchema.parse(input);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_onboarding_document_version", {
      p_document_id: parsed.documentId,
      p_file_path: parsed.filePath,
      p_file_name: parsed.fileName,
      p_file_size: parsed.fileSize,
      p_mime_type: parsed.mimeType,
    });

    if (error) throw error;
    revalidatePath("/intern/onboarding");
    return {
      success: "Đã nộp tài liệu và gửi HR duyệt.",
      versionId: typeof data === "string" ? data : undefined,
    };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return { error: friendlyOnboardingError(error) };
  }
}

export async function getOnboardingDocumentUrl(input: {
  versionId?: string;
  catalogDocumentId?: string;
}): Promise<ActionResult> {
  try {
    await requireRoles(["admin", "hr", "mentor", "intern"]);
    if (!input.versionId && !input.catalogDocumentId) {
      return { error: "Không tìm thấy tệp tài liệu." };
    }

    const supabase = await createClient();
    let path: string | null = null;
    let fileName = "onboarding-document";

    if (input.versionId) {
      const { data, error } = await supabase
        .from("onboarding_document_versions")
        .select("file_path, file_name")
        .eq("id", input.versionId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { error: "Không tìm thấy phiên bản tài liệu." };
      path = data.file_path;
      fileName = data.file_name;
    } else {
      const { data, error } = await supabase
        .from("documents")
        .select("file_path, file_url, file_name, title")
        .eq("id", input.catalogDocumentId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { error: "Không tìm thấy tài liệu." };
      if (data.file_url) return { url: data.file_url };
      path = data.file_path;
      fileName = data.file_name ?? data.title;
    }

    if (!path) return { error: "Tài liệu chưa có tệp đính kèm." };
    const { data, error } = await supabase.storage
      .from("onboarding")
      .createSignedUrl(path, 60, { download: fileName });
    if (error) throw error;
    return { url: data.signedUrl };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return { error: friendlyOnboardingError(error) };
  }
}

export async function completeOnboardingAction(recordId: string): Promise<ActionResult> {
  try {
    await requireRoles(["admin", "hr"]);
    const supabase = await createClient();
    const { error } = await supabase.rpc("complete_onboarding", {
      p_onboarding_id: recordId,
    });
    if (error) throw error;
    revalidateOnboarding(recordId);
    return { success: "Đã xác nhận hoàn tất onboarding." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return { error: friendlyOnboardingError(error) };
  }
}

export async function cancelOnboardingAction(
  recordId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    await requireRoles(["admin", "hr"]);
    const input = reasonSchema.parse({ reason });
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_onboarding", {
      p_onboarding_id: recordId,
      p_reason: input.reason,
    });
    if (error) throw error;
    revalidateOnboarding(recordId);
    return { success: "Đã hủy hồ sơ onboarding." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return { error: friendlyOnboardingError(error) };
  }
}

export async function reopenOnboardingAction(
  recordId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    await requireRoles(["admin", "hr"]);
    const input = reasonSchema.parse({ reason });
    const supabase = await createClient();
    const { error } = await supabase.rpc("reopen_onboarding", {
      p_onboarding_id: recordId,
      p_reason: input.reason,
    });
    if (error) throw error;
    revalidateOnboarding(recordId);
    return { success: "Đã mở lại hồ sơ onboarding." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return { error: friendlyOnboardingError(error) };
  }
}

export async function sendOnboardingInviteAction(recordId: string): Promise<ActionResult> {
  try {
    await requireRoles(["admin", "hr"]);
    const supabase = await createClient();
    const { data: record, error: recordError } = await supabase
      .from("onboarding_records")
      .select("id, status")
      .eq("id", recordId)
      .maybeSingle();
    if (recordError) throw recordError;
    if (!record) return { error: "Không tìm thấy hồ sơ onboarding trong phạm vi quản lý." };
    if (["completed", "cancelled"].includes(record.status)) {
      return { error: "Không thể gửi email cho hồ sơ đã đóng." };
    }
    const { error: functionError } = await supabase.functions.invoke("send-welcome-email", {
      body: {
        onboarding_id: recordId,
        template: "welcome",
      },
    });
    if (functionError) throw functionError;
    revalidateOnboarding(recordId);
    return { success: "Đã gửi email onboarding." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return { error: friendlyOnboardingError(error) };
  }
}

export async function activateInternshipAction(
  recordId: string,
  internshipId: string,
): Promise<ActionResult> {
  try {
    await requireRoles(["admin", "hr"]);
    const supabase = await createClient();
    const { error } = await supabase.rpc("activate_internship", {
      p_internship_id: internshipId,
    });
    if (error) throw error;
    revalidateOnboarding(recordId);
    return { success: "Đã chuyển thực tập sinh sang kỳ thực tập chính thức." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return { error: friendlyOnboardingError(error) };
  }
}

export async function updateInternOnboardingProfileAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRoles(["intern"]);
    const input = internProfileSchema.parse(formObject(formData));
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_my_onboarding_profile", {
      p_full_name: input.full_name,
      p_phone: input.phone || null,
      p_address: input.address || null,
      p_emergency_contact_name: input.emergency_contact_name || null,
      p_emergency_contact_phone: input.emergency_contact_phone || null,
      p_emergency_contact_email: input.emergency_contact_email || null,
    });
    if (error) throw error;
    revalidatePath("/intern/onboarding");
    return { success: "Đã cập nhật thông tin cá nhân." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return toActionState(error);
  }
}

export async function markOnboardingNotificationRead(notificationId: string): Promise<ActionResult> {
  try {
    await requireRoles(["admin", "hr", "mentor", "intern"]);
    const supabase = await createClient();
    const { error, data: read } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .is("read_at", null)
      .select("id");
    if (error) throw error;
    if (!read?.length) return { error: "Không tìm thấy thông báo chưa đọc." };
    revalidatePath("/intern/onboarding");
    return { success: "Đã đánh dấu đã đọc." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return { error: friendlyOnboardingError(error) };
  }
}

export async function createOnboardingTemplateAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRoles(["admin"]);
    const input = templateSchema.parse(formObject(formData));
    const supabase = await createClient();
    const { error } = await supabase.from("onboarding_checklist_templates").insert({
      code: input.code,
      name: input.name,
      description: input.description || null,
      is_active: input.is_active,
    });
    if (error) throw error;
    revalidatePath("/admin/onboarding/templates");
    revalidatePath("/admin/onboarding");
    return { success: "Đã tạo mẫu checklist." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return toActionState(error);
  }
}

export async function createOnboardingTemplateItemAction(
  templateId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRoles(["admin"]);
    const input = templateItemSchema.parse(formObject(formData));
    const supabase = await createClient();
    const { data: lastItem } = await supabase
      .from("onboarding_checklist_template_items")
      .select("sort_order")
      .eq("template_id", templateId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("onboarding_checklist_template_items").insert({
      template_id: templateId,
      title: input.title,
      description: input.description || null,
      category: input.category,
      is_required: input.is_required,
      due_offset_days: input.due_offset_days ?? 0,
      default_assignee_role: input.default_assignee_role,
      guide_document_id: input.guide_document_id,
      sort_order: (lastItem?.sort_order ?? 0) + 10,
    });
    if (error) throw error;
    revalidatePath("/admin/onboarding/templates");
    return { success: "Đã thêm mục vào mẫu." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return toActionState(error);
  }
}

export async function toggleOnboardingTemplateAction(templateId: string): Promise<ActionResult> {
  try {
    await requireRoles(["admin"]);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("onboarding_checklist_templates")
      .select("is_active")
      .eq("id", templateId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { error: "Không tìm thấy mẫu checklist." };
    const { error: updateError } = await supabase
      .from("onboarding_checklist_templates")
      .update({ is_active: !data.is_active })
      .eq("id", templateId);
    if (updateError) throw updateError;
    revalidatePath("/admin/onboarding/templates");
    revalidatePath("/admin/onboarding");
    return { success: data.is_active ? "Đã vô hiệu hóa mẫu." : "Đã kích hoạt mẫu." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return { error: friendlyOnboardingError(error) };
  }
}

export async function createCatalogDocumentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRoles(["admin", "hr"]);
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const documentType = String(formData.get("document_type") ?? "").trim();
    const isRequired = formData.get("is_required") === "true";
    const isGuidance = formData.get("is_guidance") === "true";
    if (title.length < 3 || !documentType) return { error: "Nhập tên và loại tài liệu." };
    const supabase = await createClient();
    const { data: type } = await supabase
      .from("onboarding_document_types")
      .select("id")
      .eq("code", documentType)
      .eq("is_active", true)
      .maybeSingle();
    if (!type) return { error: "Loại tài liệu không khả dụng." };
    const { error } = await supabase.from("documents").insert({
      title,
      description: description || null,
      bucket: "onboarding",
      document_type: documentType,
      is_required_default: isRequired,
      is_guidance: isGuidance,
    });
    if (error) throw error;
    revalidatePath("/admin/onboarding/templates");
    revalidatePath("/admin/onboarding");
    return { success: "Đã tạo tài liệu trong thư viện. Hãy tải tệp hướng dẫn nếu cần." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return toActionState(error);
  }
}

export async function finalizeCatalogDocumentUpload(input: {
  documentId: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}): Promise<ActionResult> {
  try {
    await requireRoles(["admin", "hr"]);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/]+$/i.test(input.filePath)
      || !input.filePath.startsWith(`${input.documentId}/`)) {
      return { error: "Đường dẫn tệp không hợp lệ." };
    }
    if (input.fileSize <= 0 || input.fileSize > 10 * 1024 * 1024) {
      return { error: "Tệp vượt quá giới hạn 10 MB." };
    }
    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(input.mimeType)) return { error: "Định dạng tệp không được phép." };
    const supabase = await createClient();
    const { data: document } = await supabase
      .from("documents")
      .select("id, version")
      .eq("id", input.documentId)
      .maybeSingle();
    if (!document) return { error: "Không tìm thấy tài liệu." };
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        file_path: input.filePath,
        file_name: input.fileName,
        file_size: input.fileSize,
        mime_type: input.mimeType,
        file_url: null,
        version: document.version + 1,
      })
      .eq("id", input.documentId);
    if (updateError) throw updateError;
    revalidatePath("/admin/onboarding/templates");
    revalidatePath("/admin/onboarding");
    return { success: "Đã cập nhật tệp tài liệu." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return { error: friendlyOnboardingError(error) };
  }
}

export async function createOnboardingDocumentTypeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRoles(["admin"]);
    const input = documentTypeSchema.parse(formObject(formData));
    const supabase = await createClient();
    const { error } = await supabase.from("onboarding_document_types").insert({
      code: input.code,
      name: input.name,
      description: input.description || null,
      is_required_default: input.is_required_default,
      is_active: input.is_active,
    });
    if (error) throw error;
    revalidatePath("/admin/onboarding/templates");
    revalidatePath("/admin/onboarding");
    return { success: "Đã thêm loại tài liệu." };
  } catch (error) {
    rethrowIfNextRedirect(error);
    return toActionState(error);
  }
}
