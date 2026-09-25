import { notFound, redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { loadOnboardingDetail, loadOnboardingDetailOptions } from "@/features/onboarding/data";
import { OnboardingDetailView } from "@/features/onboarding/detail-view";

export default async function MentorOnboardingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  if (session.profile?.role_code !== "mentor") redirect("/dashboard");
  const { id } = await params;
  const [detail, options] = await Promise.all([
    loadOnboardingDetail(id),
    loadOnboardingDetailOptions("mentor"),
  ]);
  if (!detail) notFound();
  return <OnboardingDetailView detail={detail} role="mentor" currentUserId={session.user.id} options={options} />;
}
