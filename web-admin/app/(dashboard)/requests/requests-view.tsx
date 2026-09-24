"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, requestTypeLabel } from "@/features/labels";
import type {
  LateRequestsRow,
  LeaveRequestsRow,
  WorkFromHomeRequestsRow,
} from "@/types/database";
import { ReviewButtons } from "./review-buttons";

type LeaveView = LeaveRequestsRow & { interns: { full_name: string } | null };
type WfhView = WorkFromHomeRequestsRow & { interns: { full_name: string } | null };
type LateView = LateRequestsRow & { interns: { full_name: string } | null };

const TABS = [
  { id: "leave", label: "Nghỉ phép" },
  { id: "wfh", label: "Làm từ xa" },
  { id: "late", label: "Đi muộn / Về sớm" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Cell({ label }: { label: string }) {
  return <div>{label || "—"}</div>;
}

export function RequestsView({
  leave,
  wfh,
  late,
  canReview,
}: {
  leave: LeaveView[];
  wfh: WfhView[];
  late: LateView[];
  canReview: boolean;
}) {
  const [tab, setTab] = React.useState<TabId>("leave");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "leave" ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="h-9 px-3 font-medium">Intern</th>
              <th className="h-9 px-3 font-medium">Loại</th>
              <th className="h-9 px-3 font-medium">Từ</th>
              <th className="h-9 px-3 font-medium">Đến</th>
              <th className="h-9 px-3 font-medium">Lý do</th>
              <th className="h-9 px-3 font-medium">Trạng thái</th>
              {canReview ? <th className="h-9 px-3 font-medium">Duyệt</th> : null}
            </tr>
          </thead>
          <tbody>
            {leave.length === 0 ? (
              <tr>
                <td colSpan={7} className="h-24 px-3 text-center text-muted-foreground">
                  Chưa có đơn nghỉ phép.
                </td>
              </tr>
            ) : (
              leave.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{r.interns?.full_name ?? "—"}</td>
                  <td className="px-3 py-2">{requestTypeLabel[r.request_type] ?? r.request_type}</td>
                  <td className="px-3 py-2">{formatDate(r.start_date)}</td>
                  <td className="px-3 py-2">{formatDate(r.end_date)}</td>
                  <td className="px-3 py-2">
                    <Cell label={r.reason} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge value={r.status} />
                  </td>
                  {canReview ? (
                    <td className="px-3 py-2">
                      <ReviewButtons kind="leave" id={r.id} status={r.status ?? "pending"} />
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : null}

      {tab === "wfh" ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="h-9 px-3 font-medium">Intern</th>
              <th className="h-9 px-3 font-medium">Ngày</th>
              <th className="h-9 px-3 font-medium">Lý do</th>
              <th className="h-9 px-3 font-medium">Trạng thái</th>
              {canReview ? <th className="h-9 px-3 font-medium">Duyệt</th> : null}
            </tr>
          </thead>
          <tbody>
            {wfh.length === 0 ? (
              <tr>
                <td colSpan={5} className="h-24 px-3 text-center text-muted-foreground">
                  Chưa có đơn làm từ xa.
                </td>
              </tr>
            ) : (
              wfh.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{r.interns?.full_name ?? "—"}</td>
                  <td className="px-3 py-2">{formatDate(r.work_date)}</td>
                  <td className="px-3 py-2">
                    <Cell label={r.reason} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge value={r.status} />
                  </td>
                  {canReview ? (
                    <td className="px-3 py-2">
                      <ReviewButtons kind="wfh" id={r.id} status={r.status ?? "pending"} />
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : null}

      {tab === "late" ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="h-9 px-3 font-medium">Intern</th>
              <th className="h-9 px-3 font-medium">Loại</th>
              <th className="h-9 px-3 font-medium">Ngày</th>
              <th className="h-9 px-3 font-medium">Số phút</th>
              <th className="h-9 px-3 font-medium">Lý do</th>
              <th className="h-9 px-3 font-medium">Trạng thái</th>
              {canReview ? <th className="h-9 px-3 font-medium">Duyệt</th> : null}
            </tr>
          </thead>
          <tbody>
            {late.length === 0 ? (
              <tr>
                <td colSpan={7} className="h-24 px-3 text-center text-muted-foreground">
                  Chưa có đơn xin đi muộn / về sớm.
                </td>
              </tr>
            ) : (
              late.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{r.interns?.full_name ?? "—"}</td>
                  <td className="px-3 py-2">{requestTypeLabel[r.request_type] ?? r.request_type}</td>
                  <td className="px-3 py-2">{formatDate(r.request_date)}</td>
                  <td className="px-3 py-2">{r.minutes_late ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Cell label={r.reason} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge value={r.status} />
                  </td>
                  {canReview ? (
                    <td className="px-3 py-2">
                      <ReviewButtons kind="late" id={r.id} status={r.status ?? "pending"} />
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}