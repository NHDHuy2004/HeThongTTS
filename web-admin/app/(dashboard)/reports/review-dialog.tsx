"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { reviewReport } from "./report-actions";

export function ReviewReportDialog({
  kind,
  id,
  defaultFeedback,
  defaultScore,
}: {
  kind: "daily" | "weekly";
  id: string;
  defaultFeedback?: string | null;
  defaultScore?: number | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState(defaultFeedback ?? "");
  const [score, setScore] = React.useState(defaultScore?.toString() ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = () => {
    startTransition(async () => {
      const { error } = await reviewReport(kind, id, feedback, score);
      if (error) toast.error(error);
      else {
        toast.success("Đã lưu nhận xét.");
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
        Nhận xét
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nhận xét báo cáo</SheetTitle>
            <SheetDescription>Đưa phản hồi và chấm điểm cho thực tập sinh.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="feedback">Nhận xét</Label>
              <Textarea
                id="feedback"
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="score">Điểm (0 – 100)</Label>
              <Input
                id="score"
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />
            </div>
            <SheetFooter className="pt-2">
              <Button onClick={submit} disabled={pending}>
                {pending ? "Đang lưu..." : "Lưu"}
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}