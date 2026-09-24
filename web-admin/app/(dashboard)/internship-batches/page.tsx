import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/features/labels";
import type { InternshipBatchesRow } from "@/types/database";
import { BatchForm, BatchStatusForm } from "./batch-form";

type BatchRow = InternshipBatchesRow & {
  profiles: { full_name: string } | null;
};

export default async function InternshipBatchesPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "admin" && role !== "hr") redirect("/dashboard");

  const supabase = await createClient();

  const { data: batches } = await supabase
    .from("internship_batches")
    .select("*, profiles(full_name)")
    .is("deleted_at", null)
    .order("start_date", { ascending: false });

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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Đợt thực tập"
        description="Các đợt nhận thực tập sinh"
        actions={<BatchForm />}
      />
      <DataTable
        data={batches ?? []}
        columns={columns}
        searchKeys={["code", "name"]}
        searchPlaceholder="Tìm theo mã, tên đợt..."
      />
    </div>
  );
}