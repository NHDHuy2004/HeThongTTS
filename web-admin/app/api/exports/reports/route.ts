import { getAuthErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { reportTypeLabel } from "@/features/labels";

const STATUS_VI: Record<string, string> = {
  draft: "Nháp",
  submitted: "Đã nộp",
  in_review: "Đang xem xét",
  needs_revision: "Cần chỉnh sửa",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

function escapeCsv(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function toVN(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return vn.toISOString().replace("T", " ").slice(0, 16);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
    }

    const { data: role } = await supabase.rpc("get_my_role");
    if (role !== "admin" && role !== "hr" && role !== "mentor") {
      return Response.json(
        { error: "Bạn không có quyền xuất dữ liệu." },
        { status: 403 },
      );
    }

    const { data: rows, error } = await supabase
      .from("reports")
      .select(
        "report_code, report_type, title, period_start, period_end, status, due_date, is_late, submitted_at, reviewed_at, review_comment, rejection_reason, revision_note, interns(student_code, full_name), profiles!reports_reviewed_by_fkey(full_name)",
      )
      .order("period_start", { ascending: true })
      .limit(10000);

    if (error) {
      return Response.json({ error: getAuthErrorMessage(error) }, { status: 500 });
    }

    const header = [
      "Mã báo cáo",
      "Mã SV",
      "Họ tên",
      "Loại báo cáo",
      "Tiêu đề",
      "Kỳ từ",
      "Kỳ đến",
      "Hạn nộp",
      "Trạng thái",
      "Nộp muộn",
      "Nộp lúc",
      "Phê duyệt lúc",
      "Người duyệt",
      "Nhận xét",
      "Lý do từ chối",
      "Cần chỉnh sửa",
    ];
    const lines = [header.join(",")];

    for (const r of (rows ?? []) as Array<{
      report_code: string;
      report_type: string;
      title: string;
      period_start: string;
      period_end: string;
      status: string;
      due_date: string | null;
      is_late: boolean;
      submitted_at: string | null;
      reviewed_at: string | null;
      review_comment: string | null;
      rejection_reason: string | null;
      revision_note: string | null;
      interns: { student_code: string | null; full_name: string | null } | null;
      profiles: { full_name: string | null } | null;
    }>) {
      lines.push(
        [
          escapeCsv(r.report_code),
          escapeCsv(r.interns?.student_code ?? ""),
          escapeCsv(r.interns?.full_name ?? ""),
          escapeCsv(reportTypeLabel[r.report_type] ?? r.report_type),
          escapeCsv(r.title),
          escapeCsv(r.period_start),
          escapeCsv(r.period_end),
          escapeCsv(r.due_date),
          escapeCsv(STATUS_VI[r.status] ?? r.status),
          escapeCsv(r.is_late ? "Có" : ""),
          escapeCsv(toVN(r.submitted_at)),
          escapeCsv(toVN(r.reviewed_at)),
          escapeCsv(r.profiles?.full_name ?? ""),
          escapeCsv(r.review_comment ?? ""),
          escapeCsv(r.rejection_reason ?? ""),
          escapeCsv(r.revision_note ?? ""),
        ].join(","),
      );
    }

    const csv = "\uFEFF" + lines.join("\r\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="reports-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Đã xảy ra lỗi";
    return Response.json({ error: msg }, { status: 500 });
  }
}
