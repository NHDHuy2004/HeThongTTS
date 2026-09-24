import { redirect } from "next/navigation";
import type { DailyReportsRow, WeeklyReportsRow } from "@/types/database";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ReportsView } from "./reports-view";

export default async function ReportsPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  const userId = session.user.id;

  const supabase = await createClient();

  let internIds: string[] = [];

  if (role === "intern") {
    const { data: myIntern } = await supabase
      .from("interns")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (myIntern) internIds = [myIntern.id];
  } else if (role !== "admin" && role !== "hr" && role !== "mentor") {
    redirect("/dashboard");
  }

  const dailyQuery = supabase.from("daily_reports").select("*, interns(full_name)");
  const weeklyQuery = supabase.from("weekly_reports").select("*, interns(full_name)");
  const dailyRows = internIds.length ? dailyQuery.in("intern_id", internIds) : dailyQuery;
  const weeklyRows = internIds.length ? weeklyQuery.in("intern_id", internIds) : weeklyQuery;

  const [dailyRes, weeklyRes] = await Promise.all([
    dailyRows.order("report_date", { ascending: false }).limit(200),
    weeklyRows.order("week_start", { ascending: false }).limit(200),
  ]);

  const daily = (dailyRes.data ?? []) as (DailyReportsRow & {
    interns: { full_name: string } | null;
  })[];
  const weekly = (weeklyRes.data ?? []) as (WeeklyReportsRow & {
    interns: { full_name: string } | null;
  })[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Báo cáo"
        description={
          role === "intern"
            ? "Các báo cáo hàng ngày / hàng tuần của bạn"
            : "Theo dõi và nhận xét báo cáo thực tập sinh"
        }
      />
      <ReportsView
        daily={daily}
        weekly={weekly}
        canReview={role === "admin" || role === "hr" || role === "mentor"}
      />
    </div>
  );
}