import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AuditLogsTable, type AuditRow } from "./audit-logs-table";

export default async function AuditLogsPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "admin") redirect("/dashboard");

  const supabase = await createClient();

  const { data } = await supabase
    .from("audit_logs")
    .select("*, profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = (data ?? []) as AuditRow[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nhật ký hệ thống"
        description="Lịch sử thay đổi dữ liệu (ghi tự động bởi trigger)"
      />
      <AuditLogsTable data={rows} />
    </div>
  );
}