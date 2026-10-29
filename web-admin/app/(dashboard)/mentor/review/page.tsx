import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import {
  ReviewQueue,
  type ReviewReportItem,
  type ReviewRequestItem,
} from "./review-queue";

/**
 * Hàng đợi duyệt của mentor — RLS giới hạn chỉ thấy intern phụ trách.
 */
export default async function MentorReviewPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "mentor") redirect("/dashboard");

  const supabase = await createClient();

  const [reportsRes, requestsRes] = await Promise.all([
    supabase
      .from("reports")
      .select(
        "id, report_code, title, report_type, status, period_start, period_end, due_date, submitted_at, interns(full_name)",
      )
      .in("status", ["submitted", "in_review"])
      .order("submitted_at", { ascending: true })
      .limit(50),
    supabase
      .from("requests")
      .select(
        "id, request_code, title, request_type, status, start_date, end_date, submitted_at, interns(full_name)",
      )
      .in("status", ["pending", "in_review"])
      .order("submitted_at", { ascending: true })
      .limit(50),
  ]);

  const reports: ReviewReportItem[] = ((reportsRes.data ?? []) as Record<
    string,
    unknown
  >[]).map((r) => ({
    id: r.id as string,
    report_code: r.report_code as string,
    title: (r.title as string) ?? null,
    report_type: r.report_type as string,
    status: r.status as string,
    period_start: r.period_start as string,
    period_end: r.period_end as string,
    due_date: (r.due_date as string) ?? null,
    submitted_at: (r.submitted_at as string) ?? null,
    intern_name:
      ((r.interns as { full_name?: string } | null)?.full_name as string) ?? null,
  }));

  const requests: ReviewRequestItem[] = ((requestsRes.data ?? []) as Record<
    string,
    unknown
  >[]).map((r) => ({
    id: r.id as string,
    request_code: r.request_code as string,
    title: r.title as string,
    request_type: r.request_type as string,
    status: r.status as string,
    start_date: (r.start_date as string) ?? null,
    end_date: (r.end_date as string) ?? null,
    submitted_at: (r.submitted_at as string) ?? null,
    intern_name:
      ((r.interns as { full_name?: string } | null)?.full_name as string) ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Hàng đợi duyệt"
        description="Báo cáo và đơn từ đang chờ bạn xử lý — duyệt nhanh ngay tại đây"
      />
      <ReviewQueue reports={reports} requests={requests} />
    </div>
  );
}
