"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/features/labels";
import { createSubtask, type TaskFormState } from "../task-actions";
import { SubtaskStatusControl } from "../task-status";

export type SubtaskRow = {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  status: string;
  due_date: string | null;
  priority: string;
  deliverable: string | null;
};

type AssigneeOpt = {
  intern_id: string;
  role: string | null;
  name: string | null;
  internUserId?: string | null;
};

const initialState: TaskFormState = {};

export function SubtasksPanel({
  taskId,
  subtasks,
  assignees,
  canManage,
  isIntern,
}: {
  taskId: string;
  subtasks: SubtaskRow[];
  assignees: {
    intern_id: string;
    interns: { full_name: string } | null;
  }[];
  canManage: boolean;
  isIntern: boolean;
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
    role: null,
    name: a.interns?.full_name ?? "—",
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Sub-tasks ({subtasks.length})</CardTitle>
        {canManage ? (
          <Button size="xs" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus className="size-4" />
            Thêm sub-task
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
                <Label htmlFor="st_assignee">Phụ trách</Label>
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
                <Label htmlFor="st_deliverable">Deliverable</Label>
                <Input id="st_deliverable" name="deliverable" placeholder="VD: source_code" />
              </div>
            </div>
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

        {subtasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có sub-task.</p>
        ) : (
          subtasks.map((st) => (
            <div key={st.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {st.status === "completed" ? <Check className="size-4 text-emerald-500" /> : null}
                  <span className="text-sm font-medium">{st.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={st.priority} />
                  <StatusBadge value={st.status} />
                </div>
              </div>
              {st.description ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{st.description}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  Phụ trách:{" "}
                  {st.assignee_id
                    ? assigneeOpts.find((a) => a.intern_id === st.assignee_id)?.name ?? "—"
                    : "—"}
                </span>
                {st.due_date ? <span>Hạn: {formatDateTime(st.due_date)}</span> : null}
                {st.deliverable ? <span>Deliverable: {st.deliverable}</span> : null}
              </div>
              {!isIntern ? (
                <div className="pt-1">
                  <SubtaskStatusControl id={st.id} status={st.status} />
                </div>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}