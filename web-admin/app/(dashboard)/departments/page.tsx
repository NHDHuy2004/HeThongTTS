import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DepartmentForm } from "./department-form";
import { DepartmentsTable, type DepartmentRow } from "./departments-table";

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Phòng ban"
        description="Các phòng ban tiếp nhận thực tập sinh"
        actions={<DepartmentForm />}
      />
      <DepartmentsTable data={(departments ?? []) as DepartmentRow[]} />
    </div>
  );
}