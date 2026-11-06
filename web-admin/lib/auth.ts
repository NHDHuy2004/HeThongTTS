import { cache } from "react";
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
 *
 * Bọc `React.cache` để dedupe trong cùng một request: layout và page đều
 * gọi `requireAuth` — nếu không cache, mỗi request chạy 2× `auth.getUser()`
 * (round-trip tới Supabase Auth) + 2× query `profiles`. Với cache, chỉ chạy
 * 1 lần và mọi nơi dùng chung kết quả (scoped theo request, không cache
 * giữa các request nên không rò rỉ dữ liệu người dùng).
 */
export const requireAuth = cache(
  async (): Promise<NonNullable<SessionUser>> => {
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
  },
);

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