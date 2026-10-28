import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime, evaluationTypeLabel } from "@/features/labels";
import { EvaluationScoringForm } from "../scoring-form";

export default async function EvaluationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  const { id } = await params;

  const supabase = await createClient();

  const { data: evalRow, error } = await supabase
    .from("evaluations")
    .select("*, internships(id, intern_id, interns(full_name))")
    .eq("id", id)
    .maybeSingle();

  if (error || !evalRow) notFound();

  const { data: criteria = [] } = await supabase
    .from("evaluation_criteria")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  const { data: scores = [] } = await supabase
    .from("evaluation_scores")
    .select("criterion_id, score, comment")
    .eq("evaluation_id", id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: context } = await (supabase.rpc as any)("get_evaluation_context", {
    p_internship_id: evalRow.internship_id,
  });

  const canManage = role === "admin" || role === "hr" || role === "mentor";

  const att = (context as { attendance?: Record<string, unknown> } | null)?.attendance ?? {};
  const tasksRaw = (context as { tasks?: unknown } | null)?.tasks;
  const tasks = Array.isArray(tasksRaw) ? tasksRaw[0] : tasksRaw;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Đánh giá ${evaluationTypeLabel[evalRow.type] ?? evalRow.type}`}
        description={`${evalRow.internships?.interns?.full_name ?? "—"} · ${evalRow.period_label}`}
        actions={<StatusBadge value={evalRow.status ?? "draft"} />}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Attendance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            <span>Tổng ngày: <b>{String(att.total_days ?? 0)}</b></span>
            <span>Đúng giờ: <b>{String(att.present ?? 0)}</b></span>
            <span>Đi trễ: <b>{String(att.late ?? 0)}</b></span>
            <span>Về sớm: <b>{String(att.early_leave ?? 0)}</b></span>
            <span>Tỷ lệ: <b>{String(att.punctuality_rate ?? "—")}%</b></span>
            <span>Gợi ý: <b>{String(att.suggested_score ?? "—")}/10</b></span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Kết quả công việc (từ Task)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            {tasks ? (
              <>
                <span>Tổng Task: <b>{String(tasks.total ?? 0)}</b></span>
                <span>Hoàn thành: <b>{String(tasks.completed ?? 0)}</b></span>
                <span>Đang làm: <b>{String(tasks.in_progress ?? 0)}</b></span>
                <span>Quá hạn: <b>{String(tasks.overdue ?? 0)}</b></span>
                <span>Tỷ lệ hoàn thành: <b>{String(tasks.completion_rate ?? "—")}%</b></span>
                <span>Đúng hạn: <b>{String(tasks.on_time_rate ?? "—")}%</b></span>
                <span>Điểm TB Task: <b>{String(tasks.avg_score ?? "—")}</b></span>
              </>
            ) : (
              <p className="text-muted-foreground">Chưa có dữ liệu task.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Điểm đánh giá</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-x-6 text-sm">
            <span>Trạng thái: <b>{evalRow.status}</b></span>
            <span>Điểm tổng: <b>{evalRow.final_score ?? "—"}/10</b></span>
            <span>Xếp loại: <b>{evalRow.overall_level ?? "—"}</b></span>
            <span>Nộp: {evalRow.submitted_at ? formatDateTime(evalRow.submitted_at) : "—"}</span>
          </div>
          <EvaluationScoringForm
            evaluationId={evalRow.id}
            criteria={(criteria ?? []) as never[]}
            existingScores={(scores ?? []) as never[]}
            summary={evalRow.summary}
            status={evalRow.status ?? "draft"}
            canManage={canManage}
            initialStrengths={evalRow.strengths}
            initialNeedsImprovement={evalRow.needs_improvement}
            initialRecommendation={evalRow.recommendation}
          />
        </CardContent>
      </Card>
    </div>
  );
}
