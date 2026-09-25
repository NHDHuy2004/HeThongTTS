"use client";

import { DataTable, type Column } from "@/components/data-table";
import { roleLabel } from "@/features/labels";
import type { ProfilesRow } from "@/types/database";
import { ToggleUser } from "./toggle-user";

export type UserRow = ProfilesRow & {
  roles: { name: string } | null;
};

function roleOf(r: UserRow): string | null {
  const name = r.roles?.name;
  if (!name) return null;
  for (const [key, label] of Object.entries(roleLabel)) {
    if (label === name || key === name) return key;
  }
  return name;
}

export function UsersTable({ data }: { data: UserRow[] }) {
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
    {
      key: "is_active",
      header: "Trạng thái",
      cell: (r) => <ToggleUser id={r.id} active={Boolean(r.is_active)} />,
    },
  ];

  return (
    <DataTable
      data={data}
      columns={columns}
      searchKeys={["email", "full_name"]}
      searchPlaceholder="Tìm theo email, họ tên..."
    />
  );
}
