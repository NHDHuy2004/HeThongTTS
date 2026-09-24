import { createAdminClient } from "../_shared/supabase.ts";
import { AppError, errorFrom, errorJson, json } from "../_shared/errors.ts";
import { handleCors } from "../_shared/cors.ts";
import { getCallerUser } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return errorJson("METHOD_NOT_ALLOWED", "Chỉ hỗ trợ POST/GET", 405);
    }

    const supabase = createAdminClient();

    // -------- GET: danh sách tổng hợp điểm theo internship --------
    if (req.method === "GET") {
      const url = new URL(req.url);
      const internshipId = url.searchParams.get("internship_id");
      if (!internshipId) return errorJson("VALIDATION_ERROR", "Thiếu internship_id");

      const caller = await getCallerUser(req);
      if (!caller?.role) return errorJson("AUTH_ERROR", "Vui lòng đăng nhập", 401);

      if (caller.role === "intern") {
        const { data: internship } = await supabase
          .from("internships")
          .select("intern_id, interns(user_id)")
          .eq("id", internshipId)
          .maybeSingle();
        const intern = internship?.interns as { user_id: string } | null;
        if (intern?.user_id !== caller.user.id) {
          return errorJson("PERMISSION_DENIED", "Bạn không có quyền xem dữ liệu này", 403);
        }
      }

      const { data, error } = await supabase
        .from("evaluations")
        .select(
          "id, type, period_label, final_score, summary, submitted_at, created_at, evaluation_scores(score, comment, evaluation_criteria(name, weight))",
        )
        .eq("internship_id", internshipId)
        .order("created_at", { ascending: false });

      if (error) throw new AppError("DB_ERROR", error.message, 500, error);
      return json({ internship_id: internshipId, evaluations: data ?? [] });
    }

    // -------- POST: tính lại điểm weighted cho evaluation --------
    const body = (await req.json().catch(() => null)) as { evaluation_id?: string } | null;
    const evaluationId = body?.evaluation_id;
    if (!evaluationId) return errorJson("VALIDATION_ERROR", "Thiếu evaluation_id");

    const caller = await getCallerUser(req);
    if (!caller?.role) return errorJson("AUTH_ERROR", "Vui lòng đăng nhập", 401);

    const { data: evaluation, error: evalErr } = await supabase
      .from("evaluations")
      .select("id, internship_id, reviewer_id")
      .eq("id", evaluationId)
      .maybeSingle();
    if (evalErr || !evaluation) {
      return errorJson("NOT_FOUND", "Không tìm thấy phiếu đánh giá", 404);
    }

    // Chỉ cho phép reviewer / mentor của internship / hr / admin
    const allowed =
      evaluation.reviewer_id === caller.user.id ||
      caller.role === "admin" ||
      caller.role === "hr" ||
      caller.role === "mentor";
    if (!allowed) {
      return errorJson("PERMISSION_DENIED", "Bạn không có quyền tính điểm đánh giá này", 403);
    }

    const { data: score, error: rpcErr } = await supabase.rpc(
      "calculate_evaluation_score",
      { p_evaluation_id: evaluationId },
    );
    if (rpcErr) throw new AppError("DB_ERROR", rpcErr.message, 500, rpcErr);

    const finalScore = Number(score);

    const { data: updated, error: updateErr } = await supabase
      .from("evaluations")
      .update({
        final_score: finalScore,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", evaluationId)
      .select("id, final_score, submitted_at")
      .single();
    if (updateErr) throw new AppError("DB_ERROR", updateErr.message, 500, updateErr);

    return json({ success: true, evaluation_id: evaluationId, final_score: finalScore, record: updated });
  } catch (e) {
    return errorFrom(e);
  }
});