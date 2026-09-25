"use client";

import Link from "next/link";

import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import type { InternsRow } from "@/types/database";

export type InternRow = InternsRow & {
  internships: { internship_batches: { name: string } | null }[];
};

export function InternsTable({ data }: { data: InternRow[] }) {
  const columns: Column<InternRow>[] = [
    {
      key: "student_code",
      header: "Mã SV",
      cell: (row) => (
        <Link
          href={`/interns/${row.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.student_code}
        </Link>
      ),
    },
    { key: "full_name", header: "Họ tên", cell: (row) => row.full_name },
    { key: "email", header: "Email", cell: (row) => row.email },
    { key: "school", header: "Trường", cell: (row) => row.school ?? "—" },
    { key: "major", header: "Ngành", cell: (row) => row.major ?? "—" },
    {
      key: "batch",
      header: "Đợt",
      cell: (row) => row.internships?.[0]?.internship_batches?.name ?? "—",
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => <StatusBadge value={row.status} />,
    },
  ];

  return (
    <DataTable
      data={data}
      columns={columns}
      searchKeys={["student_code", "full_name", "email"]}
      searchPlaceholder="Tìm theo mã SV, họ tên, email..."
    />
  );
}
