"use client";

import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/features/labels";
import type { InternshipBatchesRow } from "@/types/database";
import { BatchStatusForm } from "./batch-form";

export type BatchRow = InternshipBatchesRow & {
  profiles: { full_name: string } | null;
};

export function BatchesTable({ data }: { data: BatchRow[] }) {
  const columns: Column<BatchRow>[] = [
    { key: "code", header: "Mã đợt", cell: (r) => <span className="font-medium">{r.code}</span> },
    { key: "name", header: "Tên đợt", cell: (r) => r.name },
    {
      key: "start_date",
      header: "Bắt đầu",
      cell: (r) => formatDate(r.start_date),
    },
    { key: "end_date", header: "Kết thúc", cell: (r) => formatDate(r.end_date) },
    { key: "max_interns", header: "SL tối đa", cell: (r) => String(r.max_interns ?? "—") },
    { key: "location", header: "Địa điểm", cell: (r) => r.location ?? "—" },
    {
      key: "status",
      header: "Trạng thái",
      cell: (r) => <StatusBadge value={r.status} />,
    },
    {
      key: "actions",
      header: "",
      cell: (r) => <BatchStatusForm id={r.id} status={r.status} />,
    },
  ];

  return (
    <DataTable
      data={data}
      columns={columns}
      searchKeys={["code", "name"]}
      searchPlaceholder="Tìm theo mã, tên đợt..."
    />
  );
}
