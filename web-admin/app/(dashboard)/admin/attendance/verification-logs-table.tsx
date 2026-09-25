"use client";

import { DataTable, type Column } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/features/labels";
import type { AttendanceVerificationLogsRow } from "@/types/database";

export type VerificationLogRow = AttendanceVerificationLogsRow & {
  profiles: { full_name: string } | null;
};

const ACTION_LABEL: Record<string, string> = {
  CHECK_IN: "Check-in",
  CHECK_OUT: "Check-out",
  ADJUST: "Điều chỉnh",
};

const REASON_LABEL: Record<string, string> = {
  NO_ASSIGNED_LOCATION: "Chưa được gán địa điểm",
  LOCATION_OUT_OF_RANGE: "Ngoài khu vực điểm danh",
  LOCATION_INACTIVE: "Địa điểm không hoạt động",
  ACCURACY_NOT_MET: "Độ chính xác GPS chưa đạt",
  CHECK_IN_TOO_EARLY: "Chưa đến giờ check-in",
  CHECK_IN_WINDOW_CLOSED: "Đã hết giờ check-in",
  CHECK_OUT_WINDOW_CLOSED: "Đã hết giờ check-out",
  ALREADY_CHECKED_IN: "Đã check-in rồi",
  ALREADY_CHECKED_OUT: "Đã check-out rồi",
  NEED_CHECK_IN: "Chưa check-in",
  WRITE_FAILED: "Lỗi ghi dữ liệu",
};

function reasonText(row: VerificationLogRow) {
  if (row.action === "ADJUST") return row.failure_reason ?? "—";
  const code = row.failure_reason ?? "";
  return (REASON_LABEL[code] ?? code) || "—";
}

export function VerificationLogsTable({ data }: { data: VerificationLogRow[] }) {
  const columns: Column<VerificationLogRow>[] = [
    {
      key: "verified_at",
      header: "Thời gian",
      cell: (r) => formatDateTime(r.verified_at),
    },
    {
      key: "user_id",
      header: "Người dùng",
      cell: (r) => r.profiles?.full_name ?? "—",
    },
    {
      key: "action",
      header: "Thao tác",
      cell: (r) => <Badge variant="outline">{ACTION_LABEL[r.action] ?? r.action}</Badge>,
    },
    {
      key: "distance_meters",
      header: "Khoảng cách",
      cell: (r) => (r.distance_meters != null ? `${r.distance_meters} m` : "—"),
    },
    {
      key: "accuracy",
      header: "Độ chính xác",
      cell: (r) => (r.accuracy != null ? `±${Math.round(r.accuracy)} m` : "—"),
    },
    {
      key: "is_valid",
      header: "Kết quả",
      cell: (r) => (
        <Badge variant={r.is_valid ? "success" : "destructive"}>
          {r.is_valid ? "Hợp lệ" : "Từ chối"}
        </Badge>
      ),
    },
    {
      key: "failure_reason",
      header: "Lý do",
      cell: (r) => reasonText(r),
    },
  ];

  return (
    <DataTable
      data={data}
      columns={columns}
      searchKeys={["profiles.full_name", "failure_reason"]}
      searchPlaceholder="Tìm theo tên hoặc lý do..."
    />
  );
}
