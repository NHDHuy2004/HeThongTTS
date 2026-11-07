import { redirect } from "next/navigation";
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  LogOut,
  UserX,
  Users,
} from "lucide-react";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ExportCsvButton } from "@/components/export-csv-button";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { AttendanceTable, type AttendanceRowView } from "./attendance-table";
import { InternCheckinPanel, type TodayAttendance } from "./intern-checkin-panel";
import {
  CreateAttendanceButton,
  type InternshipOption,
} from "../admin/attendance/create-attendance-dialog";
import {
  getTodayAttendanceStats,
  getTodayVN,
  summarizeAttendance,
  type AttendanceSummary,
  type TodayAttendanceStats,
} from "@/features/attendance/stats";

export default async function AttendancePage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  const userId = session.user.id;

  const supabase = await createClient();

  let rows: AttendanceRowView[] = [];
  let internshipOptions: InternshipOption[] = [];
  let todayStats: TodayAttendanceStats | null = null;
  let internSummary: AttendanceSummary | null = null;
  let todayRow: TodayAttendance = null;

  if (role === "admin" || role === "hr" || role === "mentor") {
    // Query chính và query option (mentor) chạy song song; thêm 1 query nhẹ
    // cho thống kê "hôm nay" (RLS tự scope theo vai trò / mentor phụ trách).
    const attendancePromise = supabase
      .from("attendance")
      .select("*, interns(full_name)")
      .order("work_date", { ascending: false })
      .limit(300);

    // Chỉ mentor cần danh sách intern cho form tạo; admin/hr dùng ExportCsv.
    const internshipsPromise =
      role === "mentor"
        ? supabase
            .from("internships")
            .select(
              "id, status, interns(full_name, student_code, email), internship_batches(name)",
            )
            .in("status", ["active", "upcoming"])
            .order("created_at", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [] as Record<string, unknown>[] });

    const [{ data }, internshipsRes, todayRes] = await Promise.all([
      attendancePromise,
      internshipsPromise,
      getTodayAttendanceStats(supabase),
    ]);
    rows = (data ?? []) as AttendanceRowView[];
    todayStats = todayRes;

    // RLS internships_select_mentor tự giới hạn về intern phụ trách.
    internshipOptions = (internshipsRes.data as Record<string, unknown>[]).flatMap(
      (row) => {
        const intern = row.interns as
          | { full_name?: string; student_code?: string; email?: string }
          | null;
        const batch = row.internship_batches as { name?: string } | null;
        if (!intern?.full_name) return [];
        return [
          {
            internship_id: row.id as string,
            full_name: intern.full_name,
            student_code: intern.student_code ?? null,
            email: intern.email ?? null,
            batch_name: batch?.name ?? "—",
          },
        ];
      },
    );
  } else if (role === "intern") {
    const { data: myIntern } = await supabase
      .from("interns")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (myIntern) {
      // Hai query song song: danh sách cho bảng + dữ liệu cho thống kê.
      const [listRes, summaryRes] = await Promise.all([
        supabase
          .from("attendance")
          .select("*, interns(full_name)")
          .eq("intern_id", myIntern.id)
          .order("work_date", { ascending: false })
          .limit(200),
        supabase
          .from("attendance")
          .select("status, check_in_at, check_out_at, work_date")
          .eq("intern_id", myIntern.id)
          .order("work_date", { ascending: false })
          .limit(1000),
      ]);
      rows = (listRes.data ?? []) as AttendanceRowView[];

      const summaryRows = (summaryRes.data ?? []) as Array<{
        status: string;
        check_in_at: string | null;
        check_out_at: string | null;
        work_date: string;
      }>;
      internSummary = summarizeAttendance(summaryRows);
      todayRow = summaryRows.find((r) => r.work_date === getTodayVN()) ?? null;
    }
  } else {
    redirect("/dashboard");
  }

  const isManager = role === "admin" || role === "hr" || role === "mentor";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Điểm danh"
        description={
          role === "intern"
            ? "Lịch sử chấm công của bạn"
            : "Danh sách chấm công từ ứng dụng mobile"
        }
        actions={
          role === "mentor" ? (
            <CreateAttendanceButton internships={internshipOptions} />
          ) : role === "admin" || role === "hr" ? (
            <ExportCsvButton href="/api/exports/attendance" />
          ) : undefined
        }
      />

      {role === "intern" && internSummary ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <StatCard
              label="Tổng ngày công"
              value={internSummary.total}
              icon={CalendarCheck}
              tone="emerald"
            />
            <StatCard
              label="Có mặt"
              value={internSummary.present}
              icon={CheckCircle2}
              tone="emerald"
            />
            <StatCard
              label="Đi muộn"
              value={internSummary.late}
              icon={Clock}
              tone="orange"
            />
            <StatCard
              label="Vắng mặt"
              value={internSummary.absent}
              icon={UserX}
              tone="orange"
            />
            <StatCard
              label="Thiếu check-out"
              value={internSummary.missingCheckout}
              icon={LogOut}
              tone="orange"
            />
            <StatCard
              label="Chuyên cần"
              value={`${internSummary.attendanceRate}%`}
              icon={CheckCircle2}
              tone="emerald"
            />
          </div>
          <InternCheckinPanel today={todayRow} />
        </>
      ) : null}

      {isManager && todayStats ? (
        <div
          className={
            role === "mentor"
              ? "grid grid-cols-2 gap-4 md:grid-cols-5"
              : "grid grid-cols-2 gap-4 md:grid-cols-4"
          }
        >
          {role === "mentor" ? (
            <StatCard
              label="Intern phụ trách"
              value={internshipOptions.length}
              icon={Users}
              tone="emerald"
            />
          ) : null}
          <StatCard
            label="Đã check-in hôm nay"
            value={todayStats.checkedIn}
            icon={CheckCircle2}
            tone="emerald"
          />
          <StatCard
            label="Đi muộn hôm nay"
            value={todayStats.late}
            icon={Clock}
            tone="orange"
          />
          <StatCard
            label="Vắng hôm nay"
            value={todayStats.absent}
            icon={UserX}
            tone="orange"
          />
          <StatCard
            label="Chưa check-out"
            value={todayStats.missingCheckout}
            icon={LogOut}
            tone="orange"
          />
        </div>
      ) : null}

      <AttendanceTable
        data={rows}
        showInternFilter={role === "mentor"}
        showMonthFilter={role === "intern" || role === "mentor"}
      />
    </div>
  );
}
