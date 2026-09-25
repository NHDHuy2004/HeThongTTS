import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";

export default async function OnboardingRedirectPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";

  if (role === "admin" || role === "hr") redirect("/admin/onboarding");
  if (role === "mentor") redirect("/mentor/onboarding");
  redirect("/intern/onboarding");
}
