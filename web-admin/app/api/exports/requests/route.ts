import { getAuthErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { requestTypeLabel } from "@/features/labels";

const STATUS_VI: Record<string, string> = {
  pending: "Chờ xử lý",
  in_review: "Đang xem xét",
  needs_revision: "Cần bổ sung",
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
      .from("requests")
      .select(
        "request_code, request_type, title, reason, start_date, end_date, status, submitted_at, reviewed_at, review_comment, rejection_reason, interns(student_code, full_name), profiles!requests_reviewer_id_fkey(full_name)",
      )
      .order("submitted_at", { ascending: true })
      .limit(10000);

    if (error) {
      return Response.json({ error: getAuthErrorMessage(error) }, { status: 500 });
    }

    const header = [
      "Mã đơn",
      "Mã SV",
      "Họ tên",
      "Loại đơn",
      "Tiêu đề",
      "Lý do",
      "Từ ngày",
      "Đến ngày",
      "Trạng thái",
      "Nộp lúc",
      "Duyệt lúc",
      "Người duyệt",
      "Ghi chú duyệt",
      "Lý do từ chối",
    ];
    const lines = [header.join(",")];

    for (const r of (rows ?? []) as Array<{
      request_code: string;
      request_type: string;
      title: string;
      reason: string;
      start_date: string | null;
      end_date: string | null;
      status: string;
      submitted_at: string;
      reviewed_at: string | null;
      review_comment: string | null;
      rejection_reason: string | null;
      interns: { student_code: string | null; full_name: string | null } | null;
      profiles: { full_name: string | null } | null;
    }>) {
      lines.push(
        [
          escapeCsv(r.request_code),
          escapeCsv(r.interns?.student_code ?? ""),
          escapeCsv(r.interns?.full_name ?? ""),
          escapeCsv(requestTypeLabel[r.request_type] ?? r.request_type),
          escapeCsv(r.title),
          escapeCsv(r.reason),
          escapeCsv(r.start_date),
          escapeCsv(r.end_date),
          escapeCsv(STATUS_VI[r.status] ?? r.status),
          escapeCsv(toVN(r.submitted_at)),
          escapeCsv(toVN(r.reviewed_at)),
          escapeCsv(r.profiles?.full_name ?? ""),
          escapeCsv(r.review_comment ?? ""),
          escapeCsv(r.rejection_reason ?? ""),
        ].join(","),
      );
    }

    const csv = "\uFEFF" + lines.join("\r\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="requests-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Đã xảy ra lỗi";
    return Response.json({ error: msg }, { status: 500 });
  }
}
