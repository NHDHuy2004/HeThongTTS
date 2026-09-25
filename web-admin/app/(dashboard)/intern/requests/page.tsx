import { Download } from "lucide-react";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CreateRequestButton } from "@/features/requests/request-form";
import {
  RequestsTable,
  type RequestRowView,
} from "@/features/requests/requests-table";

export default async function InternRequestsPage() {
  const session = await requireAuth();
  const userId = session.user.id;
  const supabase = await createClient();

  const [requestsRes, typesRes] = await Promise.all([
    supabase
      .from("requests")
      .select(
        "*, interns(full_name, student_code), profiles!requests_reviewer_id_fkey(full_name)",
      )
      .order("submitted_at", { ascending: false })
      .limit(200),
    supabase
      .from("request_types")
      .select("code, name, requires_attachment")
      .eq("is_active", true)
      .order("code"),
  ]);

  const rows = (requestsRes.data ?? []) as RequestRowView[];
  const types = (typesRes.data ?? []) as Array<{
    code: string;
    name: string;
    requires_attachment: boolean;
  }>;

  const migrationMissing = [requestsRes.error, typesRes.error].some(
    (e) =>
      e?.code === "PGRST205" ||
      e?.code === "42P01" ||
      Boolean(e?.message?.includes("Could not find the table")),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Đơn từ của tôi"
        description="Tạo và theo dõi các đơn nghỉ phép, làm từ xa, đi muộn..."
        actions={
          <a
            href="/api/exports/requests"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
          >
            <Download className="size-4" />
            Xuất CSV
          </a>
        }
      />

      {migrationMissing ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          Chưa tìm thấy bảng <code>requests</code> — hãy chạy migration{" "}
          <code>0017_requests_management.sql</code> trong Supabase Dashboard.
        </div>
      ) : null}

      <div className="flex justify-end">
        <CreateRequestButton userId={userId} types={types} />
      </div>

      <RequestsTable rows={rows} mode="mine" detailBase="/intern/requests" />
    </div>
  );
}
