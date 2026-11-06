"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createAttendanceAction,
  type CreateAttendanceState,
} from "@/features/attendance/actions";
import { getStatusLabel } from "@/features/labels";
import type { AttendanceStatus } from "@/types/database";

export type InternshipOption = {
  internship_id: string;
  full_name: string;
  student_code: string | null;
  email: string | null;
  batch_name: string;
};

const STATUS_OPTIONS: AttendanceStatus[] = [
  "present",
  "late",
  "early_leave",
  "absent",
  "leave",
  "wfh",
];

/** Ngày hôm nay theo local time của máy chủ trình duyệt. */
function todayIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Tạo bản ghi điểm danh thủ công (HR/Admin) — Trường hợp A.
 * Không đụng luồng GPS check-in của Intern (Trường hợp B).
 */
export function CreateAttendanceButton({
  internships,
}: {
  internships: InternshipOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [internshipId, setInternshipId] = React.useState("");
  const [showTimeFields, setShowTimeFields] = React.useState(true);

  const [state, formAction, pending] = useActionState<
    CreateAttendanceState,
    FormData
  >(
    async (previous, formData) => {
      const result = await createAttendanceAction(previous, formData);
      if (result.error) {
        toast.error(result.error);
        return result;
      }
      toast.success(result.success ?? "Đã tạo bản ghi điểm danh.");
      setOpen(false);
      setQuery("");
      setInternshipId("");
      router.refresh();
      return result;
    },
    {},
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return internships;
    return internships.filter(
      (o) =>
        o.full_name.toLowerCase().includes(q) ||
        (o.student_code ?? "").toLowerCase().includes(q) ||
        (o.email ?? "").toLowerCase().includes(q) ||
        o.batch_name.toLowerCase().includes(q),
    );
  }, [internships, query]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Tạo điểm danh mới
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo bản ghi điểm danh</DialogTitle>
            <DialogDescription>
              Tạo thủ công khi thực tập sinh không thể điểm danh GPS. Mentor
              chỉ tạo được cho thực tập sinh mình phụ trách. Mọi bản ghi được
              ghi vào nhật ký audit kèm lý do.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="att-search">Thực tập sinh</Label>
              <Input
                id="att-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo MSSV, họ tên hoặc email..."
                autoComplete="off"
              />
              <select
                id="att-internship"
                name="internship_id"
                value={internshipId}
                onChange={(e) => setInternshipId(e.target.value)}
                required
                className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
              >
                <option value="">— Chọn thực tập sinh —</option>
                {filtered.map((o) => (
                  <option key={o.internship_id} value={o.internship_id}>
                    {o.student_code ? `${o.student_code} · ` : ""}
                    {o.full_name} ({o.batch_name})
                    {o.email ? ` · ${o.email}` : ""}
                  </option>
                ))}
              </select>
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Không tìm thấy thực tập sinh phù hợp.
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="att-date">Ngày điểm danh *</Label>
                <Input
                  id="att-date"
                  name="work_date"
                  type="date"
                  required
                  defaultValue={todayIso()}
                  max={todayIso()}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="att-status">Trạng thái *</Label>
                <select
                  id="att-status"
                  name="status"
                  defaultValue="present"
                  onChange={(e) =>
                    setShowTimeFields(
                      e.target.value !== "absent" && e.target.value !== "leave",
                    )
                  }
                  className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {getStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {showTimeFields ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="att-checkin">Giờ check-in</Label>
                  <Input
                    id="att-checkin"
                    name="check_in_time"
                    type="time"
                    step={60}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="att-checkout">Giờ check-out</Label>
                  <Input
                    id="att-checkout"
                    name="check_out_time"
                    type="time"
                    step={60}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="att-note">Ghi chú</Label>
              <Textarea
                id="att-note"
                name="note"
                placeholder="Nội dung ghi chú (không bắt buộc)"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="att-reason">Lý do tạo bản ghi *</Label>
              <Textarea
                id="att-reason"
                name="reason"
                required
                minLength={5}
                placeholder="Ví dụ: intern quên check-in, xác nhận từ nhật ký camera..."
              />
            </div>

            {state.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Đang lưu..." : "Tạo bản ghi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
