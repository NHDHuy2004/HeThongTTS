"use client";

import * as React from "react";

import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatDateTime } from "@/features/labels";
import type { AttendanceRow } from "@/types/database";

export type AttendanceRowView = AttendanceRow & {
  interns: { full_name: string } | null;
};

type FilterSelectProps = {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
};

function FilterSelect({
  label,
  id,
  value,
  onChange,
  options,
  allLabel,
}: FilterSelectProps) {
  if (options.length < 2) return null;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-lg border bg-background px-2 text-sm"
      >
        <option value="">{allLabel}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function monthLabel(month: string) {
  const [year, m] = month.split("-");
  return `Tháng ${Number(m)}/${year}`;
}

export function AttendanceTable({
  data,
  showInternFilter = false,
  showMonthFilter = false,
}: {
  data: AttendanceRowView[];
  /** Bộ lọc theo thực tập sinh (dùng cho mentor xem nhiều intern). */
  showInternFilter?: boolean;
  /** Bộ lọc theo tháng. */
  showMonthFilter?: boolean;
}) {
  const [internName, setInternName] = React.useState("");
  const [month, setMonth] = React.useState("");

  const filtered = React.useMemo(() => {
    return data.filter((row) => {
      if (internName && row.interns?.full_name !== internName) return false;
      if (month && !String(row.work_date).startsWith(month)) return false;
      return true;
    });
  }, [data, internName, month]);

  const internOptions = React.useMemo(() => {
    const names = new Set<string>();
    for (const row of data) {
      if (row.interns?.full_name) names.add(row.interns.full_name);
    }
    return [...names]
      .sort((a, b) => a.localeCompare(b, "vi"))
      .map((name) => ({ value: name, label: name }));
  }, [data]);

  const monthOptions = React.useMemo(() => {
    const months = new Set<string>();
    for (const row of data) months.add(String(row.work_date).slice(0, 7));
    return [...months]
      .sort()
      .reverse()
      .map((m) => ({ value: m, label: monthLabel(m) }));
  }, [data]);

  const columns: Column<AttendanceRowView>[] = [
    { key: "work_date", header: "Ngày", cell: (r) => formatDate(r.work_date) },
    {
      key: "intern_id",
      header: "Intern",
      cell: (r) => r.interns?.full_name ?? "—",
    },
    { key: "check_in_at", header: "Check-in", cell: (r) => formatDateTime(r.check_in_at) },
    { key: "check_out_at", header: "Check-out", cell: (r) => formatDateTime(r.check_out_at) },
    {
      key: "status",
      header: "Trạng thái",
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge value={r.status} />
          {r.check_in_at && !r.check_out_at ? (
            <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-400">
              Thiếu check-out
            </span>
          ) : null}
        </div>
      ),
    },
    { key: "note", header: "Ghi chú", cell: (r) => r.note ?? "—" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {showInternFilter || showMonthFilter ? (
        <div className="flex flex-wrap items-end gap-3">
          {showInternFilter ? (
            <FilterSelect
              label="Thực tập sinh"
              id="att-intern-filter"
              value={internName}
              onChange={setInternName}
              options={internOptions}
              allLabel="Tất cả thực tập sinh"
            />
          ) : null}
          {showMonthFilter ? (
            <FilterSelect
              label="Tháng"
              id="att-month-filter"
              value={month}
              onChange={setMonth}
              options={monthOptions}
              allLabel="Tất cả tháng"
            />
          ) : null}
        </div>
      ) : null}
      <DataTable
        data={filtered}
        columns={columns}
        searchKeys={["interns.full_name", "note"]}
        searchPlaceholder="Tìm theo tên intern, ghi chú..."
      />
    </div>
  );
}
