"use client";

import * as React from "react";
import Link from "next/link";
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
  className?: string | null;
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
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [type, setType] = React.useState("weekly");
  const [periodLabel, setPeriodLabel] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState("");
  const [context, setContext] = React.useState<{ attendance?: Record<string, unknown>; tasks?: unknown } | null>(null);
  const [existingId, setExistingId] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const selected = options.find((o) => o.id === selectedId) ?? null;

  const filtered = options
    .filter((o) => !batchFilter || o.batch === batchFilter)
    .filter((o) => !departmentFilter || o.department === departmentFilter)
    .filter((o) =>
      [o.internName, o.studentCode, o.email, o.department, o.batch]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .slice(0, 20);

  const batches = Array.from(new Set(options.map((o) => o.batch))).filter(Boolean);
  const departments = Array.from(new Set(options.map((o) => o.department))).filter(Boolean);

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
      if (periodLabel.trim()) {
        const { data: ex } = await supabase
          .from("evaluations")
          .select("id")
          .eq("internship_id", selectedId)
          .eq("type", type as "weekly" | "midterm" | "final" | "feedback_360")
          .eq("period_label", periodLabel.trim())
          .maybeSingle();
        if (!cancelled) setExistingId(ex?.id ?? null);
      } else {
        setExistingId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, type, periodLabel]);

  const att = context?.attendance ?? {};
  const tasksRaw = context?.tasks;
  const tasks = (Array.isArray(tasksRaw) ? tasksRaw[0] : tasksRaw) as Record<string, unknown> | null;

  const submit = () => {
    if (!selectedId) return toast.error("Vui lòng chọn sinh viên.");
    if (!periodLabel.trim()) return toast.error("Vui lòng nhập kỳ đánh giá.");
    const fd = new FormData();
    fd.set("internship_id", selectedId);
    fd.set("type", type);
    fd.set("period_label", periodLabel.trim());
    if (dueDate) fd.set("due_date", dueDate);
    if (periodStart) fd.set("period_start", periodStart);
    if (periodEnd) fd.set("period_end", periodEnd);
    startTransition(async () => {
      const result = await createEvaluation({}, fd);
      if (result?.error) {
        if (result.id) {
          toast.error(result.error);
          router.push(`/evaluations/${result.id}`);
        } else {
          toast.error(result.error);
        }
        return;
      }
      toast.success("Đã tạo đánh giá. Hãy chấm điểm theo từng tiêu chí.");
      if (result?.id) {
        router.push(`/evaluations/${result.id}`);
      } else {
        router.push("/evaluations");
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Bước 1 — Chọn đợt, phòng ban, thực tập sinh & kỳ đánh giá</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="batch-filter">Đợt thực tập</Label>
              <select
                id="batch-filter"
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
              <Label htmlFor="dept-filter">Phòng ban</Label>
              <select
                id="dept-filter"
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setSelectedId(null);
                }}
                className="flex h-9 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="">— Tất cả phòng ban —</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="search">Thực tập sinh (MSSV / họ tên)</Label>
            <Input
              id="search"
              placeholder="Tìm theo tên, MSSV, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-56 overflow-y-auto rounded-lg border">
              {filtered.length ? (
                filtered.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={selectedId === o.id}
                    className={`flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted ${selectedId === o.id ? "bg-muted ring-1 ring-inset ring-primary/30" : ""}`}
                    onClick={() => setSelectedId(o.id)}
                  >
                    <span className="font-medium">{o.internName}</span>
                    <span className="text-xs text-muted-foreground">
                      MSSV: {o.studentCode} · {o.department} · {o.batch} · {o.email}
                    </span>
                  </button>
                ))
              ) : (
                <p className="p-3 text-sm text-muted-foreground">Không tìm thấy thực tập sinh phù hợp. Hãy điều chỉnh bộ lọc hoặc từ khóa.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="eval-type">Loại đánh giá</Label>
              <select
                id="eval-type"
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
              <Label htmlFor="period-label">Kỳ đánh giá *</Label>
              <Input
                id="period-label"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="VD: Tuần 1, Giữa kỳ 2026..."
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="due-date">Hạn nộp</Label>
              <Input id="due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Thời gian kỳ</Label>
              <div className="flex items-center gap-1">
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} aria-label="Từ ngày" />
                <span aria-hidden>→</span>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} aria-label="Đến ngày" />
              </div>
            </div>
          </div>

          {existingId ? (
            <p className="rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
              Phiếu đánh giá cho kỳ này đã tồn tại.{" "}
              <Link href={`/evaluations/${existingId}`} className="font-medium underline underline-offset-4">
                Mở phiếu hiện có để cập nhật
              </Link>{" "}
              thay vì tạo trùng (mỗi kỳ chỉ một phiếu theo internship + loại + kỳ).
            </p>
          ) : null}
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Khu vực 1 — Thông tin thực tập sinh (đọc từ hồ sơ, không nhập lại)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm md:grid-cols-2">
            <span>Họ tên: <b>{selected.internName}</b></span>
            <span>MSSV: <b>{selected.studentCode}</b></span>
            <span>Email: <b>{selected.email}</b></span>
            <span>Trường học: <b>{selected.school ?? "—"}</b></span>
            <span>Ngành: <b>{selected.major ?? "—"}</b></span>
            <span>Lớp: <b>{selected.className ?? "—"}</b></span>
            <span>Phòng ban: <b>{selected.department}</b></span>
            <span>Mentor: <b>{selected.mentor}</b></span>
            <span>Kỳ thực tập: <b>{selected.startDate ?? "—"} – {selected.endDate ?? "—"}</b></span>
            <span>Đợt: <b>{selected.batch}</b></span>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-amber-600">Vui lòng chọn thực tập sinh để bắt đầu đánh giá.</p>
      )}

      {selected && context ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Thống kê thực tập (tham khảo chấm điểm)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <span>Ngày thực tập: <b>{String(att.total_days ?? 0)}</b></span>
            <span>Đúng giờ: <b>{String(att.present ?? 0)}</b></span>
            <span>Đi trễ: <b>{String(att.late ?? 0)}</b></span>
            <span>Tỷ lệ hiện diện: <b>{String(att.punctuality_rate ?? "—")}%</b></span>
            <span>Task được giao: <b>{String(tasks?.total ?? 0)}</b></span>
            <span>Task hoàn thành: <b>{String(tasks?.completed ?? 0)}</b></span>
            <span>Tỷ lệ hoàn thành: <b>{String(tasks?.completion_rate ?? "—")}%</b></span>
            <span>Điểm Task TB: <b>{String(tasks?.avg_score ?? "—")}</b></span>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Hủy</Button>
        <Button disabled={pending || !selectedId || Boolean(existingId)} onClick={submit}>
          {pending ? "Đang tạo..." : "Tạo đánh giá"}
        </Button>
      </div>

      {selectedId ? (
        <p className="text-xs text-muted-foreground">
          Sau khi tạo, bạn sẽ chấm điểm theo từng tiêu chí, nhập nhận xét tổng quan và xuất phiếu Word ở trang chi tiết.
        </p>
      ) : null}
    </div>
  );
}
