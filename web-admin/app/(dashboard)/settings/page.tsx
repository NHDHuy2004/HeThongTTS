import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SettingsManager } from "./settings-manager";

export default async function SettingsPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "admin") redirect("/dashboard");

  const supabase = await createClient();

  const { data } = await supabase.from("system_settings").select("*").order("key");

  const rows = (data ?? []).map((r) => ({
    key: r.key,
    description: r.description,
    value: r.value,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cấu hình hệ thống"
        description="Khung giờ điểm danh, thông tin công ty, người ký chứng nhận..."
      />
      <SettingsManager rows={rows} />
    </div>
  );
}