import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { NewEvaluationWizard, type InternshipOption } from "./wizard";

export default async function NewEvaluationPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "admin" && role !== "hr" && role !== "mentor") {
    redirect("/evaluations");
  }

  const supabase = await createClient();

  let query = supabase
    .from("internships")
    .select(
      "id, start_date, end_date, interns(full_name, student_code, email, major, school), departments(name), mentors(full_name), internship_batches(name)",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(300);

  if (role === "mentor") {
    const { data: mentor } = await supabase
      .from("mentors")
      .select("id")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (mentor) {
      query = query.eq("mentor_id", mentor.id);
    }
  }

  const { data } = await query;
  const options: InternshipOption[] = (data ?? []).map((ip) => {
    const row = ip as unknown as {
      id: string;
      start_date: string | null;
      end_date: string | null;
      interns: { full_name: string; student_code: string | null; email: string | null; major: string | null; school: string | null } | null;
      departments: { name: string } | null;
      mentors: { full_name: string } | null;
      internship_batches: { name: string } | null;
    };
    return {
      id: row.id,
      internName: row.interns?.full_name ?? "—",
      studentCode: row.interns?.student_code ?? "—",
      email: row.interns?.email ?? "—",
      major: row.interns?.major ?? null,
      school: row.interns?.school ?? null,
      department: row.departments?.name ?? "—",
      mentor: row.mentors?.full_name ?? "—",
      batch: row.internship_batches?.name ?? "—",
      startDate: row.start_date,
      endDate: row.end_date,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tạo đánh giá mới" description="Chọn sinh viên và kỳ đánh giá" />
      <NewEvaluationWizard options={options} />
    </div>
  );
}
