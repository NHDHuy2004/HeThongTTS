import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListTodo, Paperclip } from "lucide-react";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  formatDate,
  formatDateTime,
  reportActionLabel,
  reportTypeLabel,
} from "@/features/labels";
import { ReportDetailActions } from "@/features/reports/report-detail-actions";
import {
  ReportContent,
  ReportLinks,
  ReportVersionsList,
} from "@/features/reports/report-content";
import type {
  ReportAttachmentsRow,
  ReportReviewsRow,
  ReportsRow,
  ReportTaskLinksRow,
  ReportVersionsRow,
} from "@/types/database";

type ReportReviewRow = ReportReviewsRow & { profiles: { full_name: string } | null };
type ReportVersionRow = ReportVersionsRow & { profiles: { full_name: string } | null };
type ReportTaskLinkRow = ReportTaskLinksRow & { tasks: { title: string } | null };

type ReportDetail = ReportsRow & {
  interns: { full_name: string; student_code: string | null } | null;
  profiles: { full_name: string } | null;
  report_attachments: ReportAttachmentsRow[];
  report_task_links: ReportTaskLinkRow[];
  report_reviews: ReportReviewRow[];
  report_versions: ReportVersionRow[];
};

export default async function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "admin" && role !== "hr" && role !== "mentor") {
    notFound();
  }

  const supabase = await createClient();

  const { data } = await supabase
    .from("reports")
    .select(
      `*,
       interns(full_name, student_code),
       profiles!reports_reviewed_by_fkey(full_name),
       report_attachments(*),
       report_task_links(*, tasks(title)),
       report_reviews(*, profiles(full_name)),
       report_versions(*, profiles(full_name))`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const report = data as ReportDetail;

  const attachmentUrls = await Promise.all(
    (report.report_attachments ?? []).map(async (a) => {
      const { data: signed } = await supabase.storage
        .from("report-attachments")
        .createSignedUrl(a.file_path, 3600);
      return { ...a, url: signed?.signedUrl ?? null };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Báo cáo ${report.report_code}`}
        description={
          report.interns
            ? `${report.interns.full_name}${report.interns.student_code ? ` · ${report.interns.student_code}` : ""} — ${report.title}`
            : report.title
        }
        actions={
          <Link
            href="/admin/reports"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
          >
            <ArrowLeft className="size-4" />
            Quay lại
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
          <span className="text-muted-foreground">Trạng thái</span>
          <StatusBadge value={report.status} />
          {report.is_late ? (
            <span className="text-xs font-medium text-destructive">Nộp muộn</span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
          <span className="text-muted-foreground">Loại báo cáo</span>
          <span className="font-medium">
            {reportTypeLabel[report.report_type] ?? report.report_type}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
          <span className="text-muted-foreground">Kỳ báo cáo</span>
          <span className="font-medium">
            {formatDate(report.period_start)}
            {report.period_end !== report.period_start
              ? ` – ${formatDate(report.period_end)}`
              : ""}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
          <span className="text-muted-foreground">Hạn nộp</span>
          <span className="font-medium">{formatDate(report.due_date)}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
          <span className="text-muted-foreground">Nộp lúc</span>
          <span className="font-medium">{formatDateTime(report.submitted_at)}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
          <span className="text-muted-foreground">Mentor phụ trách</span>
          <span className="font-medium">{report.profiles?.full_name ?? "—"}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
          <span className="text-muted-foreground">Phê duyệt lúc</span>
          <span className="font-medium">{formatDateTime(report.reviewed_at)}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
          <span className="text-muted-foreground">Người nộp</span>
          <span className="font-medium">
            {report.interns
              ? `${report.interns.full_name}${report.interns.student_code ? ` · ${report.interns.student_code}` : ""}`
              : "—"}
          </span>
        </div>
      </div>

      {report.rejection_reason ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <span className="font-medium">Lý do từ chối: </span>
          {report.rejection_reason}
        </div>
      ) : null}
      {report.revision_note ? (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm">
          <span className="font-medium">Cần chỉnh sửa: </span>
          {report.revision_note}
        </div>
      ) : null}
      {report.review_comment ? (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <span className="font-medium">Nhận xét: </span>
          {report.review_comment}
        </div>
      ) : null}

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Nội dung báo cáo</h2>
        <ReportContent reportType={report.report_type} content={report.content} />
      </section>

      <ReportDetailActions reportId={report.id} status={report.status} mode="review" />

      {(report.report_task_links ?? []).length > 0 ? (
        <section className="flex flex-col gap-2 rounded-lg border p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ListTodo className="size-4" /> Nhiệm vụ liên quan
          </h2>
          <ul className="flex flex-col gap-1">
            {(report.report_task_links ?? []).map((l) => (
              <li key={l.id} className="text-sm">
                {l.tasks?.title ?? "Nhiệm vụ đã xóa"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ReportLinks links={report.links} />

      {attachmentUrls.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-lg border p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Paperclip className="size-4" /> Tài liệu đính kèm
          </h2>
          <ul className="flex flex-col gap-1">
            {attachmentUrls.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {a.file_name}
                  </a>
                ) : (
                  <span>{a.file_name}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-2 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Lịch sử phiên bản</h2>
        <ReportVersionsList versions={report.report_versions ?? []} />
        {(report.report_versions ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có phiên bản nào được nộp.</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-2 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Lịch sử xử lý</h2>
        <ul className="flex flex-col gap-2">
          {(report.report_reviews ?? [])
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map((log) => (
              <li key={log.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {formatDateTime(log.created_at)}
                </span>
                <span className="font-medium">
                  {reportActionLabel[log.action] ?? log.action}
                </span>
                <span className="text-muted-foreground">
                  {log.profiles?.full_name ?? "Hệ thống"}
                </span>
                {log.new_status ? <StatusBadge value={log.new_status} /> : null}
                {log.comment ? (
                  <span className="text-muted-foreground">— {log.comment}</span>
                ) : null}
              </li>
            ))}
        </ul>
        {(report.report_reviews ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có hoạt động nào.</p>
        ) : null}
      </section>
    </div>
  );
}
