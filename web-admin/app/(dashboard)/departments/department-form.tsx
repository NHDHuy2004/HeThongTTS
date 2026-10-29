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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DepartmentForm() {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name")),
      code: String(form.get("code")),
      description: (form.get("description") as string) || null,
    };

    setPending(true);
    const { error } = await supabase.from("departments").insert(payload);
    setPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Đã tạo phòng ban.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Thêm phòng ban
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm phòng ban</DialogTitle>
            <DialogDescription>Tạo phòng ban mới.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Tên phòng ban</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Mã</Label>
              <Input id="code" name="code" placeholder="DEV" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Mô tả</Label>
              <Input id="description" name="description" />
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Đang lưu..." : "Lưu"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ToggleDepartment({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, setPending] = React.useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function toggle() {
    setPending(true);
    const { error } = await supabase
      .from("departments")
      .update({ is_active: !isActive })
      .eq("id", id);
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Đã cập nhật.");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} disabled={pending}>
      {isActive ? "Vô hiệu" : "Kích hoạt"}
    </Button>
  );
}