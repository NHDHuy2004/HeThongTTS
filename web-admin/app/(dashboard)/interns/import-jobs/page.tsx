import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/features/labels";

export default async function ImportJobsPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "admin" && role !== "hr") redirect("/interns");

  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("import_jobs")
    .select("*, internship_batches(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  const totalImported = (jobs ?? []).reduce((a, j) => a + (j.success_rows ?? 0), 0);
  const totalFailed = (jobs ?? []).reduce((a, j) => a + (j.failed_rows ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Lịch sử import" description={`Tổng ${(jobs ?? []).length} lần import · ${totalImported} thành công · ${totalFailed} lỗi`} />
      <div className="flex flex-col gap-2">
        {(jobs ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có lịch sử import.</p>
        ) : (
          (jobs ?? []).map((j) => (
            <Card key={j.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">{j.file_name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">
                    {j.internship_batches?.name ?? "—"} · {j.import_type} · {j.import_mode === "strict" ? "Nghiêm ngặt" : "Từng phần"} · {formatDateTime(j.created_at)}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>Tổng: <b>{j.total_rows}</b></span>
                  <span className="text-emerald-600">OK: <b>{j.success_rows}</b></span>
                  <span className="text-amber-600">Trùng: <b>{j.duplicate_rows}</b></span>
                  <span className="text-red-600">Lỗi: <b>{j.failed_rows}</b></span>
                  <span>Trạng thái: <b>{j.status}</b></span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
