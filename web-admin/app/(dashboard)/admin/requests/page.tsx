import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ExportCsvButton } from "@/components/export-csv-button";
import { MigrationNotice } from "@/components/migration-notice";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  RequestsTable,
  type RequestRowView,
} from "@/features/requests/requests-table";

type Stats = {
  total?: number;
  by_status?: Record<string, number>;
  by_type?: Record<string, number>;
  overdue_pending?: number;
  avg_review_hours?: number | null;
} | null;

export default async function AdminRequestsPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "admin" && role !== "hr" && role !== "mentor") {
    redirect("/intern/requests");
  }

  const supabase = await createClient();

  const [requestsRes, statsRes] = await Promise.all([
    supabase
      .from("requests")
      .select(
        "*, interns(full_name, student_code), profiles!requests_reviewer_id_fkey(full_name)",
      )
      .order("submitted_at", { ascending: false })
      .limit(300),
    supabase.rpc("get_request_stats"),
  ]);

  const rows = (requestsRes.data ?? []) as RequestRowView[];
  const stats = (statsRes.data ?? null) as Stats;
  const migrationMissing =
    requestsRes.error?.code === "PGRST205" ||
    requestsRes.error?.code === "42P01" ||
    Boolean(requestsRes.error?.message?.includes("Could not find the table"));

  const statCards: { label: string; value: string }[] = [
    { label: "Tổng đơn", value: String(stats?.total ?? rows.length) },
    {
      label: "Chờ xử lý",
      value: String(stats?.by_status?.pending ?? 0),
    },
    {
      label: "Cần bổ sung",
      value: String(stats?.by_status?.needs_revision ?? 0),
    },
    {
      label: "Quá hạn 48h",
      value: String(stats?.overdue_pending ?? 0),
    },
    {
      label: "Trung bình duyệt (giờ)",
      value: stats?.avg_review_hours != null ? String(stats.avg_review_hours) : "—",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quản lý đơn từ"
        description={
          role === "mentor"
            ? "Các đơn của thực tập sinh bạn phụ trách"
            : "Tiếp nhận, xét duyệt và theo dõi toàn bộ đơn từ"
        }
        actions={<ExportCsvButton href="/api/exports/requests" />}
      />

      {migrationMissing ? (
        <MigrationNotice
          role={role}
          table="requests"
          migration="0017_requests_management.sql"
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      {statsRes.error ? (
        <p className="text-xs text-muted-foreground">
          Thống kê chi tiết không khả dụng: {statsRes.error.message}
        </p>
      ) : null}

      <RequestsTable rows={rows} mode="review" detailBase="/admin/requests" />
    </div>
  );
}
