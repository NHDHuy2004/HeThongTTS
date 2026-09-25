import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";

export default async function ReportsPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";

  if (role === "intern") redirect("/intern/reports");
  if (role === "admin" || role === "hr" || role === "mentor") {
    redirect("/admin/reports");
  }
  redirect("/dashboard");
}
