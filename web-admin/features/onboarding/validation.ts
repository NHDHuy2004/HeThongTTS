import { z } from "zod";

import { ONBOARDING_CATEGORIES } from "./constants";
import type { ActionState } from "./types";

const uuidSchema = z.string().uuid("Mã định danh không hợp lệ.");
const optionalUuidSchema = z.union([
  z.literal(""),
  uuidSchema,
]);
const optionalDateSchema = z.union([
  z.literal(""),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ."),
]);
const booleanSchema = z.union([z.literal("on"), z.literal("true"), z.boolean()]).transform(Boolean);

export const createOnboardingRecordSchema = z
  .object({
    internship_id: uuidSchema,
    assigned_hr_id: uuidSchema,
    onboarding_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    template_id: uuidSchema,
    notes: z.string().trim().max(2000).optional().default(""),
  })
  .refine((value) => value.due_date >= value.onboarding_start_date, {
    path: ["due_date"],
    message: "Hạn hoàn thành phải sau ngày bắt đầu onboarding.",
  });

export const updateOnboardingRecordSchema = z
  .object({
    assigned_hr_id: uuidSchema,
    start_date: optionalDateSchema,
    end_date: optionalDateSchema,
    onboarding_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    department_id: optionalUuidSchema.transform((value) => value || null),
    mentor_id: optionalUuidSchema.transform((value) => value || null),
    notes: z.string().trim().max(2000).optional().default(""),
  })
  .refine((value) => value.due_date >= value.onboarding_start_date, {
    path: ["due_date"],
    message: "Hạn hoàn thành phải sau ngày bắt đầu onboarding.",
  })
  .refine((value) => !value.start_date || !value.end_date || value.end_date >= value.start_date, {
    path: ["end_date"],
    message: "Ngày kết thúc phải sau ngày bắt đầu.",
  });

export const checklistItemSchema = z.object({
  title: z.string().trim().min(3, "Nhập tên công việc.").max(200),
  description: z.string().trim().max(3000).optional().default(""),
  category: z.enum(ONBOARDING_CATEGORIES as [string, ...string[]]),
  assigned_to: optionalUuidSchema.transform((value) => value || null),
  start_date: optionalDateSchema.transform((value) => value || null),
  due_date: optionalDateSchema.transform((value) => value || null),
  is_required: booleanSchema,
  review_required: booleanSchema,
  guide_document_id: optionalUuidSchema.transform((value) => value || null),
  status: z
    .enum(["not_started", "in_progress", "pending_review", "needs_revision", "completed", "cancelled"])
    .optional(),
  feedback: z.string().trim().max(3000).optional().default(""),
});

export const documentRequestSchema = z.object({
  catalog_document_id: optionalUuidSchema.transform((value) => value || null),
  document_name: z.string().trim().min(3, "Nhập tên tài liệu.").max(200),
  document_type: z.string().trim().min(2).max(50),
  description: z.string().trim().max(3000).optional().default(""),
  is_required: booleanSchema,
  visible_to_mentor: booleanSchema,
  due_date: optionalDateSchema.transform((value) => value || null),
});

export const internProfileSchema = z.object({
  full_name: z.string().trim().min(2, "Nhập họ tên.").max(150),
  phone: z.string().trim().max(30).optional().default(""),
  address: z.string().trim().max(500).optional().default(""),
  emergency_contact_name: z.string().trim().max(150).optional().default(""),
  emergency_contact_phone: z.string().trim().max(30).optional().default(""),
  emergency_contact_email: z.union([z.literal(""), z.string().email("Email liên hệ không hợp lệ.")]),
});

export const reasonSchema = z.object({
  reason: z.string().trim().min(5, "Vui lòng nhập lý do.").max(2000),
});

export const templateSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{3,50}$/, "Mã mẫu chỉ gồm chữ in hoa, số và dấu gạch dưới."),
  name: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional().default(""),
  is_active: booleanSchema,
});

export const templateItemSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(3000).optional().default(""),
  category: z.enum(ONBOARDING_CATEGORIES as [string, ...string[]]),
  is_required: booleanSchema,
  due_offset_days: z.coerce.number().int().min(-365).max(365).optional(),
  default_assignee_role: z.enum(["intern", "mentor", "hr"]),
  guide_document_id: optionalUuidSchema.transform((value) => value || null),
});

export const documentTypeSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,50}$/, "Mã loại tài liệu không hợp lệ."),
  name: z.string().trim().min(3).max(150),
  description: z.string().trim().max(1000).optional().default(""),
  is_required_default: booleanSchema,
  is_active: booleanSchema,
});

export const documentUploadSchema = z.object({
  documentId: uuidSchema,
  filePath: z.string().regex(
    /^records\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/documents\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/]+$/,
  ),
  fileName: z.string().trim().min(1).max(180),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
  mimeType: z.enum([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
});

export function formObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export function toActionState(error: unknown): ActionState {
  if (error && typeof error === "object" && "flatten" in error) {
    const flattened = (error as z.ZodError).flatten();
    return {
      error: "Dữ liệu biểu mẫu chưa hợp lệ.",
      fieldErrors: Object.fromEntries(
        Object.entries(flattened.fieldErrors).filter(
          (entry): entry is [string, string[]] => Array.isArray(entry[1]),
        ),
      ),
    };
  }

  return { error: friendlyOnboardingError(error) };
}

export function friendlyOnboardingError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "Không thể xử lý yêu cầu.");

  const mappings: Array<[RegExp, string]> = [
    [/PERMISSION_DENIED/i, "Bạn không có quyền thực hiện thao tác này."],
    [/REQUIRED_CHECKLIST_INCOMPLETE/i, "Còn checklist bắt buộc chưa được duyệt hoàn tất."],
    [/REQUIRED_DOCUMENT_NOT_APPROVED/i, "Còn tài liệu bắt buộc chưa được duyệt."],
    [/ONBOARDING_NOT_COMPLETED/i, "Onboarding chưa được HR xác nhận hoàn tất."],
    [/ONBOARDING_NOT_PENDING_REVIEW|DOCUMENT_VERSION_NOT_PENDING_REVIEW/i, "Tài liệu hiện tại không ở trạng thái chờ duyệt."],
    [/CHECKLIST_NOT_PENDING_REVIEW/i, "Checklist hiện tại không ở trạng thái chờ duyệt."],
    [/DOCUMENT_FILE_SIZE_INVALID|DOCUMENT_SIZE_MISMATCH/i, "Tệp vượt quá giới hạn 10 MB."],
    [/DOCUMENT_MIME_INVALID|DOCUMENT_MIME_MISMATCH/i, "Định dạng tệp không được phép."],
    [/ONBOARDING_LOCKED/i, "Hồ sơ đã hoàn tất hoặc bị hủy. Hãy mở lại trước khi chỉnh sửa."],
    [/INVALID_ONBOARDING_DATES|INVALID_INTERNSHIP_DATES/i, "Khoảng ngày không hợp lệ."],
    [/INTERNSHIP_NOT_ONBOARDABLE|INTERNSHIP_NOT_ACTIVATABLE/i, "Kỳ thực tập hiện không ở trạng thái phù hợp."],
    [/ONBOARDING_INTERNSHIP_IDENTITY_IMMUTABLE/i, "Không thể đổi thực tập sinh hoặc đợt thực tập của hồ sơ đã tạo."],
    [/REVIEW_FEEDBACK_REQUIRED|CHECKLIST_FEEDBACK_REQUIRED|DOCUMENT_FEEDBACK_REQUIRED/i, "Vui lòng nhập lý do cần chỉnh sửa."],
    [/INTERN_ACCOUNT_NOT_LINKED/i, "Thực tập sinh chưa liên kết tài khoản. Hãy tạo tài khoản trước."],
    [/INVALID_ASSIGNED_HR/i, "Người phụ trách không hợp lệ."],
    [/ONBOARDING_NOT_EDITABLE/i, "Hồ sơ đã hoàn tất hoặc bị hủy. Hãy mở lại trước khi chỉnh sửa."],
    [/INVALID_ONBOARDING_STATE/i, "Trạng thái hồ sơ hiện tại không cho phép thao tác này."],
    [/CHECKLIST_NOT_ASSIGNED/i, "Mục checklist này không được giao cho bạn."],
    [/ONBOARDING_NOT_FOUND/i, "Không tìm thấy hồ sơ onboarding."],
    [/DOCUMENT_FILE_NOT_OWNED/i, "Bạn không sở hữu tệp này."],
    [/ONBOARDING_RECORD_EXISTS/i, "Kỳ thực tập này đã có hồ sơ onboarding."],
    [/DUPLICATE|unique|already exists/i, "Dữ liệu đã tồn tại."],
  ];

  return mappings.find(([pattern]) => pattern.test(message))?.[1] ?? message;
}
