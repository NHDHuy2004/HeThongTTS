import { createClient } from "@/lib/supabase/server";
import { evaluationTypeLabel } from "@/features/labels";
import { buildDocxFilename, buildEvaluationDocx, contentDisposition } from "@/lib/evaluations-docx";

export const dynamic = "force-dynamic";

/**
 * GET /api/evaluations/[id]/docx
 * Xuất phiếu đánh giá thành file Word (.docx) phía server.
 * - Xác thực người dùng (Supabase Auth).
 * - Phân quyền: admin/hr xem mọi phiếu; mentor chỉ phiếu của intern được phân công hoặc do mình đánh giá;
 *   intern chỉ phiếu của chính mình. (Kiểm tra ở backend, không chỉ ẩn nút.)
 * - Dữ liệu điểm lấy từ Database (không tin dữ liệu client).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
  }

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin" && role !== "hr" && role !== "mentor" && role !== "intern") {
    return Response.json({ error: "Bạn không có quyền xuất phiếu đánh giá." }, { status: 403 });
  }

  // Lấy phiếu + liên kết. Query chạy qua client có RLS, nên người dùng
  // không có quyền sẽ không đọc được (trả về null → 404).
  const { data: ev, error } = await supabase
    .from("evaluations")
    .select(
      "*, internships(start_date, end_date, intern_id, mentor_id, interns(full_name, student_code, email, school, major, class_name, phone), departments(name), internship_batches(name), mentors(full_name)), profiles!evaluations_reviewer_id_fkey(full_name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return Response.json({ error: "Không thể tải dữ liệu đánh giá." }, { status: 500 });
  }
  if (!ev) {
    return Response.json({ error: "Không tìm thấy phiếu đánh giá hoặc bạn không có quyền xem." }, { status: 404 });
  }

  // Kiểm tra quyền bổ sung (defense in depth) trước khi tạo file.
  const internship = (ev as unknown as { internships?: { intern_id?: string; mentor_id?: string | null } | null }).internships;
  if (role === "intern") {
    const { data: myIntern } = await supabase.from("interns").select("id").eq("user_id", user.id).maybeSingle();
    if (!myIntern || internship?.intern_id !== myIntern.id) {
      return Response.json({ error: "Bạn không có quyền tải phiếu đánh giá của người khác." }, { status: 403 });
    }
  } else if (role === "mentor") {
    const { data: mentor } = await supabase.from("mentors").select("id").eq("user_id", user.id).maybeSingle();
    const isMentor = internship?.mentor_id && mentor?.id && internship.mentor_id === mentor.id;
    const isReviewer = ev.reviewer_id === user.id;
    if (!isMentor && !isReviewer) {
      return Response.json({ error: "Bạn không có quyền tải phiếu đánh giá ngoài phạm vi." }, { status: 403 });
    }
  }

  const [{ data: criteria }, { data: scores }, { data: companyRow }] = await Promise.all([
    supabase.from("evaluation_criteria").select("id, name, category, description, weight, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("evaluation_scores").select("criterion_id, score, comment, rating_level").eq("evaluation_id", id),
    supabase.from("system_settings").select("value").eq("key", "company").maybeSingle(),
  ]);

  const internshipFull = (ev as unknown as {
    internships?: {
      start_date: string | null;
      end_date: string | null;
      interns: { full_name: string | null; student_code: string | null; email: string | null; school: string | null; major: string | null; class_name: string | null; phone: string | null } | null;
      departments: { name: string | null } | null;
      internship_batches: { name: string | null } | null;
      mentors: { full_name: string | null } | null;
    } | null;
    profiles: { full_name: string | null } | null;
  }).internships;

  const companyValue = (companyRow as { value?: { name?: string } | null } | null)?.value;
  const buffer = await buildEvaluationDocx({
    companyName: companyValue?.name ?? null,
    evaluation: {
      id: ev.id,
      type: ev.type,
      period_label: ev.period_label,
      period_start: ev.period_start ?? null,
      period_end: ev.period_end ?? null,
      due_date: ev.due_date ?? null,
      status: ev.status ?? null,
      final_score: (ev.final_score as number | null) ?? null,
      overall_level: ev.overall_level ?? null,
      summary: ev.summary ?? null,
      strengths: ev.strengths ?? null,
      needs_improvement: ev.needs_improvement ?? null,
      recommendation: ev.recommendation ?? null,
      submitted_at: ev.submitted_at ?? null,
      reviewed_at: ev.reviewed_at ?? null,
      created_at: ev.created_at ?? null,
      updated_at: ev.updated_at ?? null,
    },
    intern: internshipFull?.interns ?? null,
    internship: internshipFull ? { start_date: internshipFull.start_date, end_date: internshipFull.end_date } : null,
    departmentName: internshipFull?.departments?.name ?? null,
    batchName: internshipFull?.internship_batches?.name ?? null,
    mentorName: internshipFull?.mentors?.full_name ?? null,
    reviewerName: (ev as unknown as { profiles?: { full_name: string | null } | null }).profiles?.full_name ?? null,
    criteria: ((criteria ?? []) as unknown as Array<{ id: string; name: string; category: string; description: string | null; weight: number; sort_order: number | null }>),
    scores: ((scores ?? []) as unknown as Array<{ criterion_id: string; score: number; comment: string | null; rating_level: string | null }>),
    evaluationTypeLabel: evaluationTypeLabel[ev.type] ?? ev.type,
  });

  const filename = buildDocxFilename(
    internshipFull?.interns?.student_code,
    internshipFull?.interns?.full_name,
    ev.period_label,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": contentDisposition(filename),
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}
