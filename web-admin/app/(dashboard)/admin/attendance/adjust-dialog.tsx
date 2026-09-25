"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adjustAttendanceAction, type AdjustState } from "@/features/attendance/actions";
import { getStatusLabel } from "@/features/labels";
import type { AttendanceStatus } from "@/types/database";

const STATUS_OPTIONS: AttendanceStatus[] = [
  "present",
  "late",
  "early_leave",
  "absent",
  "leave",
  "wfh",
];

export function AdjustAttendanceButton({
  attendanceId,
  currentStatus,
}: {
  attendanceId: string;
  currentStatus: AttendanceStatus;
}) {
  const [open, setOpen] = React.useState(false);

  const [state, formAction, pending] = useActionState<AdjustState, FormData>(
    async (previous, formData) => {
      const result = await adjustAttendanceAction(previous, formData);
      if (result.error) {
        toast.error(result.error);
        return result;
      }
      toast.success(result.success ?? "Đã điều chỉnh.");
      setOpen(false);
      return result;
    },
    {},
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Wrench /> Điều chỉnh
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-md">
          <SheetHeader>
            <SheetTitle>Điều chỉnh điểm danh</SheetTitle>
            <SheetDescription>
              Mọi điều chỉnh đều được ghi vào nhật ký audit kèm lý do.
            </SheetDescription>
          </SheetHeader>
          <form action={formAction} className="flex flex-col gap-4 px-4 pb-4">
            <input type="hidden" name="attendance_id" value={attendanceId} />
            <div className="flex flex-col gap-2">
              <Label htmlFor={`status-${attendanceId}`}>Trạng thái mới</Label>
              <select
                id={`status-${attendanceId}`}
                name="status"
                defaultValue={currentStatus}
                className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{getStatusLabel(s)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`note-${attendanceId}`}>Ghi chú</Label>
              <Textarea
                id={`note-${attendanceId}`}
                name="note"
                placeholder="Nội dung ghi chú (không bắt buộc)"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`reason-${attendanceId}`}>Lý do điều chỉnh *</Label>
              <Textarea
                id={`reason-${attendanceId}`}
                name="reason"
                required
                minLength={5}
                placeholder="Ví dụ: intern quên check-out, xác nhận từ nhật ký camera..."
              />
            </div>
            {state.error ? (
              <p role="alert" className="text-sm text-destructive">{state.error}</p>
            ) : null}
            <SheetFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Đang lưu..." : "Lưu điều chỉnh"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
