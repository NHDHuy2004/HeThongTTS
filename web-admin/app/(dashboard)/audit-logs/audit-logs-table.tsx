"use client";

import { DataTable, type Column } from "@/components/data-table";
import { formatDateTime } from "@/features/labels";
import type { AuditLogsRow } from "@/types/database";

export type AuditRow = AuditLogsRow & {
  profiles: { full_name: string; email: string } | null;
};

export function AuditLogsTable({ data }: { data: AuditRow[] }) {
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
    <DataTable
      data={data}
      columns={columns}
      searchKeys={["action", "entity", "profiles.email"]}
      searchPlaceholder="Tìm theo hành động, đối tượng, email..."
    />
  );
}
