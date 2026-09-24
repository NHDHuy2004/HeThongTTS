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

export function BatchForm() {
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
      start_date: String(form.get("start_date")),
      end_date: String(form.get("end_date")),
      max_interns: Number(form.get("max_interns") || 0),
      location: (form.get("location") as string) || null,
      status: "upcoming" as const,
    };

    setPending(true);
    const { error } = await supabase.from("internship_batches").insert(payload);
    setPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Đã tạo đợt thực tập.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Tạo đợt thực tập
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-md">
          <SheetHeader>
            <SheetTitle>Tạo đợt thực tập</SheetTitle>
            <SheetDescription>Đợt mới sẽ ở trạng thái “sắp tới”.</SheetDescription>
          </SheetHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Tên đợt</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Mã đợt</Label>
              <Input id="code" name="code" placeholder="IT-2026-02" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Mô tả</Label>
              <Input id="description" name="description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="start_date">Ngày bắt đầu</Label>
                <Input id="start_date" name="start_date" type="date" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="end_date">Ngày kết thúc</Label>
                <Input id="end_date" name="end_date" type="date" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="max_interns">SL tối đa</Label>
                <Input id="max_interns" name="max_interns" type="number" min={1} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="location">Địa điểm</Label>
                <Input id="location" name="location" />
              </div>
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

const BATCH_STATUSES = ["upcoming", "active", "completed", "cancelled"] as const;

export function BatchStatusForm({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = React.useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function update(next: string) {
    setPending(true);
    const { error } = await supabase
      .from("internship_batches")
      .update({ status: next as (typeof BATCH_STATUSES)[number] })
      .eq("id", id);
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Đã cập nhật trạng thái.");
    router.refresh();
  }

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => update(e.target.value)}
      className="flex h-7 items-center rounded-lg border border-input bg-transparent px-2 text-xs"
    >
      {BATCH_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}