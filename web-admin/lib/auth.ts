import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export type SessionUser = {
  user: User;
  profile: {
    id: string;
    email: string;
    full_name: string;
    role_id: string | null;
    role_code: string;
  } | null;
};

/**
 * Bắt buộc đăng nhập: chưa đăng nhập → redirect /login.
 * Trả về user + profile (kèm role_code) đọc từ DB.
 */
export async function requireAuth(): Promise<NonNullable<SessionUser>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role_id, roles(code)")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    profile: profile
      ? {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          role_id: profile.role_id,
          role_code: profile.roles?.code ?? "intern",
        }
      : null,
  };
}

/** Profile tùy chọn: trả về null nếu chưa đăng nhập (không redirect). */
export async function getOptionalProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role_id, roles(code)")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
}