"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createEvaluation, type EvalFormState } from "./evaluation-actions";

type Option = { id: string; name: string };

const initialState: EvalFormState = {};

export function EvalForm({ internships }: { internships: Option[] }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  const [state, formAction, pending] = useActionState(
    async (prev: EvalFormState, formData: FormData) => {
      const result = await createEvaluation(prev, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Đã tạo đánh giá.");
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialState,
  );

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Tạo đánh giá
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Tạo đánh giá</SheetTitle>
            <SheetDescription>Tạo phiếu đánh giá cho thực tập sinh.</SheetDescription>
          </SheetHeader>
          <form action={formAction} className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="internship_id">Intern</Label>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="type">Loại</Label>
                <select
                  id="type"
                  name="type"
                  defaultValue="weekly"
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="weekly">Hàng tuần</option>
                  <option value="midterm">Giữa kỳ</option>
                  <option value="final">Cuối kỳ</option>
                  <option value="feedback_360">Feedback 360</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="due_date">Hạn</Label>
                <Input id="due_date" name="due_date" type="date" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="period_label">Kỳ đánh giá</Label>
              <Input id="period_label" name="period_label" placeholder="VD: Tuần 3" required />
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