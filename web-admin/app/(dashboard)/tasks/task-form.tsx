"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { deliverablesList } from "@/features/labels";
import { cn } from "@/lib/utils";
import { createTask, type TaskFormState } from "./task-actions";

type Option = { id: string; name: string };

const initialState: TaskFormState = {};

export function TaskForm({ internships }: { internships: Option[] }) {
  const [open, setOpen] = React.useState(false);
  const [assignmentType, setAssignmentType] = React.useState<"individual" | "team">(
    "individual",
  );
  const [teamMembers, setTeamMembers] = React.useState<string[]>([]);
  const router = useRouter();

  const [state, formAction, pending] = useActionState(
    async (prev: TaskFormState, formData: FormData) => {
      const result = await createTask(prev, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Đã tạo công việc.");
        setOpen(false);
        setAssignmentType("individual");
        setTeamMembers([]);
        router.refresh();
      }
      return result;
    },
    initialState,
  );

  const toggleMember = (id: string) =>
    setTeamMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Giao việc
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Giao công việc</SheetTitle>
            <SheetDescription>
              Tạo task cá nhân hoặc task nhóm với sub-task, deliverable và file đính kèm.
            </SheetDescription>
          </SheetHeader>
          <form action={formAction} className="flex flex-col gap-4 py-4">
            {/* Assignment type */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAssignmentType("individual")}
                className={cn(
                  "rounded-lg border p-2 text-sm font-medium transition-colors",
                  assignmentType === "individual"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground",
                )}
              >
                Cá nhân
              </button>
              <button
                type="button"
                onClick={() => setAssignmentType("team")}
                className={cn(
                  "rounded-lg border p-2 text-sm font-medium transition-colors",
                  assignmentType === "team"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground",
                )}
              >
                Nhóm
              </button>
            </div>
            <input type="hidden" name="assignment_type" value={assignmentType} />

            {/* Anchor intern */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="internship_id">
                {assignmentType === "individual" ? "Intern" : "Intern chính (anchor nhóm)"}
              </Label>
              <select
                id="internship_id"
                name="internship_id"
                required
                className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="">— Chọn —</option>
                {internships.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Team members */}
            {assignmentType === "team" ? (
              <div className="flex flex-col gap-2">
                <Label>Thành viên nhóm</Label>
                <div className="flex flex-wrap gap-2">
                  {internships.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => toggleMember(i.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium",
                        teamMembers.includes(i.id)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input text-muted-foreground",
                      )}
                    >
                      {i.name}
                    </button>
                  ))}
                </div>
                {teamMembers.length > 0 ? (
                  <input type="hidden" name="_members_present" value="1" />
                ) : null}
                {teamMembers.map((id) => (
                  <input key={id} type="hidden" name="intern_ids" value={id} />
                ))}
              </div>
            ) : null}

            {/* Basic info */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Tiêu đề</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project">Dự án</Label>
              <Input id="project" name="project" placeholder="VD: IMS" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="module">Module</Label>
                <Input id="module" name="module" placeholder="VD: Task Management" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="task_type">Loại task</Label>
                <Input id="task_type" name="task_type" placeholder="feature / bug / research..." />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Mô tả</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="objective">Mục tiêu (Objective)</Label>
              <Textarea id="objective" name="objective" rows={2} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="requirements">Yêu cầu chi tiết</Label>
              <Textarea id="requirements" name="requirements" rows={3} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="acceptance_criteria">Tiêu chí nghiệm thu (Acceptance Criteria)</Label>
              <Textarea id="acceptance_criteria" name="acceptance_criteria" rows={2} />
            </div>

            {/* Deliverables */}
            <div className="flex flex-col gap-2">
              <Label>Deliverable bắt buộc</Label>
              <div className="grid grid-cols-2 gap-2">
                {deliverablesList.map((d) => (
                  <label
                    key={d.value}
                    className="flex items-center gap-2 rounded-lg border border-input px-3 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="deliverables"
                      value={d.value}
                      className="size-4 accent-primary"
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="start_date">Bắt đầu</Label>
                <Input id="start_date" name="start_date" type="datetime-local" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="deadline">Hạn chót</Label>
                <Input id="deadline" name="deadline" type="datetime-local" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="priority">Ưu tiên</Label>
                <select
                  id="priority"
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
              <div className="flex flex-col gap-2">
                <Label htmlFor="estimated_hours">Giờ dự kiến</Label>
                <Input id="estimated_hours" name="estimated_hours" type="number" min="0" step="0.5" />
              </div>
            </div>

            {/* Attachment */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="attachment">File yêu cầu (đính kèm)</Label>
              <Input id="attachment" name="attachment" type="file" />
            </div>

            {state.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}

            <SheetFooter className="pt-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Đang lưu..." : "Lưu"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}