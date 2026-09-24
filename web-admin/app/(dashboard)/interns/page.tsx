import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import type { InternsRow } from "@/types/database";
import { InternForm } from "./intern-form";
import { ImportCsvForm } from "./import-csv";

type InternRow = InternsRow & {
  internships: { internship_batches: { name: string } | null }[];
};

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

  const columns: Column<InternRow>[] = [
    {
      key: "student_code",
      header: "Mã SV",
      cell: (r) => (
        <Link href={`/interns/${r.id}`} className="font-medium text-primary hover:underline">
          {r.student_code}
        </Link>
      ),
    },
    { key: "full_name", header: "Họ tên", cell: (r) => r.full_name },
    { key: "email", header: "Email", cell: (r) => r.email },
    { key: "school", header: "Trường", cell: (r) => r.school ?? "—" },
    { key: "major", header: "Ngành", cell: (r) => r.major ?? "—" },
    {
      key: "batch",
      header: "Đợt",
      cell: (r) => r.internships?.[0]?.internship_batches?.name ?? "—",
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (r) => <StatusBadge value={r.status} />,
    },
  ];

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
      <DataTable
        data={interns}
        columns={columns}
        searchKeys={["student_code", "full_name", "email"]}
        searchPlaceholder="Tìm theo mã SV, họ tên, email..."
      />
    </div>
  );
}