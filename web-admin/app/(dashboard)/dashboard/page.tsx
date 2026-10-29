import Link from "next/link";
import {
  Award,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  Inbox,
  Users,
  UsersRound,
} from "lucide-react";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardCharts } from "@/components/charts/dashboard-charts";

export default async function DashboardPage() {
  const session = await requireAuth();
  const supabase = await createClient();
  const role = session.profile?.role_code ?? "intern";

  if (role === "admin" || role === "hr") {
    const [{ data }, { data: onboardingData }] = await Promise.all([
      supabase.rpc("get_dashboard_stats"),
      supabase.rpc("get_onboarding_dashboard_stats"),
    ]);
    const stats = (data ?? {}) as Record<string, unknown>;
    const onboardingStats = (onboardingData ?? {}) as Record<string, number>;
    const tasksByStatus =
      (stats.tasks_by_status as Record<string, number> | null) ?? {};
    const totalInterns = Number(stats.total_interns ?? 0);
    const active = Number(stats.interns_active ?? 0);
    const completed = Number(stats.interns_completed ?? 0);
    const converted = Number(stats.converted ?? 0);

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Dashboard"
          description="Tổng quan hoạt động thực tập Đại học Đà Lạt"
        />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Thực tập sinh" value={String(stats.total_interns ?? 0)} icon={Users} tone="emerald" />
          <StatCard label="Mentor" value={String(stats.total_mentors ?? 0)} icon={UsersRound} tone="emerald" />
          <StatCard label="Đợt thực tập" value={String(stats.total_batches ?? 0)} icon={CalendarRange} tone="orange" />
          <StatCard label="Đang thực tập" value={String(stats.interns_active ?? 0)} icon={CheckCircle2} tone="emerald" />
          <StatCard label="Đã hoàn thành" value={String(stats.interns_completed ?? 0)} icon={Award} tone="emerald" />
          <StatCard label="Chuyển NV chính thức" value={String(stats.converted ?? 0)} icon={UsersRound} tone="orange" />
          <StatCard label="Chuyên cần" value={`${stats.attendance_rate ?? 0}%`} icon={Clock} tone="orange" />
          <StatCard label="Hoàn thành task" value={`${stats.task_completion_rate ?? 0}%`} icon={ClipboardList} tone="emerald" />
          <StatCard label="Onboarding hoàn tất" value={String(onboardingStats.completed ?? 0)} icon={ClipboardCheck} tone="emerald" />
          <StatCard label="Onboarding quá hạn" value={String(onboardingStats.overdue ?? 0)} icon={Clock} tone="orange" />
        </div>

        <DashboardCharts
          tasksByStatus={tasksByStatus}
          internSummary={{
            active,
            completed,
            converted,
            other: Math.max(0, totalInterns - active - completed - converted),
          }}
        />
      </div>
    );
  }

  if (role === "mentor") {
    const [{ data }, { data: onboardingData }] = await Promise.all([
      supabase.rpc("get_mentor_stats"),
      supabase.rpc("get_onboarding_dashboard_stats"),
    ]);
    const stats = (data ?? {}) as Record<string, number>;
    const onboardingStats = (onboardingData ?? {}) as Record<string, number>;

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Dashboard"
          description="Tổng quan intern bạn đang phụ trách"
        />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Intern phụ trách" value={String(stats.interns ?? 0)} icon={Users} tone="emerald" />
          <StatCard label="Báo cáo chờ duyệt" value={String(stats.pending_reports ?? 0)} icon={FileText} tone="orange" />
          <StatCard label="Đơn chờ duyệt" value={String(stats.pending_requests ?? 0)} icon={Inbox} tone="orange" />
          <StatCard label="Task đang mở" value={String(stats.open_tasks ?? 0)} icon={ClipboardList} tone="emerald" />
          <StatCard label="Onboarding đang thực hiện" value={String(onboardingStats.in_progress ?? 0)} icon={ClipboardCheck} tone="orange" />
          <StatCard label="Onboarding chờ duyệt" value={String(onboardingStats.pending_review ?? 0)} icon={ClipboardCheck} tone="orange" />
        </div>
      </div>
    );
  }

  // Intern
  const { data: intern } = await supabase
    .from("interns")
    .select("id")
    .eq("user_id", session.user.id)
    .is("deleted_at", null)
    .maybeSingle();

  const { data: internships } = intern
    ? await supabase
        .from("internships")
        .select("id, status")
        .eq("intern_id", intern.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  const internshipId = internships?.[0]?.id;

  const [{ count: taskCount }, { count: attendanceCount }, { count: pendingReports }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("internship_id", internshipId ?? ""),
      supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("intern_id", intern?.id ?? ""),
      supabase
        .from("daily_reports")
        .select("id", { count: "exact", head: true })
        .eq("intern_id", intern?.id ?? "")
        .not("status", "eq", "draft"),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Tình hình thực tập của bạn"
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Task được giao" value={taskCount ?? 0} icon={ClipboardList} tone="emerald" />
        <StatCard label="Ngày điểm danh" value={attendanceCount ?? 0} icon={Clock} tone="emerald" />
        <StatCard label="Báo cáo đã nộp" value={pendingReports ?? 0} icon={FileText} tone="orange" />
        <StatCard label="Trạng thái" value={internships?.[0]?.status ?? "—"} icon={CheckCircle2} tone="emerald" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hướng dẫn nhanh</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-inside list-disc space-y-1">
            <li>
              <Link href="/intern/onboarding" className="text-primary hover:underline">
                Onboarding
              </Link>
              : theo dõi checklist, tài liệu và hạn hoàn thành.
            </li>
            <li>
              <Link href="/tasks" className="text-primary hover:underline">
                Công việc
              </Link>
              : cập nhật tiến độ task của bạn.
            </li>
            <li>
              <Link href="/reports" className="text-primary hover:underline">
                Báo cáo
              </Link>
              : nộp báo cáo ngày / tuần.
            </li>
            <li>
              <Link href="/requests" className="text-primary hover:underline">
                Đơn từ
              </Link>
              : gửi đơn nghỉ phép, đi muộn...
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}