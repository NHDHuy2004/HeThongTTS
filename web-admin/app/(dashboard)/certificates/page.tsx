import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/features/labels";
import type { CertificatesRow } from "@/types/database";
import { CertForm } from "./cert-form";
import { CertificateAction } from "./certificate-action";

export default async function CertificatesPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  const userId = session.user.id;

  const supabase = await createClient();

  let rows: CertificatesRow[] = [];
  let interns: { id: string; name: string }[] = [];

  if (role === "admin" || role === "hr") {
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

  const columns: Column<CertificatesRow>[] = [
    {
      key: "certificate_code",
      header: "Mã",
      cell: (r) => <span className="font-mono text-xs font-medium">{r.certificate_code}</span>,
    },
    { key: "full_name", header: "Họ tên", cell: (r) => r.full_name },
    { key: "department_name", header: "Phòng ban", cell: (r) => r.department_name ?? "—" },
    { key: "batch_name", header: "Đợt", cell: (r) => r.batch_name ?? "—" },
    {
      key: "status",
      header: "Trạng thái",
      cell: (r) => <StatusBadge value={r.status} />,
    },
    { key: "issued_at", header: "Ngày cấp", cell: (r) => formatDate(r.issued_at) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Chứng nhận"
        description="Quản lý chứng nhận hoàn thành thực tập"
        actions={
          role === "admin" || role === "hr" ? <CertForm interns={interns} /> : undefined
        }
      />
      <DataTable
        data={rows}
        columns={[
          ...columns,
          {
            key: "actions",
            header: "",
            cell: (r) => (
              <CertificateAction
                id={r.id}
                status={r.status ?? "draft"}
                canManage={role === "admin" || role === "hr"}
              />
            ),
          },
        ]}
        searchKeys={["certificate_code", "full_name", "department_name"]}
        searchPlaceholder="Tìm theo mã, họ tên..."
      />
    </div>
  );
}