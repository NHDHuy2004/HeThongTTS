import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { WorkLocationForm } from "./work-location-form";
import { WorkLocationsTable } from "./work-locations-table";
import type { AttendanceLocationsRow } from "@/types/database";

export default async function WorkLocationsPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "admin" && role !== "hr") redirect("/dashboard");

  const supabase = await createClient();

  const [locationsRes, departmentsRes, batchesRes] = await Promise.all([
    supabase
      .from("attendance_locations")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("departments").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("internship_batches").select("id, name").is("deleted_at", null).order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Địa điểm làm việc"
        description="Cấu hình tọa độ GPS, bán kính và khung giờ điểm danh cho từng địa điểm"
        actions={<WorkLocationForm departments={departmentsRes.data ?? []} batches={batchesRes.data ?? []} />}
      />
      <WorkLocationsTable
        data={(locationsRes.data ?? []) as AttendanceLocationsRow[]}
        departments={departmentsRes.data ?? []}
        batches={batchesRes.data ?? []}
      />
    </div>
  );
}
