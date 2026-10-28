"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  saveEvaluationScores,
  setEvaluationStatus,
  updateEvaluationSummary,
} from "./evaluation-actions";

export type CriterionRow = {
  id: string;
  name: string;
  category: string;
  weight: number;
  sort_order: number;
};

export type ScoreRow = { criterion_id: string; score: number; comment: string | null };

export function EvaluationScoringForm({
  evaluationId,
  criteria,
  existingScores,
  summary,
  status,
  canManage,
  initialStrengths,
  initialNeedsImprovement,
  initialRecommendation,
}: {
  evaluationId: string;
  criteria: CriterionRow[];
  existingScores: ScoreRow[];
  summary: string | null;
  status: string;
  canManage: boolean;
  initialStrengths?: string | null;
  initialNeedsImprovement?: string | null;
  initialRecommendation?: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<Record<string, { score: string; comment: string }>>(
    () => {
      const init: Record<string, { score: string; comment: string }> = {};
      for (const c of criteria) {
        const existing = existingScores.find((s) => s.criterion_id === c.id);
        init[c.id] = {
          score: existing ? String(existing.score) : "",
          comment: existing?.comment ?? "",
        };
      }
      return init;
    },
  );
  const [summaryText, setSummaryText] = React.useState(summary ?? "");
  const [strengths, setStrengths] = React.useState(initialStrengths ?? "");
  const [needsImprovement, setNeedsImprovement] = React.useState(initialNeedsImprovement ?? "");
  const [recommendation, setRecommendation] = React.useState(initialRecommendation ?? "");
  const [pending, startTransition] = React.useTransition();

  const levelOf = (score: number) =>
    score >= 9 ? "Rất tốt" : score >= 8 ? "Tốt" : score >= 7 ? "Khá" : score >= 5 ? "Trung bình" : "Chưa đạt";

  const save = () => {
    const scores = criteria
      .map((c) => ({
        criterion_id: c.id,
        score: Number(values[c.id]?.score),
        comment: values[c.id]?.comment || null,
      }))
      .filter((s) => values[s.criterion_id]?.score !== "" && Number.isFinite(s.score));
    startTransition(async () => {
      const r1 = await saveEvaluationScores(evaluationId, scores);
      if (r1?.error) {
        toast.error(r1.error);
        return;
      }
      const r2 = await updateEvaluationSummary(evaluationId, summaryText || null, strengths || null, needsImprovement || null, recommendation || null);
      if (r2?.error) {
        toast.error(r2.error);
        return;
      }
      toast.success("Đã lưu đánh giá.");
      router.refresh();
    });
  };

  const setStatus = (status: "submitted" | "reviewed" | "finalized") => {
    startTransition(async () => {
      const r = await setEvaluationStatus(evaluationId, status);
      if (r?.error) toast.error(r.error);
      else {
        toast.success(status === "submitted" ? "Đã gửi đánh giá." : status === "reviewed" ? "Đã review." : "Đã finalize.");
        router.refresh();
      }
    });
  };

  const totalWeight = criteria.reduce((a, c) => a + Number(c.weight), 0);
  const preview = criteria.reduce((acc, c) => {
    const v = values[c.id];
    if (!v || v.score === "") return acc;
    return acc + (Number(v.score) || 0) * Number(c.weight);
  }, 0);
  const previewScore = totalWeight > 0 ? preview / totalWeight : 0;

  return (
    <div className="flex flex-col gap-4">
      {criteria.map((c) => (
        <div key={c.id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {c.name} <span className="text-xs text-muted-foreground">(trọng số {(Number(c.weight) * 100).toFixed(0)}%)</span>
            </span>
            {values[c.id]?.score !== "" ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {levelOf(Number(values[c.id].score))}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <Input
              type="number"
              min={0}
              max={10}
              step="0.1"
              placeholder="0–10"
              className="w-24"
              value={values[c.id]?.score ?? ""}
              disabled={!canManage}
              onChange={(e) =>
                setValues((v) => ({ ...v, [c.id]: { ...v[c.id], score: e.target.value } }))
              }
            />
            <Textarea
              rows={1}
              placeholder="Nhận xét tiêu chí"
              value={values[c.id]?.comment ?? ""}
              disabled={!canManage}
              onChange={(e) =>
                setValues((v) => ({ ...v, [c.id]: { ...v[c.id], comment: e.target.value } }))
              }
            />
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-1">
        <Label>Nhận xét chung</Label>
        <Textarea
          rows={3}
          value={summaryText}
          disabled={!canManage}
          onChange={(e) => setSummaryText(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label>Điểm mạnh</Label>
          <Textarea rows={2} value={strengths} disabled={!canManage} onChange={(e) => setStrengths(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Cần cải thiện</Label>
          <Textarea rows={2} value={needsImprovement} disabled={!canManage} onChange={(e) => setNeedsImprovement(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Đề xuất</Label>
          <Textarea rows={2} value={recommendation} disabled={!canManage} onChange={(e) => setRecommendation(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        Điểm tổng (ước tính, Mentor có quyền xác nhận cuối):{" "}
        <span className="font-semibold">{previewScore.toFixed(2)}/10</span> ·{" "}
        {levelOf(previewScore)}
      </div>

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={pending} onClick={save}>
            Lưu nháp
          </Button>
          <Button size="sm" disabled={pending} onClick={() => setStatus("submitted")}>
            Gửi đánh giá
          </Button>
          {status === "submitted" || status === "reviewed" ? (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => setStatus("finalized")}>
              HR/Finalize
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
