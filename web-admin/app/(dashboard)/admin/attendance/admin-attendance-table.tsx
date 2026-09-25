"use client";

import * as React from "react";

import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/features/labels";
import type { AttendanceRow } from "@/types/database";
import { AdjustAttendanceButton } from "./adjust-dialog";

export type AdminAttendanceRow = AttendanceRow & {
  interns: { full_name: string } | null;
  attendance_locations: { name: string } | null;
};

function timeOnly(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function AdminAttendanceTable({ data }: { data: AdminAttendanceRow[] }) {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [status, setStatus] = React.useState("");

  const filtered = React.useMemo(() => {
    return data.filter((row) => {
      if (from && row.work_date < from) return false;
      if (to && row.work_date > to) return false;
      if (status && row.status !== status) return false;
      return true;
    });
  }, [data, from, to, status]);

  const columns: Column<AdminAttendanceRow>[] = [
    { key: "work_date", header: "Ngày", cell: (r) => formatDate(r.work_date) },
    {
      key: "intern_id",
      header: "Thực tập sinh",
      cell: (r) => r.interns?.full_name ?? "—",
    },
    {
      key: "location_id",
      header: "Địa điểm",
      cell: (r) => r.attendance_locations?.name ?? "—",
    },
    {
      key: "check_in_at",
      header: "Check-in",
      cell: (r) => (
        <div className="flex flex-col">
          <span className="font-medium">{timeOnly(r.check_in_at)}</span>
          <span className="text-xs text-muted-foreground">
            {r.check_in_distance_meters != null ? `${r.check_in_distance_meters} m` : "—"}
            {r.check_in_accuracy != null ? ` · ±${Math.round(r.check_in_accuracy)} m` : ""}
          </span>
        </div>
      ),
    },
    {
      key: "check_out_at",
      header: "Check-out",
      cell: (r) => (
        <div className="flex flex-col">
          <span className="font-medium">{timeOnly(r.check_out_at)}</span>
          <span className="text-xs text-muted-foreground">
            {r.check_out_distance_meters != null ? `${r.check_out_distance_meters} m` : "—"}
            {r.check_out_accuracy != null ? ` · ±${Math.round(r.check_out_accuracy)} m` : ""}
          </span>
        </div>
      ),
    },
    {
      key: "total_working_minutes",
      header: "Tổng giờ",
      cell: (r) =>
        r.total_working_minutes != null
          ? `${Math.floor(r.total_working_minutes / 60)}h${String(
              r.total_working_minutes % 60,
            ).padStart(2, "0")}`
          : "—",
    },
    { key: "status", header: "Trạng thái", cell: (r) => <StatusBadge value={r.status} /> },
    {
      key: "is_geo_validated",
      header: "GPS",
      cell: (r) => (
        <span className={r.is_geo_validated ? "text-emerald-600" : "text-muted-foreground"}>
          {r.is_geo_validated ? "Đã xác minh" : "Chưa xác minh"}
        </span>
      ),
    },
    { key: "note", header: "Ghi chú", cell: (r) => r.note ?? "—" },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex justify-end">
          <AdjustAttendanceButton attendanceId={r.id} currentStatus={r.status} />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="att-from">
            Từ ngày
          </label>
          <input
            id="att-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="att-to">
            Đến ngày
          </label>
          <input
            id="att-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="att-status">
            Trạng thái
          </label>
          <select
            id="att-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="">Tất cả</option>
            <option value="present">Có mặt</option>
            <option value="late">Đi muộn</option>
            <option value="early_leave">Về sớm</option>
            <option value="absent">Vắng</option>
            <option value="leave">Nghỉ phép</option>
            <option value="wfh">Làm từ xa</option>
          </select>
        </div>
      </div>
      <DataTable
        data={filtered}
        columns={columns}
        searchKeys={["interns.full_name", "note"]}
        searchPlaceholder="Tìm theo tên thực tập sinh..."
      />
    </div>
  );
}
