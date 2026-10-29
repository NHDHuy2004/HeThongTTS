"use client";

import * as React from "react";
import Link from "next/link";

import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatDateTime, reportTypeLabel } from "@/features/labels";
import { REPORT_STATUS_FILTERS } from "./constants";
import type { ReportsRow } from "@/types/database";

export type ReportRowView = ReportsRow & {
  interns: { full_name: string; student_code: string | null } | null;
  profiles: { full_name: string } | null;
};

const ACTIVE_STATUSES = ["draft", "submitted", "in_review", "needs_revision"];

function periodOf(row: ReportsRow): string {
  const from = formatDate(row.period_start);
  if (row.period_end === row.period_start) return from;
  return `${from} – ${formatDate(row.period_end)}`;
}

export function ReportsTable({
  rows,
  mode,
  detailBase,
}: {
  rows: ReportRowView[];
  mode: "mine" | "review";
  detailBase: string;
}) {
  const [status, setStatus] = React.useState("");
  const [type, setType] = React.useState("");
  const [onlyOverdue, setOnlyOverdue] = React.useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = rows.filter((r) => {
    if (status && r.status !== status) return false;
    if (type && r.report_type !== type) return false;
    if (onlyOverdue) {
      const overdue =
        ACTIVE_STATUSES.includes(r.status) && r.due_date !== null && r.due_date < today;
      if (!overdue) return false;
    }
    return true;
  });

  const columns: Column<ReportRowView>[] = [
    {
      key: "code",
      header: "Mã",
      className: "font-mono text-xs",
      cell: (r) => r.report_code,
    },
  ];
  if (mode === "review") {
    columns.push({
      key: "intern",
      header: "Thực tập sinh",
      cell: (r) => (
        <>
          {r.interns?.full_name ?? "—"}
          {r.interns?.student_code ? (
            <span className="text-xs text-muted-foreground">
              {" "}· {r.interns.student_code}
            </span>
          ) : null}
        </>
      ),
    });
  }
  columns.push(
    {
      key: "type",
      header: "Loại",
      cell: (r) => reportTypeLabel[r.report_type] ?? r.report_type,
    },
    {
      key: "period",
      header: "Kỳ báo cáo",
      cell: (r) => periodOf(r),
    },
    {
      key: "due",
      header: "Hạn nộp",
      cell: (r) => {
        const overdue =
          ACTIVE_STATUSES.includes(r.status) &&
          r.due_date !== null &&
          r.due_date < today;
        return r.due_date ? (
          <span className={overdue ? "font-medium text-destructive" : undefined}>
            {formatDate(r.due_date)}
            {overdue ? " (quá hạn)" : ""}
          </span>
        ) : (
          "—"
        );
      },
    },
    {
      key: "submitted",
      header: "Nộp lúc",
      className: "whitespace-nowrap text-xs text-muted-foreground",
      cell: (r) => formatDateTime(r.submitted_at),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (r) => <StatusBadge value={r.status} />,
    },
    {
      key: "reviewer",
      header: "Người duyệt",
      cell: (r) => r.profiles?.full_name ?? "—",
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
          Chi tiết
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
        `${r.report_code} ${r.title} ${r.interns?.full_name ?? ""}`
      }
      searchPlaceholder="Tìm mã báo cáo, tiêu đề, thực tập sinh..."
      emptyState={{
        title: "Không có báo cáo",
        description:
          rows.length === 0
            ? "Chưa có báo cáo nào — intern chưa bắt đầu nộp báo cáo."
            : "Không có báo cáo khớp bộ lọc.",
      }}
      toolbar={
        <>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Lọc trạng thái"
            className="h-9 rounded-lg border bg-background px-2 text-sm"
          >
            {REPORT_STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Lọc loại báo cáo"
            className="h-9 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="">Tất cả loại báo cáo</option>
            <option value="daily">Báo cáo ngày</option>
            <option value="weekly">Báo cáo tuần</option>
            <option value="monthly">Báo cáo tháng</option>
            <option value="final">Báo cáo tổng kết</option>
          </select>
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 text-sm">
            <input
              type="checkbox"
              checked={onlyOverdue}
              onChange={(e) => setOnlyOverdue(e.target.checked)}
            />
            Quá hạn
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {filtered.length}/{rows.length} báo cáo
          </span>
        </>
      }
    />
  );
}
