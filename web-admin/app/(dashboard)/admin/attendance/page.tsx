import { redirect } from "next/navigation";
import { Download } from "lucide-react";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AdminAttendanceTable, type AdminAttendanceRow } from "./admin-attendance-table";
import {
  VerificationLogsTable,
  type VerificationLogRow,
} from "./verification-logs-table";

export default async function AdminAttendancePage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "admin" && role !== "hr") redirect("/dashboard");

  const supabase = await createClient();

  const [attendanceRes, logsRes] = await Promise.all([
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
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quản lý điểm danh"
        description="Điểm danh GPS đã được xác minh ở backend — kèm lịch sử các lượt bị từ chối"
        actions={
          <a
            href="/api/exports/attendance"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
          >
            <Download className="size-4" />
            Xuất CSV
          </a>
        }
      />

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
