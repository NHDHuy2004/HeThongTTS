import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import type { CertificatesRow } from "@/types/database";
import { CertForm } from "./cert-form";
import { CertificatesTable } from "./certificates-table";

export default async function CertificatesPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  const userId = session.user.id;

  const supabase = await createClient();

  let rows: CertificatesRow[] = [];
  let interns: { id: string; name: string }[] = [];

  const canManage = role === "admin" || role === "hr";

  if (canManage) {
    const [{ data }, { data: internList }] = await Promise.all([
      supabase.from("certificates").select("*").order("created_at", { ascending: false }).limit(200),
      supabase
        .from("interns")
        .select("id, full_name")
        .is("deleted_at", null)
        .order("full_name"),
    ]);
    rows = data ?? [];
    interns = (internList ?? []).map((i) => ({ id: i.id, name: i.full_name }));
  } else if (role === "intern") {
    const { data: myIntern } = await supabase
      .from("interns")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (myIntern) {
      const { data } = await supabase
        .from("certificates")
        .select("*")
        .eq("intern_id", myIntern.id)
        .order("created_at", { ascending: false });
      rows = data ?? [];
    }
  } else {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Chứng nhận"
        description="Quản lý chứng nhận hoàn thành thực tập"
        actions={canManage ? <CertForm interns={interns} /> : undefined}
      />
      <CertificatesTable data={rows} canManage={canManage} />
    </div>
  );
}