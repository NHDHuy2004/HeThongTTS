import { createAdminClient } from "./supabase.ts";
import { AppError } from "./errors.ts";

export type CallerRole = "admin" | "hr" | "mentor" | "intern" | null;

/**
 * Giải mã user từ Authorization Bearer token.
 * Không resolve được (service role / không có header) → trả null
 * (cho phép gọi nội bộ từ Server Action / cron).
 */
export async function getCallerUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const profile = await getProfileRole(data.user.id);
  return { user: data.user, role: profile?.role ?? null, profile };
}

function getProfileRole(userId: string) {
  const supabase = createAdminClient();
  return supabase
    .from("profiles")
    .select("id, email, full_name, is_active, roles(code)")
    .eq("id", userId)
    .maybeSingle()
    .then(({ data }) => {
      if (!data || !data.is_active) return null;
      return {
        ...data,
        role: (data.roles as { code: string } | null)?.code ?? null,
      };
    })
    .catch(() => null);
}

/** Bắt buộc role — trả null nếu không thỏa. */
export async function requireRole(
  req: Request,
  allowed: CallerRole[],
): Promise<CallerRole> {
  const caller = await getCallerUser(req);
  if (!caller?.role) {
    throw new AppError("AUTH_ERROR", "Vui lòng đăng nhập", 401);
  }
  if (!allowed.includes(caller.role as CallerRole)) {
    throw new AppError("PERMISSION_DENIED", "Bạn không có quyền thực hiện thao tác này", 403);
  }
  return caller.role as CallerRole;
}