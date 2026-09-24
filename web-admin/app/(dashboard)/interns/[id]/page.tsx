import { notFound, redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { InternDetail } from "./intern-detail";

export default async function InternDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  const { id } = await params;

  const supabase = await createClient();
  const { data: intern } = await supabase
    .from("interns")
    .select(
      "*, internships(id, internship_batches(name, status), departments(name), mentors(full_name))",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!intern) {
    if (role === "mentor") redirect("/interns");
    notFound();
  }
  void role;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .in(
      "internship_id",
      (intern.internships ?? []).map((ip) => ip.id),
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: attendance } = await supabase
    .from("attendance")
    .select("*")
    .eq("intern_id", id)
    .order("work_date", { ascending: false })
    .limit(30);

  const { data: reports } = await supabase
    .from("daily_reports")
    .select("*")
    .eq("intern_id", id)
    .order("report_date", { ascending: false })
    .limit(20);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={intern.full_name}
        description={`${intern.student_code} · ${intern.email}`}
      />
      <InternDetail
        intern={intern}
        tasks={tasks ?? []}
        attendance={attendance ?? []}
        reports={reports ?? []}
        canManage={role === "admin" || role === "hr"}
      />
    </div>
  );
}