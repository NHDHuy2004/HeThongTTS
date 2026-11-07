import { redirect } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  LogOut,
  UserX,
  UserCheck,
} from "lucide-react";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ExportCsvButton } from "@/components/export-csv-button";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { getTodayAttendanceStats } from "@/features/attendance/stats";
import { AdminAttendanceTable, type AdminAttendanceRow } from "./admin-attendance-table";
import { CreateAttendanceButton, type InternshipOption } from "./create-attendance-dialog";
import {
  VerificationLogsTable,
  type VerificationLogRow,
} from "./verification-logs-table";

export default async function AdminAttendancePage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "admin" && role !== "hr") redirect("/dashboard");

  const supabase = await createClient();

  const [attendanceRes, logsRes, internshipsRes, todayStats] = await Promise.all([
    supabase
      .from("attendance")
      .select("*, interns(full_name), attendance_locations(name)")
      .order("work_date", { ascending: false })
      .limit(500),
    supabase
      .from("attendance_verification_logs")
      .select("*, profiles(full_name)")
      .order("verified_at", { ascending: false })
      .limit(200),
    // Danh sách chọn cho form tạo thủ công — RLS tự giới hạn theo vai trò.
    supabase
      .from("internships")
      .select(
        "id, status, interns(full_name, student_code, email), internship_batches(name)",
      )
      .in("status", ["active", "upcoming"])
      .order("created_at", { ascending: false })
      .limit(500),
    // Thống kê hôm nay — 1 query nhẹ theo work_date (index sẵn có).
    getTodayAttendanceStats(supabase),
  ]);

  const activeInterns = ((internshipsRes.data ?? []) as { status?: string }[]).filter(
    (row) => row.status === "active",
  ).length;
  // Chưa check-in = người đang thực tập − đã check-in − nghỉ/WFH hôm nay.
  const notCheckedIn = Math.max(
    0,
    activeInterns - todayStats.checkedIn - todayStats.onLeave - todayStats.workFromHome,
  );

  const internshipOptions: InternshipOption[] = ((
    internshipsRes.data ?? []
  ) as Record<string, unknown>[]).flatMap((row) => {
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
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quản lý điểm danh"
        description="Điểm danh GPS đã được xác minh ở backend — kèm lịch sử các lượt bị từ chối"
        actions={
          <div className="flex items-center gap-2">
            <CreateAttendanceButton internships={internshipOptions} />
            <ExportCsvButton href="/api/exports/attendance" />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Đã check-in hôm nay"
          value={todayStats.checkedIn}
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatCard
          label="Chưa check-in hôm nay"
          value={notCheckedIn}
          icon={UserCheck}
          tone="orange"
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

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Bảng điểm danh</h2>
        <AdminAttendanceTable data={(attendanceRes.data ?? []) as AdminAttendanceRow[]} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          Nhật ký xác minh GPS (gồm các lượt bị từ chối)
        </h2>
        <VerificationLogsTable data={(logsRes.data ?? []) as VerificationLogRow[]} />
      </section>
    </div>
  );
}
