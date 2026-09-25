"use client";

import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatDateTime } from "@/features/labels";
import type { AttendanceRow } from "@/types/database";

export type AttendanceRowView = AttendanceRow & {
  interns: { full_name: string } | null;
};

export function AttendanceTable({ data }: { data: AttendanceRowView[] }) {
  const columns: Column<AttendanceRowView>[] = [
    { key: "work_date", header: "Ngày", cell: (r) => formatDate(r.work_date) },
    {
      key: "intern_id",
      header: "Intern",
      cell: (r) => r.interns?.full_name ?? "—",
    },
    { key: "check_in_at", header: "Check-in", cell: (r) => formatDateTime(r.check_in_at) },
    { key: "check_out_at", header: "Check-out", cell: (r) => formatDateTime(r.check_out_at) },
    {
      key: "status",
      header: "Trạng thái",
      cell: (r) => <StatusBadge value={r.status} />,
    },
    { key: "note", header: "Ghi chú", cell: (r) => r.note ?? "—" },
  ];

  return (
    <DataTable
      data={data}
      columns={columns}
      searchKeys={["interns.full_name", "note"]}
      searchPlaceholder="Tìm theo tên intern, ghi chú..."
    />
  );
}
