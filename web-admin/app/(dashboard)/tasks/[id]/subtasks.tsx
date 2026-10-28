"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/features/labels";
import {
  cancelSubtask,
  createSubtask,
  updateSubtaskProgress,
  updateSubtaskStatus,
  type TaskFormState,
} from "../task-actions";
import { SubtaskStatusControl } from "../task-status";

export type SubtaskRow = {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  status: string;
  due_date: string | null;
  start_date: string | null;
  priority: string;
  deliverable: string | null;
  objective: string | null;
  requirements: string | null;
  acceptance_criteria: string | null;
  deliverables: unknown;
  weight: number | null;
  progress: number | null;
  estimated_hours: number | null;
  is_required: boolean | null;
  parent_subtask_id: string | null;
  completed_at: string | null;
  created_at: string | null;
};

type AssigneeOpt = {
  intern_id: string;
  name: string | null;
};

const initialState: TaskFormState = {};

export function SubtasksPanel({
  taskId,
  subtasks,
  assignees,
  canManage,
  isIntern,
  myInternId,
}: {
  taskId: string;
  subtasks: SubtaskRow[];
  assignees: {
    intern_id: string;
    interns: { full_name: string } | null;
  }[];
  canManage: boolean;
  isIntern: boolean;
  myInternId?: string | null;
}) {
  const [showForm, setShowForm] = React.useState(false);
  const router = useRouter();

  const [state, formAction, pending] = useActionState(
    async (prev: TaskFormState, formData: FormData) => {
      const result = await createSubtask(taskId, prev, formData);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Đã thêm sub-task.");
        setShowForm(false);
        router.refresh();
      }
      return result;
    },
    initialState,
  );

  const assigneeOpts: AssigneeOpt[] = (assignees ?? []).map((a) => ({
    intern_id: a.intern_id,
    name: a.interns?.full_name ?? "—",
  }));
  const nameOfIntern = (id: string | null) =>
    id ? assigneeOpts.find((a) => a.intern_id === id)?.name ?? "—" : "—";

  // Intern chỉ tập trung vào phần việc của mình
  const visible = isIntern && myInternId
    ? subtasks.filter((s) => s.assignee_id === myInternId)
    : subtasks;

  const topLevel = visible.filter((s) => !s.parent_subtask_id);
  const childrenOf = (id: string) =>
    visible.filter((s) => s.parent_subtask_id === id);

  const overdue = (s: SubtaskRow) =>
    !!s.due_date &&
    s.status !== "completed" &&
    s.status !== "cancelled" &&
    new Date(s.due_date).getTime() < Date.now();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">
          {isIntern ? "Phần việc của tôi" : "Cây công việc"} ({visible.length})
        </CardTitle>
        {canManage ? (
          <Button size="xs" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus className="size-4" />
            Thêm Task con
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {showForm ? (
          <form action={formAction} className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="st_title">Tiêu đề</Label>
                <Input id="st_title" name="title" required />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="st_assignee">Người chịu trách nhiệm</Label>
                <select
                  id="st_assignee"
                  name="assignee_id"
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">—</option>
                  {assigneeOpts.map((a) => (
                    <option key={a.intern_id} value={a.intern_id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="st_desc">Mô tả</Label>
              <Textarea id="st_desc" name="description" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="st_start">Bắt đầu</Label>
                <Input id="st_start" name="start_date" type="datetime-local" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="st_due">Hạn</Label>
                <Input id="st_due" name="due_date" type="datetime-local" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="st_priority">Ưu tiên</Label>
                <select
                  id="st_priority"
                  name="priority"
                  defaultValue="medium"
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="low">Thấp</option>
                  <option value="medium">Trung bình</option>
                  <option value="high">Cao</option>
                  <option value="urgent">Khẩn cấp</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="st_weight">Trọng số</Label>
                <Input id="st_weight" name="weight" type="number" min={0} step="any" placeholder="vd: 30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="st_hours">Giờ dự kiến</Label>
                <Input id="st_hours" name="estimated_hours" type="number" min={0} step="any" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="st_parent">Task cha (nếu lồng)</Label>
                <select
                  id="st_parent"
                  name="parent_subtask_id"
                  defaultValue="none"
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="none">— (cấp 1)</option>
                  {subtasks
                    .filter((s) => !s.parent_subtask_id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="st_deliverable">Deliverable</Label>
                <Input id="st_deliverable" name="deliverable" placeholder="VD: source_code" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="st_objective">Mục tiêu</Label>
              <Textarea id="st_objective" name="objective" rows={2} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="st_req">Yêu cầu</Label>
              <Textarea id="st_req" name="requirements" rows={2} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="st_ac">Tiêu chí nghiệm thu</Label>
              <Textarea id="st_ac" name="acceptance_criteria" rows={2} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_required" defaultChecked className="size-4" />
              Task con bắt buộc
            </label>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Hủy
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Đang lưu..." : "Lưu"}
              </Button>
            </div>
          </form>
        ) : null}

        {topLevel.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có Task con.</p>
        ) : (
          topLevel.map((s) => (
            <TreeNode
              key={s.id}
              node={s}
              depth={0}
              childrenOf={childrenOf}
              nameOfIntern={nameOfIntern}
              canManage={canManage}
              isIntern={isIntern}
              myInternId={myInternId ?? null}
              overdue={overdue}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function TreeNode({
  node,
  depth,
  childrenOf,
  nameOfIntern,
  canManage,
  isIntern,
  myInternId,
  overdue,
}: {
  node: SubtaskRow;
  depth: number;
  childrenOf: (id: string) => SubtaskRow[];
  nameOfIntern: (id: string | null) => string;
  canManage: boolean;
  isIntern: boolean;
  myInternId: string | null;
  overdue: (s: SubtaskRow) => boolean;
}) {
  const [progressInput, setProgressInput] = React.useState<string>(
    String(node.progress ?? 0),
  );
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();

  const kids = childrenOf(node.id);
  const mine = isIntern && myInternId && node.assignee_id === myInternId;

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border p-3"
      style={{ marginLeft: depth * 16 }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {node.status === "completed" ? <Check className="size-4 text-emerald-500" /> : null}
          <span className="text-sm font-medium">{node.title}</span>
          {node.is_required === false ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">tuỳ chọn</span>
          ) : null}
          {overdue(node) ? (
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">Quá hạn</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge value={node.priority} />
          <StatusBadge value={node.status} />
          {canManage ? (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                startTransition(async () => {
                  const { error } = await cancelSubtask(node.id);
                  if (error) toast.error(error);
                  else {
                    toast.success("Đã hủy Task con.");
                    router.refresh();
                  }
                });
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
      {node.description ? (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{node.description}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Phụ trách: {nameOfIntern(node.assignee_id)}</span>
        {node.due_date ? <span>Hạn: {formatDateTime(node.due_date)}</span> : null}
        {node.weight ? <span>Trọng số: {node.weight}</span> : null}
        {node.estimated_hours != null ? <span>~{node.estimated_hours}h</span> : null}
        {node.deliverable ? <span>Deliverable: {node.deliverable}</span> : null}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.max(0, node.progress ?? 0))}%` }}
          />
        </div>
        <span className="w-10 text-right text-xs font-medium">{node.progress ?? 0}%</span>
      </div>

      {node.objective || node.requirements || node.acceptance_criteria ? (
        <div className="flex flex-col gap-1 rounded-md bg-muted/40 p-2 text-xs">
          {node.objective ? <span><b>Mục tiêu:</b> {node.objective}</span> : null}
          {node.requirements ? <span><b>Yêu cầu:</b> {node.requirements}</span> : null}
          {node.acceptance_criteria ? <span><b>Nghiệm thu:</b> {node.acceptance_criteria}</span> : null}
        </div>
      ) : null}

      {/* Intern cập nhật tiến độ */}
      {isIntern && mine ? (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={100}
            className="h-8 w-24"
            value={progressInput}
            onChange={(e) => setProgressInput(e.target.value)}
          />
          <Button
            size="xs"
            variant="outline"
            disabled={pending}
            onClick={() => {
              const v = Number(progressInput);
              startTransition(async () => {
                const { error } = await updateSubtaskProgress(node.id, v);
                if (error) toast.error(error);
                else {
                  toast.success("Đã cập nhật tiến độ.");
                  router.refresh();
                }
              });
            }}
          >
            Cập nhật tiến độ
          </Button>
        </div>
      ) : null}

      {/* Status control: staff thấy hết; intern chỉ thấy nút làm việc */}
      {canManage ? (
        <div className="pt-1">
          <SubtaskStatusControl id={node.id} status={node.status} />
        </div>
      ) : isIntern && mine ? (
        <InternStatusButtons id={node.id} status={node.status} />
      ) : null}

      {kids.length > 0 ? (
        <div className="flex flex-col gap-2">
          {kids.map((k) => (
            <TreeNode
              key={k.id}
              node={k}
              depth={depth + 1}
              childrenOf={childrenOf}
              nameOfIntern={nameOfIntern}
              canManage={canManage}
              isIntern={isIntern}
              myInternId={myInternId}
              overdue={overdue}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InternStatusButtons({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  const next: Record<string, { value: string; label: string }[]> = {
    not_started: [{ value: "in_progress", label: "Bắt đầu" }],
    in_progress: [{ value: "in_review", label: "Nộp duyệt" }],
    changes_requested: [{ value: "in_progress", label: "Làm lại" }],
    in_review: [],
    completed: [],
    cancelled: [],
  };
  const actions = next[status] ?? [];
  if (!actions.length) return null;
  return (
    <div className="flex gap-2 pt-1">
      {actions.map((a) => (
        <Button
          key={a.value}
          size="xs"
          variant="outline"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const { error } = await updateSubtaskStatus(id, a.value);
              if (error) toast.error(error);
              else {
                toast.success(`Đã chuyển sang "${a.label}".`);
                router.refresh();
              }
            });
          }}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}
