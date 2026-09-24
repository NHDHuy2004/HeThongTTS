"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
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

type DepartmentOption = { id: string; name: string };

export function MentorForm({
  departments,
  triggerLabel = "Thêm mentor",
}: {
  departments: DepartmentOption[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      employee_code: String(form.get("employee_code")),
      full_name: String(form.get("full_name")),
      email: String(form.get("email")),
      phone: (form.get("phone") as string) || null,
      department_id: (form.get("department_id") as string) || null,
      max_interns: Number(form.get("max_interns") || 10),
    };

    setPending(true);
    const { error } = await supabase.from("mentors").insert(payload);
    setPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Đã tạo mentor thành công.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {triggerLabel}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-md">
          <SheetHeader>
            <SheetTitle>Thêm mentor</SheetTitle>
            <SheetDescription>
              Tạo hồ sơ người hướng dẫn mới.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="employee_code">Mã nhân viên</Label>
              <Input id="employee_code" name="employee_code" placeholder="EMP-0002" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="full_name">Họ tên</Label>
              <Input id="full_name" name="full_name" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="department_id">Phòng ban</Label>
              <select
                id="department_id"
                name="department_id"
                className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm shadow-sm"
              >
                <option value="">— Chưa chọn —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="max_interns">Số intern tối đa</Label>
              <Input
                id="max_interns"
                name="max_interns"
                type="number"
                min={1}
                defaultValue={10}
              />
            </div>
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