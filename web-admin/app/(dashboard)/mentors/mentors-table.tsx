"use client";

import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import type { MentorsRow } from "@/types/database";

export type MentorRow = MentorsRow & {
  departments: { name: string } | null;
};

export function MentorsTable({ data }: { data: MentorRow[] }) {
  const columns: Column<MentorRow>[] = [
    {
      key: "employee_code",
      header: "Mã NV",
      cell: (r) => <span className="font-medium">{r.employee_code}</span>,
    },
    { key: "full_name", header: "Họ tên", cell: (r) => r.full_name },
    { key: "email", header: "Email", cell: (r) => r.email },
    { key: "phone", header: "SĐT", cell: (r) => r.phone ?? "—" },
    {
      key: "department_id",
      header: "Phòng ban",
      cell: (r) => r.departments?.name ?? "—",
    },
    {
      key: "max_interns",
      header: "SL intern (tối đa)",
      cell: (r) => String(r.max_interns),
    },
    {
      key: "is_active",
      header: "Trạng thái",
      cell: (r) => <StatusBadge value={r.is_active ? "active" : "cancelled"} />,
    },
  ];

  return (
    <DataTable
      data={data}
      columns={columns}
      searchKeys={["employee_code", "full_name", "email"]}
      searchPlaceholder="Tìm theo mã NV, họ tên, email..."
    />
  );
}
