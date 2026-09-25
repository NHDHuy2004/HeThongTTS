"use client";

import * as React from "react";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import {
  formatDate,
  formatDateTime,
  getStatusLabel,
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
  const [search, setSearch] = React.useState("");

  const filtered = rows.filter((r) => {
    if (status && r.status !== status) return false;
    if (type && r.request_type !== type) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${r.request_code} ${r.title} ${r.reason} ${r.interns?.full_name ?? ""}`.toLowerCase();
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
          placeholder="Tìm mã đơn, tiêu đề, thực tập sinh..."
          className="h-9 w-full max-w-xs rounded-lg border bg-background px-3 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-lg border bg-background px-2 text-sm"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
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
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length}/{rows.length} đơn
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="h-9 px-3 font-medium">Mã đơn</th>
              {mode === "review" ? (
                <th className="h-9 px-3 font-medium">Thực tập sinh</th>
              ) : null}
              <th className="h-9 px-3 font-medium">Loại</th>
              <th className="h-9 px-3 font-medium">Tiêu đề</th>
              <th className="h-9 px-3 font-medium">Thời gian</th>
              <th className="h-9 px-3 font-medium">Trạng thái</th>
              <th className="h-9 px-3 font-medium">Nộp lúc</th>
              <th className="h-9 px-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={mode === "review" ? 8 : 7}
                  className="h-24 px-3 text-center text-muted-foreground"
                >
                  {rows.length === 0 ? "Chưa có đơn nào." : "Không có đơn khớp bộ lọc."}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">{r.request_code}</td>
                  {mode === "review" ? (
                    <td className="px-3 py-2">
                      <div>{r.interns?.full_name ?? "—"}</div>
                      {r.interns?.student_code ? (
                        <div className="text-xs text-muted-foreground">
                          {r.interns.student_code}
                        </div>
                      ) : null}
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    {requestTypeLabel[r.request_type] ?? r.request_type}
                  </td>
                  <td className="max-w-[16rem] truncate px-3 py-2">{r.title}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{periodOf(r)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge value={r.status} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(r.submitted_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`${detailBase}/${r.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Xem
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Bộ lọc trạng thái: {status ? getStatusLabel(status) : "Tất cả"} · Loại đơn:{" "}
        {type ? requestTypeLabel[type] ?? type : "Tất cả"}
      </p>
    </div>
  );
}
