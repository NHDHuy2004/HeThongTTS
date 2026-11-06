"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InternshipBatchesRow } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BatchFormProps = {
  batch?: InternshipBatchesRow;
};

export function BatchForm({ batch }: BatchFormProps) {
  const isEditing = Boolean(batch);
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const startDate = String(form.get("start_date") ?? "");
    const endDate = String(form.get("end_date") ?? "");
    if (endDate < startDate) {
      toast.error("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
      return;
    }

    const payload = {
      name: String(form.get("name") ?? "").trim(),
      code: String(form.get("code") ?? "").trim(),
      description: (form.get("description") as string) || null,
      start_date: startDate,
      end_date: endDate,
      max_interns: Number(form.get("max_interns") || 0),
      location: (form.get("location") as string) || null,
    };

    setPending(true);
    const query = isEditing
      ? supabase
          .from("internship_batches")
          .update(payload)
          .eq("id", batch!.id)
      : supabase.from("internship_batches").insert({
          ...payload,
          status: "upcoming" as const,
        });
    const { error } = await query;
    setPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isEditing ? "Đã cập nhật đợt thực tập." : "Đã tạo đợt thực tập.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        variant={isEditing ? "ghost" : "default"}
        size={isEditing ? "icon" : "default"}
        onClick={() => setOpen(true)}
        aria-label={isEditing ? `Sửa đợt ${batch?.name}` : "Tạo đợt thực tập"}
        title={isEditing ? "Sửa đợt thực tập" : undefined}
      >
        {isEditing ? <Pencil className="size-4" /> : <Plus className="size-4" />}
        {!isEditing && "Tạo đợt thực tập"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Sửa đợt thực tập" : "Tạo đợt thực tập"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Cập nhật thông tin của đợt thực tập."
                : "Đợt mới sẽ ở trạng thái “sắp tới”."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Tên đợt</Label>
              <Input id="name" name="name" defaultValue={batch?.name ?? ""} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Mã đợt</Label>
              <Input
                id="code"
                name="code"
                defaultValue={batch?.code ?? ""}
                placeholder="IT-2026-02"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Mô tả</Label>
              <Input id="description" name="description" defaultValue={batch?.description ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="start_date">Ngày bắt đầu</Label>
                <Input
                  id="start_date"
                  name="start_date"
                  type="date"
                  defaultValue={batch?.start_date ?? ""}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="end_date">Ngày kết thúc</Label>
                <Input
                  id="end_date"
                  name="end_date"
                  type="date"
                  defaultValue={batch?.end_date ?? ""}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="max_interns">SL tối đa</Label>
                <Input
                  id="max_interns"
                  name="max_interns"
                  type="number"
                  min={1}
                  defaultValue={batch?.max_interns ?? ""}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="location">Địa điểm</Label>
                <Input id="location" name="location" defaultValue={batch?.location ?? ""} />
              </div>
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