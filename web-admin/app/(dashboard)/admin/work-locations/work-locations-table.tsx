"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/data-table";
import type { AttendanceLocationsRow } from "@/types/database";
import { DeleteWorkLocation, ToggleWorkLocation, WorkLocationForm } from "./work-location-form";
import type { LocationOption } from "./work-location-form";

function timeRange(start?: string | null, end?: string | null) {
  const s = start?.slice(0, 5) ?? "—";
  const e = end?.slice(0, 5) ?? "—";
  return `${s} → ${e}`;
}

export function WorkLocationsTable({
  data,
  departments,
  batches,
}: {
  data: AttendanceLocationsRow[];
  departments: LocationOption[];
  batches: LocationOption[];
}) {
  const deptName = (id: string | null) =>
    id ? departments.find((d) => d.id === id)?.name ?? "—" : "Tất cả";
  const batchName = (id: string | null) =>
    id ? batches.find((b) => b.id === id)?.name ?? "—" : "Tất cả";

  const columns: Column<AttendanceLocationsRow>[] = [
    {
      key: "name",
      header: "Tên địa điểm",
      cell: (r) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{r.name}</span>
          <span className="text-xs text-muted-foreground">{r.code ?? "Không có mã"}</span>
        </div>
      ),
    },
    { key: "address", header: "Địa chỉ", cell: (r) => r.address ?? "—" },
    {
      key: "latitude",
      header: "Tọa độ",
      cell: (r) => (
        <span className="font-mono text-xs">
          {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
        </span>
      ),
    },
    {
      key: "radius_m",
      header: "Bán kính",
      cell: (r) => (
        <span>
          {r.radius_m} m · GPS ≤ {r.min_accuracy_meters} m
        </span>
      ),
    },
    {
      key: "check_in_start_time",
      header: "Khung giờ",
      cell: (r) => (
        <div className="flex flex-col gap-0.5 text-xs">
          <span>Vào: {timeRange(r.check_in_start_time, r.check_in_end_time)}</span>
          <span>Ra: {timeRange(r.check_out_start_time, r.check_out_end_time)}</span>
        </div>
      ),
    },
    { key: "department_id", header: "Phòng ban", cell: (r) => deptName(r.department_id) },
    {
      key: "internship_batch_id",
      header: "Đợt thực tập",
      cell: (r) => batchName(r.internship_batch_id),
    },
    {
      key: "is_active",
      header: "Trạng thái",
      cell: (r) => (
        <Badge variant={r.is_active ? "default" : "secondary"}>
          {r.is_active ? "Hoạt động" : "Tạm tắt"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <WorkLocationForm location={r} departments={departments} batches={batches} />
          <ToggleWorkLocation id={r.id} isActive={r.is_active} />
          <DeleteWorkLocation id={r.id} name={r.name} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={data}
      columns={columns}
      searchKeys={["name", "code", "address"]}
      searchPlaceholder="Tìm theo tên, mã, địa chỉ..."
    />
  );
}
