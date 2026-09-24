import { createAdminClient } from "../_shared/supabase.ts";
import { AppError, errorFrom, errorJson } from "../_shared/errors.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getCallerUser } from "../_shared/auth.ts";

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

function toDateTime(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return vn.toISOString().replace("T", " ").slice(0, 16);
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "GET") {
      return errorJson("METHOD_NOT_ALLOWED", "Chỉ hỗ trợ GET", 405);
    }

    const url = new URL(req.url);
    const internshipId = url.searchParams.get("internship_id");
    if (!internshipId) return errorJson("VALIDATION_ERROR", "Thiếu internship_id");

    const caller = await getCallerUser(req);
    if (!caller?.role) return errorJson("AUTH_ERROR", "Vui lòng đăng nhập", 401);

    const supabase = createAdminClient();

    // Mentor chỉ được export internship mà mình phụ trách.
    if (caller.role === "mentor") {
      const { data: ip } = await supabase
        .from("internships")
        .select("mentor_id, mentors(user_id)")
        .eq("id", internshipId)
        .maybeSingle();
      const mentor = ip?.mentors as { user_id: string } | null;
      if (mentor?.user_id !== caller.user.id) {
        return errorJson("PERMISSION_DENIED", "Bạn không phụ trách đợt này", 403);
      }
    } else if (caller.role !== "admin" && caller.role !== "hr") {
      return errorJson("PERMISSION_DENIED", "Không có quyền xuất dữ liệu", 403);
    }

    const { data: rows, error } = await supabase
      .from("attendance")
      .select(
        "work_date, check_in_at, check_out_at, status, note, is_geo_validated, interns(student_code, full_name, email), attendance_locations(name), internships(batch_id, internship_batches(name))",
      )
      .eq("internship_id", internshipId)
      .order("work_date", { ascending: true })
      .order("interns(student_code)", { ascending: true });

    if (error) throw new AppError("DB_ERROR", error.message, 500, error);

    const header = [
      "Mã SV",
      "Họ tên",
      "Email",
      "Ngày",
      "Check-in",
      "Check-out",
      "Trạng thái",
      "Địa điểm",
      "GPS xác thực",
      "Ghi chú",
    ];

    const lines = [header.join(",")];
    for (const r of rows ?? []) {
      const intern = r.interns as { student_code?: string; full_name?: string; email?: string } | null;
      const loc = r.attendance_locations as { name?: string } | null;
      lines.push([
        escapeCsv(intern?.student_code ?? ""),
        escapeCsv(intern?.full_name ?? ""),
        escapeCsv(intern?.email ?? ""),
        escapeCsv(r.work_date),
        escapeCsv(toDateTime(r.check_in_at)),
        escapeCsv(toDateTime(r.check_out_at)),
        escapeCsv(STATUS_VI[r.status] ?? r.status),
        escapeCsv(loc?.name ?? ""),
        escapeCsv(r.is_geo_validated ? "Có" : "Không"),
        escapeCsv(r.note ?? ""),
      ].join(","));
    }

    const csv = "\uFEFF" + lines.join("\r\n"); // BOM để Excel hiển thị tiếng Việt
    const batchName = rows?.[0]?.internships as
      | { batch_id?: string; internship_batches?: { name?: string } | null }
      | null;

    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-${internshipId.slice(0, 8)}.csv"`,
      },
    });
  } catch (e) {
    return errorFrom(e);
  }
});