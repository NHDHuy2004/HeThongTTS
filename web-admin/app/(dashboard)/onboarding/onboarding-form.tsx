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
import { createChecklist, type OnboardingFormState } from "./onboarding-actions";

type Option = { id: string; name: string };

const initialState: OnboardingFormState = {};

export function OnboardingForm({ interns }: { interns: Option[] }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  const [state, formAction, pending] = useActionState(
    async (prev: OnboardingFormState, formData: FormData) => {
      const result = await createChecklist(prev, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Đã tạo mục onboarding.");
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
        Thêm mục
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Thêm mục onboarding</SheetTitle>
            <SheetDescription>Tạo việc cần làm cho thực tập sinh.</SheetDescription>
          </SheetHeader>
          <form action={formAction} className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="intern_id">Thực tập sinh</Label>
              <select
                id="intern_id"
                name="intern_id"
                required
                className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="">— Chọn —</option>
                {interns.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Tiêu đề</Label>
              <Input id="title" name="title" placeholder="VD: Nhận laptop, tạo email..." required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="due_date">Hạn hoàn thành</Label>
              <Input id="due_date" name="due_date" type="date" />
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