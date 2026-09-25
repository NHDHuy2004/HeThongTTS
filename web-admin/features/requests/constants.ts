// Cấu hình hình thức nhập liệu theo từng loại đơn.

export type DateMode = "range" | "single" | "none";

export type TimeFieldMode = "start" | "end" | "proposed" | null;

export function dateModeFor(type: string): DateMode {
  if (type === "leave" || type === "schedule_change") return "range";
  if (type === "other") return "none";
  return "single";
}

export function timeFieldFor(type: string): TimeFieldMode {
  if (type === "late") return "start";
  if (type === "early_leave") return "end";
  if (type === "attendance_adjustment") return "proposed";
  return null;
}

/** Ghép ngày + giờ thành chuỗi ISO cho payload của đơn điều chỉnh chấm công. */
export function toIsoLocal(date: string, time: string): string | null {
  if (!date || !time) return null;
  return `${date}T${time}:00+07:00`;
}

export const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
