import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
    // Query chính + các option cho form chạy song song (không phụ thuộc nhau).
    const [mainRes, batchesRes, departmentsRes, mentorsRes] =
      await Promise.all([
        supabase
          .from("interns")
          .select("*, internships(internship_batches(name))")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase.from("internship_batches").select("id, name").is("deleted_at", null),
        supabase.from("departments").select("id, name").is("deleted_at", null),
        supabase.from("mentors").select("id, full_name").is("deleted_at", null),
      ]);
    interns = (mainRes.data ?? []) as InternRow[];

    const batches = batchesRes.data ?? [];
    const departments = departmentsRes.data ?? [];
    const mentors = mentorsRes.data ?? [];

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Thực tập sinh"
          description="Hồ sơ và phân bổ thực tập sinh vào đợt, phòng ban, mentor"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/interns/import-jobs">
                <Button variant="ghost">Lịch sử import</Button>
              </Link>
              <ImportCsvForm
                batches={batches}
                departments={departments}
                mentors={mentors.map((m) => ({ id: m.id, name: m.full_name }))}
              />
              <InternForm
                batches={batches}
                departments={departments}
                mentors={mentors.map((m) => ({ id: m.id, name: m.full_name }))}
              />
            </div>
          }
        />
        <InternsTable data={interns} />
      </div>
    );
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

    // Mentor chỉ xem bảng — không tải batches/departments/mentors (không dùng).
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Thực tập sinh"
          description="Hồ sơ và phân bổ thực tập sinh vào đợt, phòng ban, mentor"
        />
        <InternsTable data={interns} />
      </div>
    );
  } else {
    redirect("/dashboard");
  }
}