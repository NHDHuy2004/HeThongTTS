import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { InternForm } from "./intern-form";
import { ImportCsvForm } from "./import-csv";
import { InternsTable, type InternRow } from "./interns-table";

export default async function InternsPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  const isManager = role === "admin" || role === "hr";

  const supabase = await createClient();

  let interns: InternRow[] = [];
  if (isManager) {
    const { data } = await supabase
      .from("interns")
      .select("*, internships(internship_batches(name))")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    interns = (data ?? []) as InternRow[];
  } else if (role === "mentor") {
    const { data: internships } = await supabase
      .from("internships")
      .select(
        "intern_id, intern:interns(*, internships(internship_batches(name)))",
      )
      .is("deleted_at", null);
    const map = new Map<string, InternRow>();
    for (const ip of internships ?? []) {
      const intern = ip.intern as unknown as InternRow | null;
      if (intern) map.set(intern.id, intern);
    }
    interns = [...map.values()];
  } else {
    redirect("/dashboard");
  }

  const { data: batches } = await supabase
    .from("internship_batches")
    .select("id, name")
    .is("deleted_at", null);
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .is("deleted_at", null);
  const { data: mentors } = await supabase
    .from("mentors")
    .select("id, full_name")
    .is("deleted_at", null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Thực tập sinh"
        description="Hồ sơ và phân bổ thực tập sinh vào đợt, phòng ban, mentor"
        actions={
          isManager ? (
            <div className="flex items-center gap-2">
              <ImportCsvForm
                batches={batches ?? []}
                departments={departments ?? []}
                mentors={(mentors ?? []).map((m) => ({
                  id: m.id,
                  name: m.full_name,
                }))}
              />
              <InternForm
                batches={batches ?? []}
                departments={departments ?? []}
                mentors={(mentors ?? []).map((m) => ({
                  id: m.id,
                  name: m.full_name,
                }))}
              />
            </div>
          ) : undefined
        }
      />
      <InternsTable data={interns} />
    </div>
  );
}