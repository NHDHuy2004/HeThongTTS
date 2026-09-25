import { redirect } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { loadInternOnboarding, loadOnboardingDetailOptions } from "@/features/onboarding/data";
import { OnboardingDetailView } from "@/features/onboarding/detail-view";
import { InternOnboardingProfileForm } from "@/features/onboarding/intern-profile-form";
import { OnboardingNotificationList } from "@/features/onboarding/notification-list";

export default async function InternOnboardingPage() {
  const session = await requireAuth();
  if (session.profile?.role_code !== "intern") redirect("/dashboard");
  const { detail, intern, notifications } = await loadInternOnboarding(session.user.id);

  if (!detail) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Onboarding của bạn"
          description="Theo dõi checklist, tài liệu và thời hạn trước khi bắt đầu kỳ thực tập."
          actions={intern ? <InternOnboardingProfileForm intern={intern} /> : undefined}
        />
        <OnboardingNotificationList notifications={notifications} />
        <EmptyState
          title="Chưa có hồ sơ onboarding"
          description="HR hoặc mentor chưa tạo hồ sơ cho bạn. Vui lòng liên hệ người phụ trách nếu cần hỗ trợ."
        />
      </div>
    );
  }

  const options = await loadOnboardingDetailOptions("intern", detail.intern?.id ?? undefined);
  return (
    <div className="flex flex-col gap-6">
      <OnboardingNotificationList notifications={notifications} />
      <OnboardingDetailView detail={detail} role="intern" currentUserId={session.user.id} options={{ ...options, intern }} />
    </div>
  );
}
