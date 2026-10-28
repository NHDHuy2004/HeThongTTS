"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { createEvaluation } from "../evaluation-actions";

export type InternshipOption = {
  id: string;
  internName: string;
  studentCode: string;
  email: string;
  major: string | null;
  school: string | null;
  department: string;
  mentor: string;
  batch: string;
  startDate: string | null;
  endDate: string | null;
};

export function NewEvaluationWizard({ options }: { options: InternshipOption[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = React.useState("");
  const [batchFilter, setBatchFilter] = React.useState<string>("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [type, setType] = React.useState("weekly");
  const [periodLabel, setPeriodLabel] = React.useState("");
  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState("");
  const [context, setContext] = React.useState<{ attendance?: Record<string, unknown>; tasks?: unknown } | null>(null);
  const [pending, startTransition] = React.useTransition();

  const selected = options.find((o) => o.id === selectedId) ?? null;

  const filtered = options
    .filter((o) => !batchFilter || o.batch === batchFilter)
    .filter((o) =>
      [o.internName, o.studentCode, o.email, o.department, o.batch]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .slice(0, 10);

  const batches = Array.from(new Set(options.map((o) => o.batch))).filter(Boolean);

  React.useEffect(() => {
    if (!selectedId) {
      return;
    }
    let cancelled = false;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.rpc as any)("get_evaluation_context", {
        p_internship_id: selectedId,
      });
      if (!cancelled) setContext(data ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, supabase]);

  const att = context?.attendance ?? {};
  const tasksRaw = context?.tasks;
  const tasks = Array.isArray(tasksRaw) ? tasksRaw[0] : tasksRaw;

  const submit = () => {
    if (!selectedId) return toast.error("Vui lòng chọn sinh viên.");
    if (!periodLabel.trim()) return toast.error("Vui lòng nhập kỳ đánh giá.");
    const fd = new FormData();
    fd.set("internship_id", selectedId);
    fd.set("type", type);
    fd.set("period_label", periodLabel);
    if (periodStart) fd.set("period_start", periodStart);
    if (periodEnd) fd.set("period_end", periodEnd);
    startTransition(async () => {
      const result = await createEvaluation({}, fd);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Đã tạo đánh giá.");
        router.push("/evaluations");
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Bước 1 – Chọn sinh viên & kỳ đánh giá</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label>Đợt thực tập</Label>
            <select
              value={batchFilter}
              onChange={(e) => {
                setBatchFilter(e.target.value);
                setSelectedId(null);
              }}
              className="flex h-9 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              <option value="">— Tất cả đợt —</option>
              {batches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Sinh viên</Label>
            <Input
              placeholder="Tìm theo tên, MSSV, email, khoa, batch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <div className="max-h-56 overflow-y-auto rounded-lg border">
                {filtered.length ? (
                  filtered.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={`flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted ${selectedId === o.id ? "bg-muted" : ""}`}
                      onClick={() => setSelectedId(o.id)}
                    >
                      <span className="font-medium">{o.internName}</span>
                      <span className="text-xs text-muted-foreground">
                        MSSV: {o.studentCode} · {o.department} · Batch {o.batch} · {o.email}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="p-3 text-sm text-muted-foreground">Không tìm thấy.</p>
                )}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label>Loại đánh giá</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="flex h-9 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="weekly">Hàng tuần</option>
                <option value="midterm">Giữa kỳ</option>
                <option value="final">Cuối kỳ</option>
                <option value="feedback_360">Feedback 360</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Kỳ đánh giá</Label>
              <Input
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="VD: Giữa kỳ T10/2026"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Thời gian</Label>
              <div className="flex items-center gap-1">
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                <span>→</span>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Thông tin sinh viên</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
            <span>Họ tên: <b>{selected.internName}</b></span>
            <span>MSSV: <b>{selected.studentCode}</b></span>
            <span>Khoa/Trường: <b>{selected.school ?? "—"}</b></span>
            <span>Ngành: <b>{selected.major ?? "—"}</b></span>
            <span>Phòng ban: <b>{selected.department}</b></span>
            <span>Mentor: <b>{selected.mentor}</b></span>
            <span>Kỳ thực tập: <b>{selected.startDate ?? "—"} – {selected.endDate ?? "—"}</b></span>
            <span>Batch: <b>{selected.batch}</b></span>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-amber-600">⚠ Vui lòng chọn sinh viên để bắt đầu đánh giá.</p>
      )}

      {selected && context ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Thống kê thực tập</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <span>Ngày thực tập: <b>{String(att.total_days ?? 0)}</b></span>
            <span>Đúng giờ: <b>{String(att.present ?? 0)}</b></span>
            <span>Đi trễ: <b>{String(att.late ?? 0)}</b></span>
            <span>Tỷ lệ đúng giờ: <b>{String(att.punctuality_rate ?? "—")}%</b></span>
            <span>Task được giao: <b>{String(tasks?.total ?? 0)}</b></span>
            <span>Task hoàn thành: <b>{String(tasks?.completed ?? 0)}</b></span>
            <span>Task đúng hạn: <b>—</b></span>
            <span>Điểm Task TB: <b>{String(tasks?.avg_score ?? "—")}</b></span>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Hủy</Button>
        <Button disabled={pending || !selectedId} onClick={submit}>
          {pending ? "Đang tạo..." : "Tạo đánh giá"}
        </Button>
      </div>

      {selectedId ? (
        <p className="text-xs text-muted-foreground">
          Sau khi tạo, bạn sẽ chấm điểm theo từng tiêu chí ở trang chi tiết đánh giá.
        </p>
      ) : null}
    </div>
  );
}
