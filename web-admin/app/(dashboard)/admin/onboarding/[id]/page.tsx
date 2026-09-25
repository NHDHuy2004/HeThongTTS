import { notFound, redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { loadOnboardingDetail, loadOnboardingDetailOptions } from "@/features/onboarding/data";
import { OnboardingDetailView } from "@/features/onboarding/detail-view";

export default async function AdminOnboardingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const role = session.profile?.role_code;
  if (role !== "admin" && role !== "hr") redirect("/dashboard");
  const { id } = await params;
  const [detail, options] = await Promise.all([
    loadOnboardingDetail(id),
    loadOnboardingDetailOptions(role),
  ]);
  if (!detail) notFound();
  return <OnboardingDetailView detail={detail} role={role} currentUserId={session.user.id} options={options} />;
}
