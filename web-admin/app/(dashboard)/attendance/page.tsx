import { redirect } from "next/navigation";
import { Download } from "lucide-react";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AttendanceTable, type AttendanceRowView } from "./attendance-table";

export default async function AttendancePage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  const userId = session.user.id;

  const supabase = await createClient();

  let rows: AttendanceRowView[] = [];

  if (role === "admin" || role === "hr" || role === "mentor") {
    const { data } = await supabase
      .from("attendance")
      .select("*, interns(full_name)")
      .order("work_date", { ascending: false })
      .limit(300);
    rows = (data ?? []) as AttendanceRowView[];
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
          role === "admin" || role === "hr" ? (
            <a
              href="/api/exports/attendance"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
            >
              <Download className="size-4" />
              Xuất CSV
            </a>
          ) : undefined
        }
      />
      <AttendanceTable data={rows} />
    </div>
  );
}