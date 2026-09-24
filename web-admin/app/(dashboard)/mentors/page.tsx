import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import type { MentorsRow } from "@/types/database";
import { MentorForm } from "./mentor-form";

type MentorRow = MentorsRow & {
  departments: { name: string } | null;
};

export default async function MentorsPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "admin" && role !== "hr") redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: mentors }, { data: departments }] = await Promise.all([
    supabase
      .from("mentors")
      .select("*, departments(name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("departments").select("id, name").is("deleted_at", null).is("is_active", true),
  ]);

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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Danh sách Mentor"
        description="Người hướng dẫn thực tập sinh"
        actions={<MentorForm departments={departments ?? []} />}
      />
      <DataTable
        data={mentors ?? []}
        columns={columns}
        searchKeys={["employee_code", "full_name", "email"]}
        searchPlaceholder="Tìm theo mã NV, họ tên, email..."
      />
    </div>
  );
}