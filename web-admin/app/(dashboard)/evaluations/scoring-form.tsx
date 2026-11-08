"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
  description?: string | null;
  weight: number;
  sort_order: number;
};

export type ScoreRow = { criterion_id: string; score: number; comment: string | null };

function levelOf(score: number): string {
  if (score >= 9) return "Rất tốt";
  if (score >= 8) return "Tốt";
  if (score >= 7) return "Khá";
  if (score >= 5) return "Trung bình";
  return "Chưa đạt";
}

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

  const locked = status === "finalized";
  const canEdit = canManage && !locked;

  const save = () => {
    const scores: { criterion_id: string; score: number; comment: string | null }[] = [];
    for (const c of criteria) {
      const raw = values[c.id]?.score ?? "";
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 10) {
        toast.error(`Điểm tiêu chí "${c.name}" phải từ 0 đến 10.`);
        return;
      }
      scores.push({ criterion_id: c.id, score: n, comment: values[c.id]?.comment?.trim() ? values[c.id].comment : null });
    }
    startTransition(async () => {
      const r1 = await saveEvaluationScores(evaluationId, scores);
      if (r1?.error) {
        toast.error(r1.error);
        return;
      }
      const r2 = await updateEvaluationSummary(
        evaluationId,
        summaryText.trim() ? summaryText : null,
        strengths.trim() ? strengths : null,
        needsImprovement.trim() ? needsImprovement : null,
        recommendation.trim() ? recommendation : null,
      );
      if (r2?.error) {
        toast.error(r2.error);
        return;
      }
      toast.success("Đã lưu đánh giá.");
      router.refresh();
    });
  };

  const setStatus = (next: "draft" | "submitted" | "reviewed" | "finalized") => {
    startTransition(async () => {
      const r = await setEvaluationStatus(evaluationId, next);
      if (r?.error) toast.error(r.error);
      else {
        toast.success(
          next === "submitted" ? "Đã gửi đánh giá." : next === "reviewed" ? "Đã đánh dấu đã review." : next === "draft" ? "Đã chuyển về nháp." : "Đã chốt điểm (finalize).",
        );
        router.refresh();
      }
    });
  };

  const totalWeight = criteria.reduce((a, c) => a + Number(c.weight), 0);
  const scoredCount = criteria.filter((c) => (values[c.id]?.score ?? "") !== "").length;
  const preview = criteria.reduce((acc, c) => {
    const v = values[c.id];
    if (!v || v.score === "") return acc;
    return acc + (Number(v.score) || 0) * Number(c.weight);
  }, 0);
  const previewScore = totalWeight > 0 ? preview / totalWeight : 0;

  return (
    <div className="flex flex-col gap-5">
      {locked ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          Phiếu đã chốt điểm (finalized) — nội dung chỉ đọc. Liên hệ HR/Admin nếu cần mở lại phiếu theo quy trình hiện hành.
        </p>
      ) : null}

      <section className="flex flex-col gap-3" aria-label="Tiêu chí đánh giá">
        <div>
          <h3 className="text-sm font-semibold">Tiêu chí đánh giá</h3>
          <p className="text-xs text-muted-foreground">
            Thang điểm 0–10 cho mỗi tiêu chí. Điểm tổng kết được tính có trọng số theo tiêu chí. Đã chấm {scoredCount}/{criteria.length}.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {criteria.map((c, idx) => {
            const raw = values[c.id]?.score ?? "";
            const n = raw === "" ? null : Number(raw);
            return (
              <article key={c.id} className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">#{idx + 1}</span>
                  <span className="text-sm font-semibold">{c.name}</span>
                  <Badge variant="secondary" className="ml-auto">
                    Trọng số {Math.round(Number(c.weight) * 100)}%
                  </Badge>
                  {n !== null && Number.isFinite(n) ? (
                    <Badge variant="outline">{levelOf(n)}</Badge>
                  ) : null}
                </div>
                {c.description ? <p className="text-xs text-muted-foreground">{c.description}</p> : null}
                <div className="grid grid-cols-[110px_1fr] items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`score-${c.id}`}>Điểm /10</Label>
                    <Input
                      id={`score-${c.id}`}
                      type="number"
                      min={0}
                      max={10}
                      step="0.1"
                      inputMode="decimal"
                      placeholder="0–10"
                      value={raw}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [c.id]: { ...v[c.id], score: e.target.value } }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`comment-${c.id}`}>Nhận xét</Label>
                    <Textarea
                      id={`comment-${c.id}`}
                      rows={2}
                      placeholder="Nhận xét tiêu chí (nếu có)"
                      value={values[c.id]?.comment ?? ""}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [c.id]: { ...v[c.id], comment: e.target.value } }))
                      }
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-label="Tổng kết">
        <div>
          <h3 className="text-sm font-semibold">Tổng kết</h3>
          <p className="text-xs text-muted-foreground">Nhận xét chung và các nội dung tổng kết sẽ xuất lên phiếu Word.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="summary">Nhận xét tổng quan</Label>
          <Textarea
            id="summary"
            rows={3}
            placeholder="Nhận xét tổng quan của người đánh giá"
            value={summaryText}
            disabled={!canEdit}
            onChange={(e) => setSummaryText(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="strengths">Ưu điểm</Label>
            <Textarea id="strengths" rows={3} placeholder="Ưu điểm nổi bật" value={strengths} disabled={!canEdit} onChange={(e) => setStrengths(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="needs">Hạn chế / Cần cải thiện</Label>
            <Textarea id="needs" rows={3} placeholder="Điểm cần cải thiện" value={needsImprovement} disabled={!canEdit} onChange={(e) => setNeedsImprovement(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recommendation">Đề xuất cải thiện</Label>
            <Textarea id="recommendation" rows={3} placeholder="Đề xuất cho kỳ tiếp theo" value={recommendation} disabled={!canEdit} onChange={(e) => setRecommendation(e.target.value)} />
          </div>
        </div>
        <div className="rounded-xl bg-muted/60 p-3 text-sm">
          Điểm tổng (ước tính):{" "}
          <span className="font-semibold tabular-nums">{scoredCount ? previewScore.toFixed(2) : "—"}/10</span>{" "}
          · {scoredCount ? levelOf(previewScore) : "Chưa chấm"}
          <span className="block text-xs text-muted-foreground">
            Điểm chính thức do hệ thống tính có trọng số sau khi lưu. “Mức độ” là xếp loại tổng quan, không chấm điểm riêng.
          </span>
        </div>
      </section>

      {canManage && !locked ? (
        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
          <Button size="sm" variant="outline" disabled={pending} onClick={save}>
            {pending ? "Đang lưu..." : status === "draft" ? "Lưu nháp" : "Lưu thay đổi"}
          </Button>
          {status === "draft" ? (
            <Button size="sm" disabled={pending} onClick={() => setStatus("submitted")}>
              Gửi đánh giá
            </Button>
          ) : null}
          {status === "submitted" ? (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => setStatus("reviewed")}>
              Đánh dấu đã review
            </Button>
          ) : null}
          {status === "submitted" || status === "reviewed" ? (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => setStatus("finalized")}>
              Chốt điểm (Finalize)
            </Button>
          ) : null}
          {status === "submitted" || status === "reviewed" ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setStatus("draft")}>
              Chuyển về nháp
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
