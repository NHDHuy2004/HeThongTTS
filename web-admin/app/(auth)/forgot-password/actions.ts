"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthErrorMessage } from "@/lib/errors";

export type ForgotState = { success?: string; error?: string };

export async function requestPasswordReset(
  prevState: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Email không hợp lệ." };
  }

  const supabase = await createClient();
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin.origin}/reset-password`,
  });

  if (error) {
    return { error: getAuthErrorMessage(error) };
  }

  return {
    success: "Nếu email tồn tại, hệ thống đã gửi link đặt lại mật khẩu. Kiểm tra hộp thư (kể cả thư rác).",
  };
}