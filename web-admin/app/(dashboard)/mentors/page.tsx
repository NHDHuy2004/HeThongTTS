import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { MentorForm } from "./mentor-form";
import { MentorsTable, type MentorRow } from "./mentors-table";

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Danh sách Mentor"
        description="Người hướng dẫn thực tập sinh"
        actions={<MentorForm departments={departments ?? []} />}
      />
      <MentorsTable data={(mentors ?? []) as MentorRow[]} />
    </div>
  );
}