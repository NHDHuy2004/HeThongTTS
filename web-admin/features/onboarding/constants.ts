import type {
  OnboardingChecklistStatus,
  OnboardingDocumentStatus,
  OnboardingRecordStatus,
} from "@/types/database";

export const ONBOARDING_RECORD_STATUSES: OnboardingRecordStatus[] = [
  "not_started",
  "in_progress",
  "pending_review",
  "needs_revision",
  "completed",
  "cancelled",
];

export const ONBOARDING_CHECKLIST_STATUSES: OnboardingChecklistStatus[] = [
  "not_started",
  "in_progress",
  "pending_review",
  "needs_revision",
  "completed",
  "cancelled",
];

export const ONBOARDING_DOCUMENT_STATUSES: OnboardingDocumentStatus[] = [
  "not_submitted",
  "pending_review",
  "approved",
  "needs_revision",
];

export const ONBOARDING_CATEGORIES = [
  "A. Hồ sơ cá nhân",
  "B. Hồ sơ và thủ tục",
  "C. Tiếp nhận công việc",
  "D. Chuẩn bị ngày đầu tiên",
  "Khác",
];

export const ONBOARDING_DOCUMENT_CODES = [
  "cv",
  "internship_letter",
  "personal_form",
  "identity",
  "confidentiality",
  "policy",
  "other",
];

export const ONBOARDING_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const ONBOARDING_MAX_FILE_SIZE = 10 * 1024 * 1024;
