"use client";

import * as React from "react";
import Link from "next/link";

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
  const [search, setSearch] = React.useState("");
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
    if (search) {
      const q = search.toLowerCase();
      const hay = `${r.report_code} ${r.title} ${r.interns?.full_name ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm mã báo cáo, tiêu đề, thực tập sinh..."
          className="h-9 w-full max-w-xs rounded-lg border bg-background px-3 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-lg border bg-background px-2 text-sm"
        >
          {REPORT_STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
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
        <span className="text-xs text-muted-foreground">
          {filtered.length}/{rows.length} báo cáo
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
          Không có báo cáo nào khớp bộ lọc.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Mã</th>
                {mode === "review" ? (
                  <th className="px-3 py-2 font-medium">Thực tập sinh</th>
                ) : null}
                <th className="px-3 py-2 font-medium">Loại</th>
                <th className="px-3 py-2 font-medium">Kỳ báo cáo</th>
                <th className="px-3 py-2 font-medium">Hạn nộp</th>
                <th className="px-3 py-2 font-medium">Nộp lúc</th>
                <th className="px-3 py-2 font-medium">Trạng thái</th>
                <th className="px-3 py-2 font-medium">Người duyệt</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => {
                const overdue =
                  ACTIVE_STATUSES.includes(r.status) &&
                  r.due_date !== null &&
                  r.due_date < today;
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{r.report_code}</td>
                    {mode === "review" ? (
                      <td className="px-3 py-2">
                        {r.interns?.full_name ?? "—"}
                        {r.interns?.student_code ? (
                          <span className="text-xs text-muted-foreground">
                            {" "}· {r.interns.student_code}
                          </span>
                        ) : null}
                      </td>
                    ) : null}
                    <td className="px-3 py-2">{reportTypeLabel[r.report_type] ?? r.report_type}</td>
                    <td className="px-3 py-2">{periodOf(r)}</td>
                    <td className="px-3 py-2">
                      {r.due_date ? (
                        <span className={overdue ? "font-medium text-destructive" : undefined}>
                          {formatDate(r.due_date)}
                          {overdue ? " (quá hạn)" : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">{formatDateTime(r.submitted_at)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge value={r.status} />
                    </td>
                    <td className="px-3 py-2">{r.profiles?.full_name ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`${detailBase}/${r.id}`}
                        className="text-primary hover:underline"
                      >
                        Chi tiết
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
