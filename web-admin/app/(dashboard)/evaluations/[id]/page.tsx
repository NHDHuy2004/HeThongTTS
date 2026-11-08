import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime, evaluationTypeLabel } from "@/features/labels";
import { EvaluationScoringForm } from "../scoring-form";
import { ExportDocxButton } from "../export-docx-button";

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium" title={value}>
        {value}
      </dd>
    </div>
  );
}

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
    .select(
      "*, internships(id, intern_id, mentor_id, start_date, end_date, interns(full_name, student_code, email, school, major, class_name, phone), departments(name), internship_batches(name, start_date, end_date), mentors(full_name)), profiles!evaluations_reviewer_id_fkey(full_name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !evalRow) notFound();

  const [{ data: criteria }, { data: scores }, { data: history }, { data: context }] = await Promise.all([
    supabase.from("evaluation_criteria").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("evaluation_scores").select("criterion_id, score, comment").eq("evaluation_id", id),
    supabase
      .from("evaluations")
      .select("id, type, period_label, final_score, overall_level, status, submitted_at, created_at, updated_at")
      .eq("internship_id", evalRow.internship_id)
      .order("created_at", { ascending: false })
      .limit(20),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)("get_evaluation_context", { p_internship_id: evalRow.internship_id }),
  ]);

  const canManage = role === "admin" || role === "hr" || role === "mentor";
  const canDownload = true; // API vẫn kiểm tra quyền ở backend; intern chỉ tải được phiếu của mình.

  const ev = evalRow as typeof evalRow & {
    profiles?: { full_name: string | null } | null;
    internships?: {
      intern_id: string;
      start_date: string | null;
      end_date: string | null;
      interns: {
        full_name: string | null;
        student_code: string | null;
        email: string | null;
        school: string | null;
        major: string | null;
        class_name: string | null;
        phone: string | null;
      } | null;
      departments: { name: string | null } | null;
      internship_batches: { name: string | null; start_date: string | null; end_date: string | null } | null;
      mentors: { full_name: string | null } | null;
    } | null;
  };

  const att = (context as { attendance?: Record<string, unknown> } | null)?.attendance ?? {};
  const tasksRaw = (context as { tasks?: unknown } | null)?.tasks;
  const tasks = (Array.isArray(tasksRaw) ? tasksRaw[0] : tasksRaw) as Record<string, unknown> | null;

  const intern = ev.internships?.interns;
  const batch = ev.internships?.internship_batches;
  const historyRows = (history ?? []) as Array<{
    id: string;
    type: string;
    period_label: string;
    final_score: number | string | null;
    overall_level: string | null;
    status: string | null;
    submitted_at: string | null;
    updated_at: string;
  }>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/evaluations"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Quay lại danh sách
        </Link>
      </div>

      <PageHeader
        title={`Đánh giá ${evaluationTypeLabel[ev.type] ?? ev.type}`}
        description={`${intern?.full_name ?? "—"} · ${ev.period_label}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={ev.status ?? "draft"} />
            {ev.overall_level ? (
              <Badge variant="secondary">{ev.overall_level}</Badge>
            ) : null}
            {canDownload ? <ExportDocxButton evaluationId={ev.id} size="sm" /> : null}
          </div>
        }
      />

      {/* Khu vực 1 – Thông tin thực tập sinh */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Khu vực 1 — Thông tin thực tập sinh</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 lg:grid-cols-4">
            <InfoItem label="Họ tên" value={intern?.full_name ?? "—"} />
            <InfoItem label="MSSV" value={intern?.student_code ?? "—"} />
            <InfoItem label="Email" value={intern?.email ?? "—"} />
            <InfoItem label="Trường học" value={intern?.school ?? "—"} />
            <InfoItem label="Ngành học" value={intern?.major ?? "—"} />
            <InfoItem label="Lớp" value={intern?.class_name ?? "—"} />
            <InfoItem label="Phòng ban" value={ev.internships?.departments?.name ?? "—"} />
            <InfoItem label="Đợt thực tập" value={batch?.name ?? "—"} />
            <InfoItem label="Mentor / Người hướng dẫn" value={ev.internships?.mentors?.full_name ?? "—"} />
            <InfoItem
              label="Thời gian thực tập"
              value={`${formatDate(ev.internships?.start_date ?? batch?.start_date ?? null)} – ${formatDate(ev.internships?.end_date ?? batch?.end_date ?? null)}`}
            />
            <InfoItem label="Người đánh giá" value={ev.profiles?.full_name ?? "—"} />
            <InfoItem
              label="Kỳ đánh giá"
              value={`${evaluationTypeLabel[ev.type] ?? ev.type} — ${ev.period_label}${
                ev.period_start || ev.period_end ? ` (${formatDate(ev.period_start)} – ${formatDate(ev.period_end)})` : ""
              }`}
            />
            <InfoItem label="Hạn nộp" value={formatDate(ev.due_date)} />
            <InfoItem label="Nộp lúc" value={ev.submitted_at ? formatDateTime(ev.submitted_at) : "—"} />
            <InfoItem label="Cập nhật lúc" value={formatDateTime(ev.updated_at)} />
            <InfoItem
              label="Điểm tổng kết"
              value={typeof ev.final_score === "number" ? `${ev.final_score.toFixed(2)}/10` : ev.final_score ? `${ev.final_score}/10` : "—"}
            />
          </dl>
        </CardContent>
      </Card>

      {/* Bối cảnh attendance + task (phục vụ chấm điểm) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Chuyên cần (Attendance)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            <span>
              Tổng ngày: <b className="tabular-nums">{String(att.total_days ?? 0)}</b>
            </span>
            <span>
              Đúng giờ: <b className="tabular-nums">{String(att.present ?? 0)}</b>
            </span>
            <span>
              Đi trễ: <b className="tabular-nums">{String(att.late ?? 0)}</b>
            </span>
            <span>
              Về sớm: <b className="tabular-nums">{String(att.early_leave ?? 0)}</b>
            </span>
            <span>
              Tỷ lệ hiện diện: <b className="tabular-nums">{String(att.punctuality_rate ?? "—")}%</b>
            </span>
            <span>
              Điểm gợi ý Đúng giờ: <b className="tabular-nums">{String(att.suggested_score ?? "—")}/10</b>
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Kết quả công việc (Task)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            {tasks ? (
              <>
                <span>
                  Tổng Task: <b className="tabular-nums">{String(tasks.total ?? 0)}</b>
                </span>
                <span>
                  Hoàn thành: <b className="tabular-nums">{String(tasks.completed ?? 0)}</b>
                </span>
                <span>
                  Đang làm: <b className="tabular-nums">{String(tasks.in_progress ?? 0)}</b>
                </span>
                <span>
                  Quá hạn: <b className="tabular-nums">{String(tasks.overdue ?? 0)}</b>
                </span>
                <span>
                  Tỷ lệ hoàn thành: <b className="tabular-nums">{String(tasks.completion_rate ?? "—")}%</b>
                </span>
                <span>
                  Đúng hạn: <b className="tabular-nums">{String(tasks.on_time_rate ?? "—")}%</b>
                </span>
              </>
            ) : (
              <p className="text-muted-foreground">Chưa có dữ liệu task.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Khu vực 2 + 3 + 4 – Tiêu chí / Tổng kết / Hành động */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Khu vực 2–4 — Chấm điểm, tổng kết và thao tác</CardTitle>
        </CardHeader>
        <CardContent>
          <EvaluationScoringForm
            evaluationId={ev.id}
            criteria={((criteria ?? []) as unknown as Array<{ id: string; name: string; category: string; description: string | null; weight: number; sort_order: number }>) as never[]}
            existingScores={((scores ?? []) as unknown as Array<{ criterion_id: string; score: number; comment: string | null }>) as never[]}
            summary={ev.summary}
            status={ev.status ?? "draft"}
            canManage={canManage}
            initialStrengths={ev.strengths}
            initialNeedsImprovement={ev.needs_improvement}
            initialRecommendation={ev.recommendation}
          />
          {!canManage ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Bạn đang xem kết quả đánh giá ở chế độ chỉ đọc. Thực tập sinh không thể sửa điểm hoặc nhận xét chính thức.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Lịch sử đánh giá theo internship */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Lịch sử đánh giá của thực tập sinh này</CardTitle>
        </CardHeader>
        <CardContent>
          {historyRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có lịch sử đánh giá.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {historyRows.map((h) => {
                const isCurrent = h.id === ev.id;
                return (
                  <li
                    key={h.id}
                    className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm ${
                      isCurrent ? "border-primary/40 bg-primary/5" : "border-border/60"
                    }`}
                  >
                    <span className="font-medium">
                      {evaluationTypeLabel[h.type] ?? h.type} — {h.period_label}
                    </span>
                    <StatusBadge value={h.status ?? "draft"} />
                    <span className="text-xs text-muted-foreground">
                      Điểm: {h.final_score !== null && h.final_score !== "" ? `${h.final_score}/10` : "—"}
                      {h.overall_level ? ` · ${h.overall_level}` : ""}
                      {isCurrent ? " · (đang mở)" : ""}
                    </span>
                    <span className="ml-auto flex gap-1.5">
                      {!isCurrent ? (
                        <Link href={`/evaluations/${h.id}`} className="text-xs text-primary underline-offset-4 hover:underline">
                          Mở phiếu
                        </Link>
                      ) : null}
                      <ExportDocxButton evaluationId={h.id} size="xs" variant="ghost" label="Word" />
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
