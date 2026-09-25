"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, reviewDecisionLabel } from "@/features/labels";
import { createReview, type TaskFormState } from "../task-actions";

export type ReviewRow = {
  id: string;
  subtask_id: string | null;
  submission_id: string | null;
  reviewer_id: string;
  decision: string;
  completion: string | null;
  completion_pct: number | null;
  quality_score: number | null;
  technical_score: number | null;
  documentation_score: number | null;
  soft_score: number | null;
  deadline_bucket: string | null;
  feedback: string | null;
  strengths: string | null;
  weaknesses: string | null;
  improvements: string | null;
  final_score: number | null;
  reviewed_at: string;
};

const initialState: TaskFormState = {};

export function ReviewsPanel({
  taskId,
  reviews,
  submissions,
  nameOf,
  canReview,
}: {
  taskId: string;
  reviews: ReviewRow[];
  submissions: { id: string; submission_no: number }[];
  nameOf: (id: string | null) => string;
  canReview: boolean;
}) {
  const [showForm, setShowForm] = React.useState(false);
  const router = useRouter();

  const [state, formAction, pending] = useActionState(
    async (prev: TaskFormState, formData: FormData) => {
      formData.set("task_id", taskId);
      const result = await createReview(prev, formData);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Đã lưu đánh giá.");
        setShowForm(false);
        router.refresh();
      }
      return result;
    },
    initialState,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Đánh giá ({reviews.length})</CardTitle>
        {canReview ? (
          <Button size="xs" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <ClipboardCheck className="size-4" />
            Đánh giá / Chấm điểm
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {showForm ? (
          <form action={formAction} className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="rv_submission">Duyệt bài nộp</Label>
                <select
                  id="rv_submission"
                  name="submission_id"
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">— Chọn bài nộp —</option>
                  {submissions.map((s) => (
                    <option key={s.id} value={s.id}>
                      Lần nộp #{s.submission_no}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="rv_decision">Kết luận</Label>
                <select
                  id="rv_decision"
                  name="decision"
                  required
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">— Chọn —</option>
                  <option value="approved">Duyệt (Approved)</option>
                  <option value="changes_requested">Yêu cầu sửa (Changes Requested)</option>
                  <option value="rejected">Từ chối (Rejected)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="rv_completion">Mức độ hoàn thành</Label>
                <select
                  id="rv_completion"
                  name="completion"
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="complete">Hoàn thành</option>
                  <option value="partial">Một phần</option>
                  <option value="none">Chưa hoàn thành</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="rv_pct">% hoàn thành</Label>
                <Input id="rv_pct" name="completion_pct" type="number" min="0" max="100" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="rv_deadline">Hạn bài</Label>
                <select
                  id="rv_deadline"
                  name="deadline_bucket"
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">—</option>
                  <option value="on_time">Đúng hạn</option>
                  <option value="late">Trễ hạn</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <ScoreInput label="Chất lượng" name="quality_score" />
              <ScoreInput label="Kỹ thuật" name="technical_score" />
              <ScoreInput label="Tài liệu" name="documentation_score" />
              <ScoreInput label="Mềm dẻo" name="soft_score" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rv_feedback">Nhận xét tổng thể</Label>
              <Textarea id="rv_feedback" name="feedback" rows={3} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="rv_strengths">Điểm mạnh</Label>
                <Textarea id="rv_strengths" name="strengths" rows={2} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="rv_weaknesses">Điểm yếu</Label>
                <Textarea id="rv_weaknesses" name="weaknesses" rows={2} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="rv_improvements">Hướng cải thiện</Label>
                <Textarea id="rv_improvements" name="improvements" rows={2} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Điểm cuối tự động tính theo cấu hình (Task Score) — không cần nhập.
            </p>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Hủy
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Đang lưu..." : "Lưu đánh giá"}
              </Button>
            </div>
          </form>
        ) : null}

        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có đánh giá nào. {canReview ? "Hãy chấm điểm sau khi intern nộp bài." : ""}
          </p>
        ) : (
          reviews.map((r) => {
            const score = r.final_score;
            return (
              <div key={r.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        r.decision === "approved"
                          ? "default"
                          : r.decision === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {reviewDecisionLabel[r.decision] ?? r.decision}
                    </Badge>
                    {r.deadline_bucket === "late" ? (
                      <Badge variant="destructive">Trễ hạn</Badge>
                    ) : r.deadline_bucket === "on_time" ? (
                      <Badge variant="outline">Đúng hạn</Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    {score != null ? (
                      <div className="flex w-40 items-center gap-2">
                        <Progress value={score * 10} className="h-2" />
                        <span className="text-sm font-semibold">{score}/10</span>
                      </div>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {nameOf(r.reviewer_id)} · {formatDateTime(r.reviewed_at)}
                    </span>
                  </div>
                </div>
                {r.completion_pct != null ? (
                  <p className="text-xs text-muted-foreground">
                    Hoàn thành: {r.completion_pct}%
                    {r.quality_score != null ? ` · Chất lượng ${r.quality_score}/5` : ""}
                    {r.technical_score != null ? ` · Kỹ thuật ${r.technical_score}/5` : ""}
                    {r.documentation_score != null ? ` · Tài liệu ${r.documentation_score}/5` : ""}
                    {r.soft_score != null ? ` · Mềm dẻo ${r.soft_score}/5` : ""}
                  </p>
                ) : null}
                {r.feedback ? <p className="text-sm">{r.feedback}</p> : null}
                {r.strengths ? (
                  <p className="text-sm text-muted-foreground">Điểm mạnh: {r.strengths}</p>
                ) : null}
                {r.weaknesses ? (
                  <p className="text-sm text-muted-foreground">Điểm yếu: {r.weaknesses}</p>
                ) : null}
                {r.improvements ? (
                  <p className="text-sm text-muted-foreground">Cải thiện: {r.improvements}</p>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function ScoreInput({ label, name }: { label: string; name: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name}>{label} (1–5)</Label>
      <Input id={name} name={name} type="number" min="1" max="5" step="0.5" />
    </div>
  );
}