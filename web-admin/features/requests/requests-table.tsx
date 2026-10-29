"use client";

import * as React from "react";
import Link from "next/link";

import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import {
  formatDate,
  formatDateTime,
  requestTypeLabel,
} from "@/features/labels";
import type { RequestsRow } from "@/types/database";

export type RequestRowView = RequestsRow & {
  interns: { full_name: string; student_code: string | null } | null;
  profiles: { full_name: string } | null;
};

const STATUS_FILTERS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "pending", label: "Chờ xử lý" },
  { value: "in_review", label: "Đang xem xét" },
  { value: "needs_revision", label: "Cần bổ sung" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Từ chối" },
  { value: "cancelled", label: "Đã hủy" },
] as const;

function periodOf(row: RequestsRow): string {
  if (!row.start_date) return "—";
  const from = formatDate(row.start_date);
  if (!row.end_date || row.end_date === row.start_date) {
    return row.requested_start_time || row.requested_end_time
      ? `${from} ${row.requested_start_time?.slice(0, 5) ?? row.requested_end_time?.slice(0, 5) ?? ""}`
      : from;
  }
  return `${from} – ${formatDate(row.end_date)}`;
}

export function RequestsTable({
  rows,
  mode,
  detailBase,
}: {
  rows: RequestRowView[];
  mode: "mine" | "review";
  detailBase: string;
}) {
  const [status, setStatus] = React.useState("");
  const [type, setType] = React.useState("");

  const filtered = rows.filter((r) => {
    if (status && r.status !== status) return false;
    if (type && r.request_type !== type) return false;
    return true;
  });

  const columns: Column<RequestRowView>[] = [
    {
      key: "code",
      header: "Mã đơn",
      className: "font-mono text-xs",
      cell: (r) => r.request_code,
    },
  ];
  if (mode === "review") {
    columns.push({
      key: "intern",
      header: "Thực tập sinh",
      cell: (r) => (
        <>
          <div>{r.interns?.full_name ?? "—"}</div>
          {r.interns?.student_code ? (
            <div className="text-xs text-muted-foreground">
              {r.interns.student_code}
            </div>
          ) : null}
        </>
      ),
    });
  }
  columns.push(
    {
      key: "type",
      header: "Loại",
      cell: (r) => requestTypeLabel[r.request_type] ?? r.request_type,
    },
    {
      key: "title",
      header: "Tiêu đề",
      className: "max-w-[16rem]",
      cell: (r) => (
        <span className="block truncate" title={r.title}>
          {r.title}
        </span>
      ),
    },
    {
      key: "period",
      header: "Thời gian",
      className: "whitespace-nowrap",
      cell: (r) => periodOf(r),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (r) => <StatusBadge value={r.status} />,
    },
    {
      key: "submitted",
      header: "Nộp lúc",
      className: "whitespace-nowrap text-xs text-muted-foreground",
      cell: (r) => formatDateTime(r.submitted_at),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (r) => (
        <Link
          href={`${detailBase}/${r.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Xem
        </Link>
      ),
    },
  );

  return (
    <DataTable
      data={filtered}
      columns={columns}
      rowKey={(r) => r.id}
      searchText={(r) =>
        `${r.request_code} ${r.title} ${r.reason ?? ""} ${r.interns?.full_name ?? ""}`
      }
      searchPlaceholder="Tìm mã đơn, tiêu đề, thực tập sinh..."
      emptyState={{
        title: "Không có đơn",
        description:
          rows.length === 0
            ? "Chưa có đơn nào — hãy tạo đơn từ nút phía trên."
            : "Không có đơn khớp bộ lọc.",
      }}
      toolbar={
        <>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Lọc trạng thái"
            className="h-9 rounded-lg border bg-background px-2 text-sm"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Lọc loại đơn"
            className="h-9 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="">Tất cả loại đơn</option>
            <option value="leave">Nghỉ phép</option>
            <option value="wfh">Làm từ xa</option>
            <option value="late">Đi muộn</option>
            <option value="early_leave">Về sớm</option>
            <option value="attendance_adjustment">Điều chỉnh chấm công</option>
            <option value="schedule_change">Thay đổi lịch làm</option>
            <option value="other">Khác</option>
          </select>
          <span className="text-xs text-muted-foreground tabular-nums">
            {filtered.length}/{rows.length} đơn
          </span>
        </>
      }
    />
  );
}
