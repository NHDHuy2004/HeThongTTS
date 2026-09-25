// Bản đồ nhãn tiếng Việt + badge variant cho toàn bộ enum nghiệp vụ.

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost";

export const statusLabel: Record<string, string> = {
  // task
  in_progress: "Đang làm",
  in_review: "Chờ duyệt",
  changes_requested: "Cần chỉnh sửa",
  // task priority
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  urgent: "Khẩn cấp",
  // intern
  pending: "Chờ xử lý",
  onboarding: "Onboarding",
  active: "Đang hoạt động",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  converted: "Đã chuyển NV",
  // batch / internship
  upcoming: "Sắp tới",
  // request
  approved: "Đã duyệt",
  rejected: "Từ chối",
  // report
  draft: "Nháp",
  submitted: "Đã nộp",
  // onboarding checklist
  not_started: "Chưa bắt đầu",
  // attendance
  present: "Có mặt",
  late: "Đi muộn",
  absent: "Vắng",
  leave: "Nghỉ phép",
  wfh: "WFH",
  early_leave: "Về sớm",
  weekend: "Cuối tuần",
  // certificate
  issued: "Đã cấp",
  revoked: "Thu hồi",
  working_day: "Ngày làm",
  holiday: "Nghỉ lễ",
};

export const statusVariant: Record<string, BadgeVariant> = {
  // positive
  approved: "default",
  issued: "default",
  present: "default",
  completed: "default",
  active: "default",
  converted: "default",
  // info / in progress
  in_progress: "secondary",
  onboarding: "secondary",
  submitted: "secondary",
  upcomming: "secondary",
  upcoming: "secondary",
  in_review: "secondary",
  changes_requested: "destructive",
  pending: "secondary",
  draft: "outline",
  not_started: "outline",
  medium: "outline",
  low: "outline",
  leave: "outline",
  wfh: "outline",
  early_leave: "outline",
  weekend: "outline",
  working_day: "outline",
  // warning
  late: "secondary",
  high: "secondary",
  urgent: "destructive",
  // negative
  rejected: "destructive",
  cancelled: "destructive",
  absent: "destructive",
  revoked: "destructive",
};

export function getStatusLabel(value?: string | null): string {
  if (!value) return "—";
  return statusLabel[value] ?? value;
}

export function getStatusVariant(value: string): BadgeVariant {
  return statusVariant[value] ?? "secondary";
}

export const roleLabel: Record<string, string> = {
  admin: "Quản trị viên",
  hr: "HR Manager",
  mentor: "Mentor",
  intern: "Thực tập sinh",
};

export const requestTypeLabel: Record<string, string> = {
  leave: "Nghỉ phép",
  wfh: "Làm từ xa",
  late: "Đi muộn",
  early_leave: "Về sớm",
  other: "Khác",
};

export const evaluationTypeLabel: Record<string, string> = {
  weekly: "Hàng tuần",
  midterm: "Giữa kỳ",
  final: "Cuối kỳ",
  feedback_360: "Feedback 360",
};

export const reportTypeLabel: Record<string, string> = {
  daily: "Báo cáo ngày",
  weekly: "Báo cáo tuần",
};

export const assignmentTypeLabel: Record<string, string> = {
  individual: "Cá nhân",
  team: "Nhóm",
};

export const reviewDecisionLabel: Record<string, string> = {
  approved: "Duyệt",
  changes_requested: "Yêu cầu sửa",
  rejected: "Từ chối",
};

export const completionLabel: Record<string, string> = {
  complete: "Hoàn thành",
  partial: "Hoàn thành một phần",
  none: "Chưa hoàn thành",
};

export const deadlineBucketLabel: Record<string, string> = {
  on_time: "Đúng hạn",
  late: "Trễ hạn",
};

export const deliverablesList = [
  { value: "source_code", label: "Source Code" },
  { value: "database_script", label: "Database Script" },
  { value: "screenshot", label: "Screenshot" },
  { value: "documentation", label: "Documentation" },
  { value: "demo_link", label: "Demo Link" },
  { value: "file", label: "File" },
] as const;

export const deliverableKindLabel: Record<string, string> = Object.fromEntries(
  deliverablesList.map((d) => [d.value, d.label]),
);

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("vi-VN");
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("vi-VN");
}