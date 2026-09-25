"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { updateOnboardingRecordAction } from "./actions";
import type { ActionState, NamedOption, OnboardingDetail, SelectOption } from "./types";

export function EditOnboardingRecordForm({
  detail,
  hrUsers,
  departments,
  mentors,
}: {
  detail: OnboardingDetail;
  hrUsers: NamedOption[];
  departments: SelectOption[];
  mentors: SelectOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const action = updateOnboardingRecordAction.bind(null, detail.id);
  const [state, formAction, pending] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await action(previous, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.success ?? "Đã cập nhật hồ sơ.");
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    {},
  );

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={detail.status === "cancelled"}>
        <Pencil />Chỉnh sửa
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Chỉnh sửa hồ sơ</SheetTitle>
            <SheetDescription>Cập nhật phòng ban, mentor, người phụ trách và thời hạn onboarding.</SheetDescription>
          </SheetHeader>
          <form action={formAction} className="flex flex-col gap-4 px-4 pb-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-assigned-hr">Người phụ trách</Label>
              <select id="edit-assigned-hr" name="assigned_hr_id" defaultValue={detail.assigned_hr_id ?? ""} required className="h-8 rounded-lg border bg-background px-2 text-sm">
                {hrUsers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-department">Phòng ban</Label>
                <select id="edit-department" name="department_id" defaultValue={detail.department_id ?? ""} className="h-8 rounded-lg border bg-background px-2 text-sm">
                  <option value="">Chưa gán</option>
                  {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-mentor">Mentor</Label>
                <select id="edit-mentor" name="mentor_id" defaultValue={detail.mentor_id ?? ""} className="h-8 rounded-lg border bg-background px-2 text-sm">
                  <option value="">Chưa gán</option>
                  {mentors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-start">Ngày bắt đầu kỳ</Label>
                <Input id="edit-start" name="start_date" type="date" defaultValue={detail.start_date ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-end">Ngày kết thúc dự kiến</Label>
                <Input id="edit-end" name="end_date" type="date" defaultValue={detail.end_date ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-onboarding-start">Bắt đầu onboarding</Label>
                <Input id="edit-onboarding-start" name="onboarding_start_date" type="date" defaultValue={detail.onboarding_start_date} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-due">Hạn hoàn thành</Label>
                <Input id="edit-due" name="due_date" type="date" defaultValue={detail.due_date} required />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-notes">Ghi chú HR</Label>
              <Textarea id="edit-notes" name="notes" defaultValue={detail.notes ?? ""} />
            </div>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <SheetFooter><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Lưu thay đổi"}</Button></SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
