"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { updateTaskStatus } from "./task-actions";

const STEPS = [
  { value: "todo", label: "Chưa làm" },
  { value: "in_progress", label: "Đang làm" },
  { value: "review", label: "Chờ duyệt" },
  { value: "done", label: "Hoàn thành" },
];

export function TaskStatusControl({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const current = STEPS.findIndex((s) => s.value === status);

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => (
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