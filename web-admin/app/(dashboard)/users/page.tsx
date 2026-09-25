import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { UsersTable, type UserRow } from "./users-table";

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Người dùng" description="Quản lý tài khoản đăng nhập hệ thống" />
      <UsersTable data={rows} />
    </div>
  );
}