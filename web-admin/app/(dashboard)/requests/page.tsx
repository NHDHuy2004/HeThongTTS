import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";

export default async function RequestsRedirectPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";

  if (role === "intern") redirect("/intern/requests");
  redirect("/admin/requests");
}
