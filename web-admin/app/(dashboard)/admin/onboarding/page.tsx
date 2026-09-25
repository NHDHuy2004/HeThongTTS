import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { formatDate } from "@/features/labels";
import { CreateOnboardingRecordForm } from "@/features/onboarding/create-record-form";
import { loadOnboardingPage, loadOnboardingRecordOptions } from "@/features/onboarding/data";
import { OnboardingProgress } from "@/features/onboarding/progress";
import { OnboardingRecordList } from "@/features/onboarding/record-list";
import { OnboardingStatsCards } from "@/features/onboarding/stats-cards";

function value(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuth();
  const role = session.profile?.role_code;
  if (role !== "admin" && role !== "hr") redirect("/dashboard");

  const params = await searchParams;
  const [pageData, options] = await Promise.all([
    loadOnboardingPage(role, {
      q: value(params.q),
      status: value(params.status),
      batchId: value(params.batch_id),
      departmentId: value(params.department_id),
      startFrom: value(params.start_from),
      startTo: value(params.start_to),
      sort: value(params.sort),
      direction: value(params.direction),
      page: Number(value(params.page) ?? 1) || 1,
    }),
    loadOnboardingRecordOptions(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quản lý Onboarding"
        description="Theo dõi hồ sơ, checklist, tài liệu và tiến độ sẵn sàng cho kỳ thực tập."
        actions={
          <>
            {role === "admin" ? (
              <Button variant="outline" nativeButton={false} render={<Link href="/admin/onboarding/templates" />}>
                <Settings2 />Cấu hình
              </Button>
            ) : null}
            <CreateOnboardingRecordForm
              internships={options.internships}
              templates={options.templates}
              hrUsers={options.hrUsers}
              currentUserId={session.user.id}
            />
          </>
        }
      />

      <OnboardingStatsCards stats={pageData.stats} />

      <OnboardingRecordList
        basePath="/admin/onboarding"
        records={pageData.records}
        total={pageData.total}
        page={pageData.page}
        pageSize={pageData.pageSize}
        filters={pageData.filters}
        batches={pageData.batches}
        departments={pageData.departments}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Tỷ lệ hoàn tất theo đợt</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {pageData.stats.by_batch.length ? pageData.stats.by_batch.map((item) => (
              <div key={item.id} className="space-y-1.5">
                <div className="flex justify-between text-xs"><span>{item.batch_name}</span><span>{item.completion_rate ?? 0}%</span></div>
                <OnboardingProgress value={Number(item.completion_rate ?? 0)} />
              </div>
            )) : <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tỷ lệ hoàn tất theo phòng ban</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {pageData.stats.by_department.length ? pageData.stats.by_department.map((item) => (
              <div key={item.id} className="space-y-1.5">
                <div className="flex justify-between text-xs"><span>{item.department_name}</span><span>{item.completion_rate ?? 0}%</span></div>
                <OnboardingProgress value={Number(item.completion_rate ?? 0)} />
              </div>
            )) : <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>}
          </CardContent>
        </Card>
      </div>

      {pageData.stats.incomplete.length ? (
        <Card>
          <CardHeader><CardTitle>Cần ưu tiên</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {pageData.stats.incomplete.map((item) => (
              <Link key={item.id} href={`/admin/onboarding/${item.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-emerald-700">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.full_name}</p>
                  <p className="text-xs text-muted-foreground">{item.code} · {item.batch_name} · hạn {formatDate(item.due_date)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2"><StatusBadge value={item.status} /><span className="text-xs font-semibold">{item.progress_percent}%</span></div>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
