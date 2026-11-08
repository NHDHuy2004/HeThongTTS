"use client";

import Link from "next/link";

import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime, evaluationTypeLabel } from "@/features/labels";
import { ExportDocxButton } from "./export-docx-button";

export type EvalRow = {
  id: string;
  internship_id: string;
  reviewer_id: string;
  type: string;
  period_label: string;
  due_date: string | null;
  submitted_at: string | null;
  final_score: number | string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
  status: string | null;
  overall_level: string | null;
  internships: {
    interns: { full_name: string | null; student_code: string | null } | null;
    departments: { name: string | null } | null;
    internship_batches: { name: string | null } | null;
    mentors: { full_name: string | null } | null;
  } | null;
  profiles: { full_name: string | null } | null;
};

function finalScoreText(v: number | string | null): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? `${n.toFixed(2)}/10` : "—";
}

export function EvaluationsTable({ data, canDownload }: { data: EvalRow[]; canDownload?: boolean }) {
  const columns: Column<EvalRow>[] = [
    {
      key: "intern",
      header: "Thực tập sinh",
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{r.internships?.interns?.full_name ?? "—"}</div>
          <div className="text-xs text-muted-foreground">
            {r.internships?.interns?.student_code ?? "—"}
            {r.internships?.departments?.name ? ` · ${r.internships.departments.name}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Loại / Kỳ",
      cell: (r) => (
        <div className="min-w-0">
          <div>{evaluationTypeLabel[r.type] ?? r.type}</div>
          <Link href={`/evaluations/${r.id}`} className="text-xs text-primary underline-offset-4 hover:underline">
            {r.period_label}
          </Link>
        </div>
      ),
    },
    {
      key: "batch",
      header: "Đợt",
      cell: (r) => <span className="text-xs">{r.internships?.internship_batches?.name ?? "—"}</span>,
    },
    {
      key: "final_score",
      header: "Điểm tổng",
      cell: (r) => (
        <span className="font-medium tabular-nums">{finalScoreText(r.final_score)}</span>
      ),
    },
    {
      key: "overall_level",
      header: "Mức độ",
      cell: (r) => (r.overall_level ? <Badge variant="secondary">{r.overall_level}</Badge> : "—"),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (r) => <StatusBadge value={r.status ?? "draft"} />,
    },
    {
      key: "reviewer",
      header: "Người đánh giá",
      cell: (r) => <span className="text-xs">{r.profiles?.full_name ?? "—"}</span>,
    },
    {
      key: "updated_at",
      header: "Cập nhật",
      cell: (r) => <span className="text-xs text-muted-foreground">{formatDateTime(r.updated_at)}</span>,
    },
    {
      key: "due_date",
      header: "Hạn",
      cell: (r) => <span className="text-xs">{formatDate(r.due_date)}</span>,
    },
    {
      key: "actions",
      header: "Thao tác",
      cell: (r) => (
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={`/evaluations/${r.id}`}
            className="inline-flex h-7 items-center rounded-md px-2 text-xs font-medium text-primary hover:bg-muted"
          >
            Chi tiết
          </Link>
          {canDownload === false ? null : <ExportDocxButton evaluationId={r.id} size="xs" variant="outline" />}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={data}
      columns={columns}
      searchKeys={["period_label", "internships.interns.full_name", "internships.interns.student_code", "type"]}
      searchPlaceholder="Tìm theo họ tên, MSSV, kỳ đánh giá..."
      emptyState={{
        title: "Chưa có phiếu đánh giá nào",
        description: "Hãy tạo đánh giá mới cho thực tập sinh trong đợt hiện tại.",
      }}
    />
  );
}
