"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { submitEvaluation } from "./evaluation-actions";

export function SubmitEvaluation({ id, submitted }: { id: string; submitted: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (submitted) return null;

  return (
    <Button
      size="xs"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const { error } = await submitEvaluation(id);
          if (error) toast.error(error);
          else {
            toast.success("Đã nộp đánh giá.");
            router.refresh();
          }
        });
      }}
    >
      <Send className="size-3.5" />
      Nộp
    </Button>
  );
}