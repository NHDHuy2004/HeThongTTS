"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import {
  formatDate,
  formatDateTime,
  reportTypeLabel,
} from "@/features/labels";
import type {
  AttendanceRow,
  DailyReportsRow,
  InternsRow,
  TasksRow,
} from "@/types/database";

type InternDetailData = InternsRow & {
  internships: {
    id: string;
    internship_batches: { name: string; status: string } | null;
    departments: { name: string } | null;
    mentors: { full_name: string } | null;
  }[];
};

const TABS = ["overview", "tasks", "attendance", "reports"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "Hồ sơ",
  tasks: "Công việc",
  attendance: "Điểm danh",
  reports: "Báo cáo",
};

function DescriptionRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? "—"}</dd>
    </div>
  );
}

export function InternDetail({
  intern,
  tasks,
  attendance,
  reports,
  canManage,
}: {
  intern: InternDetailData;
  tasks: TasksRow[];
  attendance: AttendanceRow[];
  reports: DailyReportsRow[];
  canManage: boolean;
}) {
  const [tab, setTab] = React.useState<Tab>("overview");
  void canManage;

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Hồ sơ thực tập sinh" className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => {
          const selected = tab === t;
          return (
            <button
              key={t}
              id={`intern-detail-tab-${t}`}
              role="tab"
              aria-selected={selected}
              aria-controls={`intern-detail-panel-${t}`}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px min-h-10 shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                selected
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {TAB_LABELS[t]}
            </button>
          );
        })}
      </div>

      {tab === "overview" ? (
        <dl id="intern-detail-panel-overview" role="tabpanel" aria-labelledby="intern-detail-tab-overview" className="grid grid-cols-1 gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3">
          <DescriptionRow label="Mã sinh viên" value={intern.student_code} />
          <DescriptionRow label="Trường" value={intern.school} />
          <DescriptionRow label="Ngành" value={intern.major} />
          <DescriptionRow label="Lớp" value={intern.class_name} />
          <DescriptionRow label="SĐT" value={intern.phone} />
          <DescriptionRow label="Ngày sinh" value={formatDate(intern.birth_date)} />
          <DescriptionRow label="Địa chỉ" value={intern.address} />
          <DescriptionRow label="Đợt" value={intern.internships?.[0]?.internship_batches?.name} />
          <DescriptionRow label="Phòng ban" value={intern.internships?.[0]?.departments?.name} />
          <DescriptionRow label="Mentor" value={intern.internships?.[0]?.mentors?.full_name} />
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Trạng thái</dt>
            <dd>
              <StatusBadge value={intern.status} />
            </dd>
          </div>
        </dl>
      ) : null}

      {tab === "tasks" ? (
        <div id="intern-detail-panel-tasks" role="tabpanel" aria-labelledby="intern-detail-tab-tasks" className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-xl text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="h-10 px-3 font-medium">Tiêu đề</th>
                <th className="h-10 px-3 font-medium">Ưu tiên</th>
                <th className="h-10 px-3 font-medium">Hạn</th>
                <th className="h-10 px-3 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="h-24 px-3 text-center text-muted-foreground">
                    Chưa có task nào.
                  </td>
                </tr>
              ) : (
                tasks.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{t.title}</td>
                    <td className="px-3 py-2">
                      <StatusBadge value={t.priority} />
                    </td>
                    <td className="px-3 py-2">{formatDateTime(t.deadline)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge value={t.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "attendance" ? (
        <div id="intern-detail-panel-attendance" role="tabpanel" aria-labelledby="intern-detail-tab-attendance" className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-xl text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="h-10 px-3 font-medium">Ngày</th>
                <th className="h-10 px-3 font-medium">Check-in</th>
                <th className="h-10 px-3 font-medium">Check-out</th>
                <th className="h-10 px-3 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {attendance.length === 0 ? (
                <tr>
                  <td colSpan={4} className="h-24 px-3 text-center text-muted-foreground">
                    Chưa có dữ liệu điểm danh.
                  </td>
                </tr>
              ) : (
                attendance.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{formatDate(a.work_date)}</td>
                    <td className="px-3 py-2">{formatDateTime(a.check_in_at)}</td>
                    <td className="px-3 py-2">{formatDateTime(a.check_out_at)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge value={a.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "reports" ? (
        <div id="intern-detail-panel-reports" role="tabpanel" aria-labelledby="intern-detail-tab-reports" className="flex flex-col gap-2">
          {reports.length === 0 ? (
            <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
              Chưa có báo cáo nào.
            </p>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {reportTypeLabel.daily} · {formatDate(r.report_date)}
                  </p>
                  <StatusBadge value={r.status} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {r.tasks_done ?? "Không có nội dung"}
                </p>
                {r.feedback ? (
                  <dl className="mt-3 border-t border-border/60 pt-2">
                    <dt className="text-xs font-medium text-muted-foreground">Nhận xét</dt>
                    <dd className="mt-0.5 text-sm">{r.feedback}</dd>
                  </dl>
                ) : (
                  <p className="mt-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">Chưa có nhận xét</p>
                )}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}