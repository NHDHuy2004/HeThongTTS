"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/features/labels";
import type { DailyReportsRow, WeeklyReportsRow } from "@/types/database";
import { ReviewReportDialog } from "./review-dialog";

type DailyView = DailyReportsRow & { interns: { full_name: string } | null };
type WeeklyView = WeeklyReportsRow & { interns: { full_name: string } | null };

const TABS = [
  { id: "daily", label: "Báo cáo ngày" },
  { id: "weekly", label: "Báo cáo tuần" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ReportsView({
  daily,
  weekly,
  canReview,
}: {
  daily: DailyView[];
  weekly: WeeklyView[];
  canReview: boolean;
}) {
  const [tab, setTab] = React.useState<TabId>("daily");

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

      {tab === "daily" ? (
        <div className="flex flex-col gap-2">
          {daily.length === 0 ? (
            <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
              Chưa có báo cáo ngày.
            </p>
          ) : (
            daily.map((r) => (
              <div key={r.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {r.interns?.full_name ?? "—"} · {formatDate(r.report_date)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {r.tasks_done ?? r.results ?? "Không có nội dung"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge value={r.status} />
                    {r.score !== null ? (
                      <span className="text-sm font-semibold">{r.score}đ</span>
                    ) : null}
                    {canReview ? (
                      <ReviewReportDialog
                        kind="daily"
                        id={r.id}
                        defaultFeedback={r.feedback}
                        defaultScore={r.score}
                      />
                    ) : null}
                  </div>
                </div>
                {r.feedback ? (
                  <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Phản hồi: {r.feedback}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "weekly" ? (
        <div className="flex flex-col gap-2">
          {weekly.length === 0 ? (
            <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
              Chưa có báo cáo tuần.
            </p>
          ) : (
            weekly.map((r) => (
              <div key={r.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {r.interns?.full_name ?? "—"} · Tuần{" "}
                      {formatDate(r.week_start)} → {formatDate(r.week_end)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {r.work_summary ?? r.results ?? "Không có nội dung"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge value={r.status} />
                    {r.score !== null ? (
                      <span className="text-sm font-semibold">{r.score}đ</span>
                    ) : null}
                    {canReview ? (
                      <ReviewReportDialog
                        kind="weekly"
                        id={r.id}
                        defaultFeedback={r.feedback}
                        defaultScore={r.score}
                      />
                    ) : null}
                  </div>
                </div>
                {r.feedback ? (
                  <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Phản hồi: {r.feedback}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}