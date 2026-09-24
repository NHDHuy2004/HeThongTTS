import { redirect } from "next/navigation";
import type {
  LateRequestsRow,
  LeaveRequestsRow,
  WorkFromHomeRequestsRow,
} from "@/types/database";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { RequestsView } from "./requests-view";

export default async function RequestsPage() {
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

  const leaveQuery = supabase.from("leave_requests").select("*, interns(full_name)");
  const wfhQuery = supabase.from("work_from_home_requests").select("*, interns(full_name)");
  const lateQuery = supabase.from("late_requests").select("*, interns(full_name)");

  const leaveRows = internIds.length ? leaveQuery.in("intern_id", internIds) : leaveQuery;
  const wfhRows = internIds.length ? wfhQuery.in("intern_id", internIds) : wfhQuery;
  const lateRows = internIds.length ? lateQuery.in("intern_id", internIds) : lateQuery;

  const [leaveRes, wfhRes, lateRes] = await Promise.all([
    leaveRows.order("created_at", { ascending: false }).limit(200),
    wfhRows.order("created_at", { ascending: false }).limit(200),
    lateRows.order("created_at", { ascending: false }).limit(200),
  ]);

  const leave = (leaveRes.data ?? []) as (LeaveRequestsRow & {
    interns: { full_name: string } | null;
  })[];
  const wfh = (wfhRes.data ?? []) as (WorkFromHomeRequestsRow & {
    interns: { full_name: string } | null;
  })[];
  const late = (lateRes.data ?? []) as (LateRequestsRow & {
    interns: { full_name: string } | null;
  })[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Đơn từ"
        description={
          role === "intern"
            ? "Các đơn xin nghỉ / làm từ xa / đi muộn của bạn"
            : "Tiếp nhận và duyệt đơn của thực tập sinh"
        }
      />
      <RequestsView
        leave={leave}
        wfh={wfh}
        late={late}
        canReview={role === "admin" || role === "hr" || role === "mentor"}
      />
    </div>
  );
}