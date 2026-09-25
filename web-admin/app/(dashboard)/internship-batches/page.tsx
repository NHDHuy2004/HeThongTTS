import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { BatchForm } from "./batch-form";
import { BatchesTable, type BatchRow } from "./batches-table";

export default async function InternshipBatchesPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "admin" && role !== "hr") redirect("/dashboard");

  const supabase = await createClient();

  const { data: batches } = await supabase
    .from("internship_batches")
    .select("*, profiles(full_name)")
    .is("deleted_at", null)
    .order("start_date", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Đợt thực tập"
        description="Các đợt nhận thực tập sinh"
        actions={<BatchForm />}
      />
      <BatchesTable data={(batches ?? []) as BatchRow[]} />
    </div>
  );
}