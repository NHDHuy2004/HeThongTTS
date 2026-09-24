"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toggleChecklist } from "./onboarding-actions";

export function ToggleChecklist({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const done = status === "done" || status === "completed";

  return (
    <Button
      size="xs"
      variant={done ? "outline" : "default"}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const { error } = await toggleChecklist(id, !done);
          if (error) toast.error(error);
          else {
            toast.success(done ? "Đã đánh dấu chưa xong." : "Đã hoàn thành mục này.");
            router.refresh();
          }
        });
      }}
    >
      {done ? <RotateCcw className="size-3.5" /> : <Check className="size-3.5" />}
      {done ? "Mở lại" : "Xong"}
    </Button>
  );
}