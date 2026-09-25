import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { loadOnboardingPage } from "@/features/onboarding/data";
import { OnboardingRecordList } from "@/features/onboarding/record-list";
import { OnboardingStatsCards } from "@/features/onboarding/stats-cards";

function value(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MentorOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuth();
  if (session.profile?.role_code !== "mentor") redirect("/dashboard");
  const params = await searchParams;
  const pageData = await loadOnboardingPage("mentor", {
    q: value(params.q),
    status: value(params.status),
    batchId: value(params.batch_id),
    departmentId: value(params.department_id),
    startFrom: value(params.start_from),
    startTo: value(params.start_to),
    sort: value(params.sort),
    direction: value(params.direction),
    page: Number(value(params.page) ?? 1) || 1,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Onboarding được phân công"
        description="Theo dõi checklist và các mốc tiếp nhận của thực tập sinh bạn hướng dẫn."
      />
      <OnboardingStatsCards stats={pageData.stats} />
      <OnboardingRecordList
        basePath="/mentor/onboarding"
        records={pageData.records}
        total={pageData.total}
        page={pageData.page}
        pageSize={pageData.pageSize}
        filters={pageData.filters}
        batches={pageData.batches}
        departments={pageData.departments}
      />
    </div>
  );
}
