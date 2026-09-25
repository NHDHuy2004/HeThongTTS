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
  type LucideIcon,
} from "lucide-react";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

import { cn } from "cn";

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "emerald",
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: "emerald" | "orange";
}) {
  const isEmerald = tone === "emerald";
  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border border-border/80 bg-card">
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-1 transition-all",
          isEmerald ? "bg-emerald-600 group-hover:h-1.5" : "bg-orange-500 group-hover:h-1.5",
        )}
      />
      <CardContent className="flex items-center justify-between p-4 pt-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground tracking-wide">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-105",
            isEmerald
              ? "bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-400"
              : "bg-orange-500/12 text-orange-700 ring-1 ring-orange-500/20 dark:bg-orange-950/50 dark:text-orange-400",
          )}
        >
          <Icon className="size-5.5" />
        </div>
      </CardContent>
    </Card>
  );
}

function RecentList({
  items,
  emptyLabel,
}: {
  items: { id: string; title: string; status?: string; date?: string }[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/40 transition-colors">
          <span className="min-w-0 truncate text-sm font-medium">{item.title}</span>
          <span className="flex shrink-0 items-center gap-2">
            {item.status ? <StatusBadge value={item.status} /> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

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
    const batchesByStatus =
      (stats.batches_by_status as Record<string, number> | null) ?? {};

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

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Task theo trạng thái</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentList
                items={Object.entries(tasksByStatus).map(([status, count]) => ({
                  id: status,
                  title: `${status}: ${String(count)}`,
                  status,
                }))}
                emptyLabel="Chưa có task nào."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Đợt thực tập theo trạng thái</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentList
                items={Object.entries(batchesByStatus).map(([status, count]) => ({
                  id: status,
                  title: `${status}: ${String(count)}`,
                  status,
                }))}
                emptyLabel="Chưa có đợt thực tập nào."
              />
            </CardContent>
          </Card>
        </div>
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