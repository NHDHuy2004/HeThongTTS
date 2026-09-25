"use client";

import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import type { DepartmentsRow } from "@/types/database";
import { ToggleDepartment } from "./department-form";

export type DepartmentRow = DepartmentsRow & {
  profiles: { full_name: string } | null;
};

export function DepartmentsTable({ data }: { data: DepartmentRow[] }) {
  const columns: Column<DepartmentRow>[] = [
    { key: "code", header: "Mã", cell: (r) => <span className="font-medium">{r.code}</span> },
    { key: "name", header: "Tên phòng ban", cell: (r) => r.name },
    { key: "description", header: "Mô tả", cell: (r) => r.description ?? "—" },
    { key: "head_profile_id", header: "Trưởng phòng", cell: (r) => r.profiles?.full_name ?? "—" },
    {
      key: "is_active",
      header: "Trạng thái",
      cell: (r) => <StatusBadge value={r.is_active ? "active" : "cancelled"} />,
    },
    {
      key: "actions",
      header: "",
      cell: (r) => <ToggleDepartment id={r.id} isActive={r.is_active} />,
    },
  ];

  return (
    <DataTable
      data={data}
      columns={columns}
      searchKeys={["code", "name"]}
      searchPlaceholder="Tìm theo mã, tên phòng ban..."
    />
  );
}
