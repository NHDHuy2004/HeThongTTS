"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { updateTaskStatus, updateSubtaskStatus } from "./task-actions";

export const TASK_STEPS = [
  { value: "not_started", label: "Chưa làm" },
  { value: "in_progress", label: "Đang làm" },
  { value: "in_review", label: "Chờ duyệt" },
  { value: "changes_requested", label: "Cần sửa" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã hủy" },
];

export function TaskStatusControl({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const current = TASK_STEPS.findIndex((s) => s.value === status);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {TASK_STEPS.map((s, i) => (
        <Button
          key={s.value}
          size="xs"
          variant={i === current ? "default" : "ghost"}
          disabled={pending || i === current}
          onClick={() => {
            startTransition(async () => {
              const { error } = await updateTaskStatus(id, s.value);
              if (error) toast.error(error);
              else {
                toast.success(`Đã chuyển sang "${s.label}".`);
                router.refresh();
              }
            });
          }}
        >
          {s.label}
        </Button>
      ))}
    </div>
  );
}

export function SubtaskStatusControl({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const current = TASK_STEPS.findIndex((s) => s.value === status);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {TASK_STEPS.filter((s) => s.value !== "cancelled").map((s, i) => (
        <Button
          key={s.value}
          size="xs"
          variant={i === current ? "default" : "ghost"}
          disabled={pending || i === current}
          onClick={() => {
            startTransition(async () => {
              const { error } = await updateSubtaskStatus(id, s.value);
              if (error) toast.error(error);
              else {
                toast.success(`Đã chuyển sang "${s.label}".`);
                router.refresh();
              }
            });
          }}
        >
          {s.label}
        </Button>
      ))}
    </div>
  );
}