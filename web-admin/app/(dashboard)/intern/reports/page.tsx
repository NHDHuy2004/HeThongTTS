import Link from "next/link";
import { redirect } from "next/navigation";
import { FilePlus2 } from "lucide-react";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ReportsTable, type ReportRowView } from "@/features/reports/reports-table";

export default async function InternReportsPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "intern") redirect("/admin/reports");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reports")
    .select(
      "*, interns(full_name, student_code), profiles!reports_reviewed_by_fkey(full_name)",
    )
    .order("period_start", { ascending: false })
    .limit(300);

  const rows = (data ?? []) as ReportRowView[];
  const migrationMissing =
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    Boolean(error?.message?.includes("Could not find the table"));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Báo cáo thực tập"
        description="Tạo, nộp và theo dõi báo cáo ngày / tuần / tháng / tổng kết"
        actions={
          <Link
            href="/intern/reports/new"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <FilePlus2 className="size-4" />
            Tạo báo cáo
          </Link>
        }
      />

      {migrationMissing ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          Chưa tìm thấy bảng <code>reports</code> — hãy chạy migration{" "}
          <code>0018_reports_management.sql</code> trong Supabase Dashboard.
        </div>
      ) : null}

      <ReportsTable rows={rows} mode="mine" detailBase="/intern/reports" />
    </div>
  );
}
