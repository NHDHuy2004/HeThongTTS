import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { formatDateTime } from "@/features/labels";
import type { AuditLogsRow } from "@/types/database";

type AuditRow = AuditLogsRow & {
  profiles: { full_name: string; email: string } | null;
};

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

  const columns: Column<AuditRow>[] = [
    {
      key: "created_at",
      header: "Thời gian",
      cell: (r) => formatDateTime(r.created_at),
    },
    { key: "action", header: "Hành động", cell: (r) => r.action },
    { key: "entity", header: "Đối tượng", cell: (r) => r.entity },
    {
      key: "entity_id",
      header: "ID",
      cell: (r) => (r.entity_id ? <span className="font-mono text-xs">{r.entity_id}</span> : "—"),
    },
    {
      key: "user_id",
      header: "Người dùng",
      cell: (r) => r.profiles?.email ?? "—",
    },
    {
      key: "new_data",
      header: "Thay đổi",
      cell: (r) => (
        <span className="max-w-xs truncate font-mono text-xs">
          {r.new_data ? JSON.stringify(r.new_data) : r.old_data ? JSON.stringify(r.old_data) : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nhật ký hệ thống"
        description="Lịch sử thay đổi dữ liệu (ghi tự động bởi trigger)"
      />
      <DataTable
        data={rows}
        columns={columns}
        searchKeys={["action", "entity", "profiles.email"]}
        searchPlaceholder="Tìm theo hành động, đối tượng, email..."
      />
    </div>
  );
}