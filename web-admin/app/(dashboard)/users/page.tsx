import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { roleLabel } from "@/features/labels";
import type { ProfilesRow } from "@/types/database";
import { ToggleUser } from "./toggle-user";

type UserRow = ProfilesRow & {
  roles: { name: string } | null;
};

export default async function UsersPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "admin") redirect("/dashboard");

  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("*, roles(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as UserRow[];

  const columns: Column<UserRow>[] = [
    { key: "email", header: "Email", cell: (r) => <span className="font-medium">{r.email}</span> },
    { key: "full_name", header: "Họ tên", cell: (r) => r.full_name },
    { key: "phone", header: "SĐT", cell: (r) => r.phone ?? "—" },
    {
      key: "role_id",
      header: "Vai trò",
      cell: (r) => {
        const code = roleOf(r);
        return code ? roleLabel[code] ?? code : "—";
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Người dùng" description="Quản lý tài khoản đăng nhập hệ thống" />
      <DataTable
        data={rows}
        columns={[
          ...columns,
          {
            key: "is_active",
            header: "Trạng thái",
            cell: (r) => <ToggleUser id={r.id} active={Boolean(r.is_active)} />,
          },
        ]}
        searchKeys={["email", "full_name"]}
        searchPlaceholder="Tìm theo email, họ tên..."
      />
    </div>
  );
}

function roleOf(r: UserRow): string | null {
  const name = r.roles?.name;
  if (!name) return null;
  for (const [key, label] of Object.entries(roleLabel)) {
    if (label === name || key === name) return key;
  }
  return name;
}