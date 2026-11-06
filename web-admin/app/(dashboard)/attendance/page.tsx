import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ExportCsvButton } from "@/components/export-csv-button";
import { PageHeader } from "@/components/page-header";
import { AttendanceTable, type AttendanceRowView } from "./attendance-table";
import {
  CreateAttendanceButton,
  type InternshipOption,
} from "../admin/attendance/create-attendance-dialog";

export default async function AttendancePage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  const userId = session.user.id;

  const supabase = await createClient();

  let rows: AttendanceRowView[] = [];
  let internshipOptions: InternshipOption[] = [];

  if (role === "admin" || role === "hr" || role === "mentor") {
    // Query chính và query option (mentor) chạy song song.
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

    const [{ data }, internshipsRes] = await Promise.all([
      attendancePromise,
      internshipsPromise,
    ]);
    rows = (data ?? []) as AttendanceRowView[];

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
      const { data } = await supabase
        .from("attendance")
        .select("*, interns(full_name)")
        .eq("intern_id", myIntern.id)
        .order("work_date", { ascending: false })
        .limit(200);
      rows = (data ?? []) as AttendanceRowView[];
    }
  } else {
    redirect("/dashboard");
  }

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
      <AttendanceTable data={rows} />
    </div>
  );
}