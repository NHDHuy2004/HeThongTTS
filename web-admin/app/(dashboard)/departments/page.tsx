import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import type { DepartmentsRow } from "@/types/database";
import { DepartmentForm, ToggleDepartment } from "./department-form";

type DepartmentRow = DepartmentsRow & {
  profiles: { full_name: string } | null;
};

export default async function DepartmentsPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "admin" && role !== "hr") redirect("/dashboard");

  const supabase = await createClient();

  const { data: departments } = await supabase
    .from("departments")
    .select("*, profiles(full_name)")
    .is("deleted_at", null)
    .order("name");

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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Phòng ban"
        description="Các phòng ban tiếp nhận thực tập sinh"
        actions={<DepartmentForm />}
      />
      <DataTable
        data={departments ?? []}
        columns={columns}
        searchKeys={["code", "name"]}
        searchPlaceholder="Tìm theo mã, tên phòng ban..."
      />
    </div>
  );
}