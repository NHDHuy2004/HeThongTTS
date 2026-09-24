import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthErrorMessage } from "@/lib/errors";

const STATUS_VI: Record<string, string> = {
  present: "Có mặt",
  late: "Đi muộn",
  absent: "Vắng mặt",
  leave: "Nghỉ phép",
  wfh: "Làm từ xa",
  early_leave: "Về sớm",
  weekend: "Cuối tuần",
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

export async function GET(request: NextRequest) {
  try {
    const internshipId = request.nextUrl.searchParams.get("internship_id");
    const supabase = createAdminClient();

    let query = supabase
      .from("attendance")
      .select(
        "work_date, check_in_at, check_out_at, status, note, is_geo_validated, interns(student_code, full_name, email), attendance_locations(name)",
      );

    if (internshipId) query = query.eq("internship_id", internshipId);

    const { data: rows, error } = await query
      .order("work_date", { ascending: true })
      .order("interns(student_code)", { ascending: true })
      .limit(10000);

    if (error) {
      return Response.json({ error: getAuthErrorMessage(error) }, { status: 500 });
    }

    const header = ["Mã SV", "Họ tên", "Email", "Ngày", "Check-in", "Check-out", "Trạng thái", "Địa điểm", "GPS xác thực", "Ghi chú"];
    const lines = [header.join(",")];

    for (const r of (rows ?? []) as Array<{
      work_date: string;
      check_in_at: string | null;
      check_out_at: string | null;
      status: string;
      note: string | null;
      is_geo_validated: boolean;
      interns: { student_code: string | null; full_name: string | null; email: string | null } | null;
      attendance_locations: { name: string | null } | null;
    }>) {
      lines.push([
        escapeCsv(r.interns?.student_code ?? ""),
        escapeCsv(r.interns?.full_name ?? ""),
        escapeCsv(r.interns?.email ?? ""),
        escapeCsv(r.work_date),
        escapeCsv(toVN(r.check_in_at)),
        escapeCsv(toVN(r.check_out_at)),
        escapeCsv(STATUS_VI[r.status] ?? r.status),
        escapeCsv(r.attendance_locations?.name ?? ""),
        escapeCsv(r.is_geo_validated ? "Có" : "Không"),
        escapeCsv(r.note ?? ""),
      ].join(","));
    }

    const csv = "\uFEFF" + lines.join("\r\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Đã xảy ra lỗi";
    return Response.json({ error: msg }, { status: 500 });
  }
}