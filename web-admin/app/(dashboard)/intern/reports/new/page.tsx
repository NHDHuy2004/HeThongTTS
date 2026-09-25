import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireAuth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ReportForm } from "@/features/reports/report-form";

export default async function NewReportPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "intern") redirect("/admin/reports");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tạo báo cáo"
        description="Chọn loại báo cáo, điền nội dung rồi lưu nháp hoặc nộp ngay"
        actions={
          <Link
            href="/intern/reports"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
          >
            <ArrowLeft className="size-4" />
            Quay lại
          </Link>
        }
      />
      <ReportForm userId={session.user.id} />
    </div>
  );
}
