import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EvalForm } from "./eval-form";
import { EvaluationsTable, type EvalRow } from "./evaluations-table";

export default async function EvaluationsPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  const userId = session.user.id;

  const supabase = await createClient();

  let rows: EvalRow[] = [];
  let canManage = false;
  let internships: { id: string; name: string }[] = [];

  if (role === "admin" || role === "hr") {
    const [{ data }, { data: ipList }] = await Promise.all([
      supabase
        .from("evaluations")
        .select("*, internships(interns(full_name))")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("internships")
        .select("id, interns(full_name)")
        .is("deleted_at", null),
    ]);
    rows = (data ?? []) as EvalRow[];
    internships = ((ipList ?? []) as { id: string; interns: { full_name: string } | null }[]).map(
      (ip) => ({ id: ip.id, name: ip.interns?.full_name ?? "—" }),
    );
    canManage = true;
  } else if (role === "mentor") {
    const { data: mentor } = await supabase
      .from("mentors")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (mentor) {
      const { data: ipList } = await supabase
        .from("internships")
        .select("id, interns(full_name)")
        .eq("mentor_id", mentor.id);
      const { data } = await supabase
        .from("evaluations")
        .select("*, internships(interns(full_name))")
        .in(
          "internship_id",
          (ipList ?? []).map((ip) => ip.id),
        )
        .order("created_at", { ascending: false })
        .limit(200);
      rows = (data ?? []) as EvalRow[];
      internships = ((ipList ?? []) as { id: string; interns: { full_name: string } | null }[]).map(
        (ip) => ({ id: ip.id, name: ip.interns?.full_name ?? "—" }),
      );
      canManage = true;
    }
  } else if (role === "intern") {
    const { data: myIntern } = await supabase
      .from("interns")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (myIntern) {
      const ipList = (
        await supabase.from("internships").select("id").eq("intern_id", myIntern.id)
      ).data;
      if (ipList?.length) {
        const { data } = await supabase
          .from("evaluations")
          .select("*, internships(interns(full_name))")
          .in(
            "internship_id",
            ipList.map((ip) => ip.id),
          )
          .order("created_at", { ascending: false })
          .limit(200);
        rows = (data ?? []) as EvalRow[];
      }
    }
  } else {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Đánh giá"
        description="Phiếu đánh giá định kỳ cho thực tập sinh"
        actions={canManage ? <EvalForm internships={internships} /> : undefined}
      />
      <EvaluationsTable data={rows} />
    </div>
  );
}