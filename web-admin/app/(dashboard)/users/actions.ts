"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function toggleUserActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin") return { error: "Bạn không có quyền quản lý người dùng." };

  const admin = createAdminClient();
  const { error: authErr } = await admin.auth.admin.updateUserById(id, {
    ban_duration: active ? "none" : "876000h",
  });
  if (authErr) return { error: authErr.message };

  const { error } = await admin
    .from("profiles")
    .update({ is_active: active })
    .eq("id", id);
  return { error: error?.message ?? undefined };
}