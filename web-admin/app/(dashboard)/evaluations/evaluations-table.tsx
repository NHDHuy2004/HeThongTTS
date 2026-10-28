"use client";

import { DataTable, type Column } from "@/components/data-table";
import { formatDate, evaluationTypeLabel } from "@/features/labels";
import type { EvaluationsRow } from "@/types/database";
import { SubmitEvaluation } from "./submit-evaluation";

export type EvalRow = EvaluationsRow & {
  internships: {
    interns: { full_name: string } | null;
  } | null;
};

export function EvaluationsTable({ data }: { data: EvalRow[] }) {
  const columns: Column<EvalRow>[] = [
    {
      key: "internship_id",
      header: "Intern",
      cell: (r) => <span className="font-medium">{r.internships?.interns?.full_name ?? "—"}</span>,
    },
    {
      key: "type",
      header: "Loại",
      cell: (r) => evaluationTypeLabel[r.type] ?? r.type,
    },
    { key: "period_label", header: "Kỳ", cell: (r) => <a href={`/evaluations/${r.id}`} className="text-primary underline-offset-4 hover:underline">{r.period_label}</a> },
    { key: "due_date", header: "Hạn", cell: (r) => formatDate(r.due_date) },
    {
      key: "final_score",
      header: "Điểm",
      cell: (r) => (r.final_score !== null ? `${r.final_score}đ` : "—"),
    },
    {
      key: "submitted_at",
      header: "Trạng thái",
      cell: (r) => r.status === "finalized" ? "Hoàn tất" : r.status === "submitted" ? "Đã nộp" : r.status === "reviewed" ? "Đã review" : "Nháp",
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <SubmitEvaluation id={r.id} submitted={Boolean(r.submitted_at)} />
      ),
    },
  ];

  return (
    <DataTable
      data={data}
      columns={columns}
      searchKeys={["period_label", "internships.interns.full_name"]}
      searchPlaceholder="Tìm theo tên intern, kỳ đánh giá..."
    />
  );
}
