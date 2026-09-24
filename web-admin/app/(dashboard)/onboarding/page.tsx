import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/features/labels";
import type { OnboardingChecklistsRow } from "@/types/database";
import { OnboardingForm } from "./onboarding-form";
import { ToggleChecklist } from "./toggle-checklist";

type ChecklistRow = OnboardingChecklistsRow & {
  interns: { full_name: string } | null;
};

export default async function OnboardingPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  const userId = session.user.id;

  const supabase = await createClient();

  let checklists: ChecklistRow[] = [];
  let interns: { id: string; name: string }[] = [];

  if (role === "admin" || role === "hr") {
    const [{ data }, { data: internList }] = await Promise.all([
      supabase
        .from("onboarding_checklists")
        .select("*, interns(full_name)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("interns")
        .select("id, full_name")
        .is("deleted_at", null)
        .order("full_name"),
    ]);
    checklists = (data ?? []) as ChecklistRow[];
    interns = (internList ?? []).map((i) => ({ id: i.id, name: i.full_name }));
  } else if (role === "intern") {
    const { data: myIntern } = await supabase
      .from("interns")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (myIntern) {
      const { data } = await supabase
        .from("onboarding_checklists")
        .select("*, interns(full_name)")
        .eq("intern_id", myIntern.id)
        .order("created_at", { ascending: false });
      checklists = (data ?? []) as ChecklistRow[];
    }
  } else {
    redirect("/dashboard");
  }

  const columns: Column<ChecklistRow>[] = [
    { key: "title", header: "Tiêu đề", cell: (r) => <span className="font-medium">{r.title}</span> },
    {
      key: "intern_id",
      header: "Intern",
      cell: (r) => r.interns?.full_name ?? "—",
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (r) => <StatusBadge value={r.completed_at ? "done" : r.status} />,
    },
    { key: "due_date", header: "Hạn", cell: (r) => formatDate(r.due_date) },
    { key: "completed_at", header: "Hoàn thành lúc", cell: (r) => formatDate(r.completed_at) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Onboarding"
        description={
          role === "intern"
            ? "Danh sách việc cần làm của bạn trong quá trình onboard"
            : "Checklist nhập cuộc cho thực tập sinh"
        }
        actions={
          role === "admin" || role === "hr" ? <OnboardingForm interns={interns} /> : undefined
        }
      />
      <DataTable
        data={checklists}
        columns={[
          ...columns,
          {
            key: "actions",
            header: "",
            cell: (r) => (
              <ToggleChecklist id={r.id} status={r.completed_at ? "done" : r.status} />
            ),
          },
        ]}
        searchKeys={["title", "interns.full_name"]}
        searchPlaceholder="Tìm theo tiêu đề, tên intern..."
      />
    </div>
  );
}