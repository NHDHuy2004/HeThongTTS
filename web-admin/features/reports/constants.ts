// Cấu hình trường nội dung theo từng loại báo cáo.

export type ReportField = {
  key: string;
  label: string;
  required?: boolean;
  placeholder?: string;
};

export const REPORT_TYPES = [
  { code: "daily", label: "Báo cáo ngày" },
  { code: "weekly", label: "Báo cáo tuần" },
  { code: "monthly", label: "Báo cáo tháng" },
  { code: "final", label: "Báo cáo tổng kết" },
] as const;

export const REPORT_FIELDS: Record<string, ReportField[]> = {
  daily: [
    { key: "work_done", label: "Công việc đã thực hiện", required: true, placeholder: "Mô tả các công việc đã làm trong ngày" },
    { key: "work_time", label: "Thời gian làm việc", placeholder: "Ví dụ: 08:00 – 17:00 (8h)" },
    { key: "results", label: "Kết quả đạt được", required: true, placeholder: "Kết quả cụ thể của công việc" },
    { key: "difficulties", label: "Khó khăn gặp phải", placeholder: "Trở ngại trong ngày" },
    { key: "solution", label: "Cách giải quyết", placeholder: "Đã xử lý như thế nào" },
    { key: "next_plan", label: "Kế hoạch ngày tiếp theo", placeholder: "Dự kiến làm gì ngày mai" },
    { key: "note", label: "Ghi chú", placeholder: "Thông tin bổ sung (không bắt buộc)" },
  ],
  weekly: [
    { key: "completed_tasks", label: "Nhiệm vụ đã hoàn thành", required: true, placeholder: "Các nhiệm vụ đã xong trong tuần" },
    { key: "in_progress_tasks", label: "Nhiệm vụ đang thực hiện", placeholder: "Các nhiệm vụ đang làm dở" },
    { key: "progress", label: "Tiến độ công việc", placeholder: "Ví dụ: 60% module báo cáo" },
    { key: "results", label: "Kết quả đạt được", required: true, placeholder: "Kết quả tổng hợp trong tuần" },
    { key: "difficulties", label: "Khó khăn gặp phải", placeholder: "Trở ngại trong tuần" },
    { key: "solution", label: "Cách giải quyết", placeholder: "Đã xử lý như thế nào" },
    { key: "skills_learned", label: "Kiến thức / kỹ năng học được", placeholder: "Công nghệ, kỹ năng mới..." },
    { key: "next_plan", label: "Kế hoạch tuần tiếp theo", placeholder: "Dự kiến tuần sau" },
    { key: "self_evaluation", label: "Tự đánh giá", placeholder: "Đánh giá của bạn về tuần qua" },
  ],
  monthly: [
    { key: "completed_work", label: "Công việc đã hoàn thành", required: true, placeholder: "Tổng hợp công việc trong tháng" },
    { key: "progress", label: "Tiến độ các nhiệm vụ", placeholder: "Tiến độ tổng thể" },
    { key: "highlights", label: "Kết quả nổi bật", required: true, placeholder: "Thành tựu đáng chú ý" },
    { key: "skills_developed", label: "Kỹ năng chuyên môn đã phát triển", placeholder: "Kỹ năng cải thiện được" },
    { key: "difficulties", label: "Khó khăn gặp phải", placeholder: "Thách thức trong tháng" },
    { key: "goal_completion", label: "Mức độ hoàn thành mục tiêu", placeholder: "Ví dụ: Hoàn thành 80% mục tiêu" },
    { key: "next_plan", label: "Kế hoạch tháng tiếp theo", placeholder: "Dự kiến tháng sau" },
    { key: "comments", label: "Nhận xét của thực tập sinh", placeholder: "Cảm nhận của bạn" },
  ],
  final: [
    { key: "goals", label: "Mục tiêu ban đầu", required: true, placeholder: "Mục tiêu khi bắt đầu thực tập" },
    { key: "work_content", label: "Nội dung công việc đã thực hiện", required: true, placeholder: "Tổng hợp toàn bộ công việc" },
    { key: "notable_projects", label: "Dự án / nhiệm vụ tiêu biểu", placeholder: "Các dự án nổi bật" },
    { key: "results", label: "Kết quả đạt được", required: true, placeholder: "Kết quả tổng kết thực tập" },
    { key: "hard_skills", label: "Kiến thức và kỹ năng chuyên môn", placeholder: "Kỹ năng kỹ thuật học được" },
    { key: "soft_skills", label: "Kỹ năng mềm", placeholder: "Giao tiếp, làm việc nhóm..." },
    { key: "difficulties", label: "Khó khăn và cách giải quyết", placeholder: "Thách thức lớn nhất" },
    { key: "lessons", label: "Bài học kinh nghiệm", placeholder: "Bài học rút ra" },
    { key: "self_evaluation", label: "Tự đánh giá kết quả thực tập", required: true, placeholder: "Đánh giá tổng thể của bạn" },
    { key: "future_direction", label: "Định hướng phát triển", placeholder: "Kế hoạch trong tương lai" },
  ],
};

export const REPORT_STATUS_FILTERS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "draft", label: "Nháp" },
  { value: "submitted", label: "Đã nộp" },
  { value: "in_review", label: "Đang xem xét" },
  { value: "needs_revision", label: "Cần chỉnh sửa" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Từ chối" },
  { value: "cancelled", label: "Đã hủy" },
] as const;

export const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/** Parse textarea "mỗi dòng1 link" thành mảng { url, label }. */
export function parseLinks(text: string): { url: string; label?: string }[] {
  const out: { url: string; label?: string }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(/^(https?:\/\/\S+)\s*(?:[-–—:]\s*(.+))?$/);
    if (match) {
      out.push(match[2] ? { url: match[1], label: match[2].trim() } : { url: match[1] });
    } else if (line.startsWith("http")) {
      out.push({ url: line });
    }
  }
  return out;
}

/** Ghi mảng { url, label } trở lại textarea. */
export function linksToText(links: unknown): string {
  if (!Array.isArray(links)) return "";
  return links
    .map((l) => {
      if (l && typeof l === "object" && "url" in l) {
        const item = l as { url?: string; label?: string };
        return item.label ? `${item.url} - ${item.label}` : (item.url ?? "");
      }
      return typeof l === "string" ? l : "";
    })
    .filter(Boolean)
    .join("\n");
}
