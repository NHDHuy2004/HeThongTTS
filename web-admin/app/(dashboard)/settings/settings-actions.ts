"use server";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type SettingFormState = { error?: string };

export async function updateSetting(
  prevState: SettingFormState,
  formData: FormData,
): Promise<SettingFormState> {
  const supabase = await createClient();

  const { data: role } = await supabase.rpc("get_my_role");
  if (role !== "admin") return { error: "Bạn không có quyền chỉnh cấu hình." };

  const key = String(formData.get("key") ?? "");
  const valueRaw = String(formData.get("value") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!key || !valueRaw) return { error: "Thiếu key hoặc giá trị." };

  let value: unknown;
  try {
    value = JSON.parse(valueRaw);
  } catch {
    return { error: "Giá trị phải là JSON hợp lệ." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("system_settings").upsert({
    key,
    value: value as Json,
    description,
    updated_by: user?.id ?? null,
  });

  if (error) return { error: error.message };
  return {};
}