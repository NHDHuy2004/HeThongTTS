"use client";

import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/features/labels";
import type { CertificatesRow } from "@/types/database";
import { CertificateAction } from "./certificate-action";

export function CertificatesTable({
  data,
  canManage,
}: {
  data: CertificatesRow[];
  canManage: boolean;
}) {
  const columns: Column<CertificatesRow>[] = [
    {
      key: "certificate_code",
      header: "Mã",
      cell: (r) => <span className="font-mono text-xs font-medium">{r.certificate_code}</span>,
    },
    { key: "full_name", header: "Họ tên", cell: (r) => r.full_name },
    { key: "department_name", header: "Phòng ban", cell: (r) => r.department_name ?? "—" },
    { key: "batch_name", header: "Đợt", cell: (r) => r.batch_name ?? "—" },
    {
      key: "status",
      header: "Trạng thái",
      cell: (r) => <StatusBadge value={r.status} />,
    },
    { key: "issued_at", header: "Ngày cấp", cell: (r) => formatDate(r.issued_at) },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <CertificateAction
          id={r.id}
          status={r.status ?? "draft"}
          canManage={canManage}
        />
      ),
    },
  ];

  return (
    <DataTable
      data={data}
      columns={columns}
      searchKeys={["certificate_code", "full_name", "department_name"]}
      searchPlaceholder="Tìm theo mã, họ tên..."
    />
  );
}
