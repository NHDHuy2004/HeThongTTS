"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reviewRequest } from "./request-actions";

export function ReviewButtons({
  kind,
  id,
  status,
}: {
  kind: "leave" | "wfh" | "late";
  id: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const router = useRouter();

  if (status === "approved" || status === "rejected") {
    return null;
  }

  const act = (approved: boolean) => {
    startTransition(async () => {
      const { error } = await reviewRequest(kind, id, approved, note.trim());
      if (error) toast.error(error);
      else {
        toast.success(approved ? "Đã duyệt đơn." : "Đã từ chối đơn.");
        setNote("");
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú duyệt (tùy chọn)"
          rows={1}
          className="h-8 min-h-fit w-48 px-2 py-1 text-xs"
        />
        <Button
          size="icon-sm"
          variant="default"
          disabled={pending}
          onClick={() => act(true)}
          aria-label="Duyệt"
        >
          <Check className="size-4" />
        </Button>
        <Button
          size="icon-sm"
          variant="destructive"
          disabled={pending}
          onClick={() => act(false)}
          aria-label="Từ chối"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}