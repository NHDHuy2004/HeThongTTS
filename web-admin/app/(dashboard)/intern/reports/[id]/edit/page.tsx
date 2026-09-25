import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import {
  ReportForm,
  type ReportFormValues,
} from "@/features/reports/report-form";
import type { ReportsRow, ReportTaskLinksRow } from "@/types/database";

type EditRow = ReportsRow & {
  report_task_links: Pick<ReportTaskLinksRow, "task_id">[];
  report_attachments: { file_path: string }[];
};

export default async function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAuth();
  const supabase = await createClient();

  const { data } = await supabase
    .from("reports")
    .select("*, report_task_links(task_id), report_attachments(file_path)")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const report = data as EditRow;
  if (report.user_id !== session.user.id) notFound();
  if (report.status !== "draft" && report.status !== "needs_revision") {
    redirect(`/intern/reports/${report.id}`);
  }

  const values: ReportFormValues = {
    report_id: report.id,
    report_type: report.report_type,
    title: report.title,
    period_start: report.period_start,
    period_end: report.period_end,
    due_date: report.due_date,
    content:
      report.content && typeof report.content === "object" && !Array.isArray(report.content)
        ? (report.content as Record<string, string>)
        : {},
    links: report.links,
    task_ids: (report.report_task_links ?? []).map((l) => l.task_id),
    attachment_paths: (report.report_attachments ?? []).map((a) => a.file_path),
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Chỉnh sửa báo cáo"
        description={`Báo cáo ${report.report_code} — chỉ lưu nháp hoặc nộp lại`}
        actions={
          <Link
            href={`/intern/reports/${report.id}`}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
          >
            <ArrowLeft className="size-4" />
            Quay lại
          </Link>
        }
      />
      <ReportForm userId={session.user.id} initial={values} />
    </div>
  );
}
