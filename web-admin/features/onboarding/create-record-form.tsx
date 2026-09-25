"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { createOnboardingRecordAction } from "./actions";
import type { OnboardingRecordOption } from "./data";
import type { ActionState, NamedOption } from "./types";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function CreateOnboardingRecordForm({
  internships,
  templates,
  hrUsers,
  currentUserId,
}: {
  internships: OnboardingRecordOption[];
  templates: NamedOption[];
  hrUsers: NamedOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState(internships[0]?.id ?? "");
  const selected = internships.find((item) => item.id === selectedId) ?? internships[0];
  const [startDate, setStartDate] = React.useState(selected?.start_date ?? isoDate(new Date()));
  const [dueDate, setDueDate] = React.useState(() => {
    const base = selected?.start_date ? new Date(`${selected.start_date}T00:00:00`) : new Date();
    base.setDate(base.getDate() + 7);
    return isoDate(base);
  });

  const [state, formAction, pending] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await createOnboardingRecordAction(previous, formData);
      if (result.error) {
        toast.error(result.error);
        return result;
      }
      toast.success(result.success ?? "Đã tạo hồ sơ onboarding.");
      setOpen(false);
      if (result.recordId) router.push(`/admin/onboarding/${result.recordId}`);
      else router.refresh();
      return result;
    },
    {},
  );

  function selectInternship(value: string) {
    setSelectedId(value);
    const option = internships.find((item) => item.id === value);
    const start = option?.start_date ?? isoDate(new Date());
    const due = new Date(`${start}T00:00:00`);
    due.setDate(due.getDate() + 7);
    setStartDate(start);
    setDueDate(isoDate(due));
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={internships.length === 0}>
        <Plus />Tạo hồ sơ
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Tạo hồ sơ onboarding</SheetTitle>
            <SheetDescription>
              Chọn kỳ thực tập đã được phân công. Hệ thống sẽ liên kết thực tập sinh, đợt, phòng ban và mentor hiện có.
            </SheetDescription>
          </SheetHeader>
          <form action={formAction} className="flex flex-col gap-4 px-4 pb-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="internship_id">Hồ sơ thực tập</Label>
              <select
                id="internship_id"
                name="internship_id"
                required
                value={selectedId}
                onChange={(event) => selectInternship(event.target.value)}
                className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
              >
                {internships.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
              {state.fieldErrors?.internship_id ? (
                <p className="text-xs text-destructive">{state.fieldErrors.internship_id[0]}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="onboarding_start_date">Ngày bắt đầu onboarding</Label>
                <Input
                  id="onboarding_start_date"
                  name="onboarding_start_date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="due_date">Hạn hoàn thành</Label>
                <Input
                  id="due_date"
                  name="due_date"
                  type="date"
                  required
                  min={startDate}
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="assigned_hr_id">Người phụ trách</Label>
              <select
                id="assigned_hr_id"
                name="assigned_hr_id"
                required
                defaultValue={hrUsers.some((item) => item.id === currentUserId) ? currentUserId : hrUsers[0]?.id}
                className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
              >
                {hrUsers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="template_id">Mẫu checklist</Label>
              <select id="template_id" name="template_id" required className="h-8 w-full rounded-lg border bg-background px-2 text-sm">
                {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Ghi chú HR</Label>
              <Textarea id="notes" name="notes" placeholder="Thông tin cần lưu ý cho hồ sơ onboarding" />
            </div>

            {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
            <SheetFooter>
              <Button type="submit" disabled={pending || internships.length === 0}>
                {pending ? "Đang tạo..." : "Tạo hồ sơ"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
