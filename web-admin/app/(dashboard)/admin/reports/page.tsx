import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ExportCsvButton } from "@/components/export-csv-button";
import { MigrationNotice } from "@/components/migration-notice";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ReportsTable, type ReportRowView } from "@/features/reports/reports-table";

type Stats = {
  total?: number;
  by_status?: Record<string, number>;
  by_type?: Record<string, number>;
  overdue?: number;
  late_submitted?: number;
  on_time_rate?: number | null;
  approval_rate?: number | null;
  avg_review_hours?: number | null;
} | null;

function pct(value: number | null | undefined): string {
  return value != null ? `${value}%` : "—";
}

export default async function AdminReportsPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "admin" && role !== "hr" && role !== "mentor") {
    redirect("/intern/reports");
  }

  const supabase = await createClient();

  const [reportsRes, statsRes] = await Promise.all([
    supabase
      .from("reports")
      .select(
        "*, interns(full_name, student_code), profiles!reports_reviewed_by_fkey(full_name)",
      )
      .order("period_start", { ascending: false })
      .limit(300),
    supabase.rpc("get_report_stats"),
  ]);

  const rows = (reportsRes.data ?? []) as ReportRowView[];
  const stats = (statsRes.data ?? null) as Stats;
  const migrationMissing =
    reportsRes.error?.code === "PGRST205" ||
    reportsRes.error?.code === "42P01" ||
    Boolean(reportsRes.error?.message?.includes("Could not find the table"));

  const statCards: { label: string; value: string }[] = [
    { label: "Tổng báo cáo", value: String(stats?.total ?? rows.length) },
    {
      label: "Chờ xét duyệt",
      value: String(
        (stats?.by_status?.submitted ?? 0) + (stats?.by_status?.in_review ?? 0),
      ),
    },
    { label: "Đã phê duyệt", value: String(stats?.by_status?.approved ?? 0) },
    {
      label: "Cần chỉnh sửa",
      value: String(stats?.by_status?.needs_revision ?? 0),
    },
    { label: "Quá hạn nộp", value: String(stats?.overdue ?? 0) },
    { label: "Nộp muộn", value: String(stats?.late_submitted ?? 0) },
    { label: "Tỷ lệ nộp đúng hạn", value: pct(stats?.on_time_rate) },
    { label: "Tỷ lệ được duyệt", value: pct(stats?.approval_rate) },
    {
      label: "TB thời gian xét duyệt (giờ)",
      value: stats?.avg_review_hours != null ? String(stats.avg_review_hours) : "—",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quản lý báo cáo"
        description={
          role === "mentor"
            ? "Báo cáo của thực tập sinh bạn phụ trách"
            : "Theo dõi tiến độ nộp báo cáo và xét duyệt toàn hệ thống"
        }
        actions={<ExportCsvButton href="/api/exports/reports" />}
      />

      {migrationMissing ? (
        <MigrationNotice
          role={role}
          table="reports"
          migration="0018_reports_management.sql"
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      {statsRes.error ? (
        <p className="text-xs text-muted-foreground">
          Thống kê chi tiết không khả dụng: {statsRes.error.message}
        </p>
      ) : null}

      <ReportsTable rows={rows} mode="review" detailBase="/admin/reports" />
    </div>
  );
}
