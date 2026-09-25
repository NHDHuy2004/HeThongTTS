"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin, Pencil } from "lucide-react";

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
import type { AttendanceLocationsRow } from "@/types/database";
import { LocationMapPicker } from "./location-map-picker";

export type LocationOption = { id: string; name: string };

const DEFAULT_LAT = 11.9404;
const DEFAULT_LNG = 108.4583;

type FormState = {
  code: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  min_accuracy_meters: number;
  check_in_start_time: string;
  check_in_end_time: string;
  check_out_start_time: string;
  check_out_end_time: string;
  department_id: string;
  internship_batch_id: string;
  is_active: boolean;
};

function fromRow(row?: AttendanceLocationsRow | null): FormState {
  return {
    code: row?.code ?? "",
    name: row?.name ?? "",
    address: row?.address ?? "",
    latitude: row?.latitude ?? DEFAULT_LAT,
    longitude: row?.longitude ?? DEFAULT_LNG,
    radius_m: row?.radius_m ?? 100,
    min_accuracy_meters: row?.min_accuracy_meters ?? 100,
    check_in_start_time: row?.check_in_start_time?.slice(0, 5) ?? "",
    check_in_end_time: row?.check_in_end_time?.slice(0, 5) ?? "",
    check_out_start_time: row?.check_out_start_time?.slice(0, 5) ?? "",
    check_out_end_time: row?.check_out_end_time?.slice(0, 5) ?? "",
    department_id: row?.department_id ?? "",
    internship_batch_id: row?.internship_batch_id ?? "",
    is_active: row?.is_active ?? true,
  };
}

function timeOrNull(value: string): string | null {
  return value.trim() ? value : null;
}

export function WorkLocationForm({
  location,
  departments,
  batches,
}: {
  location?: AttendanceLocationsRow;
  departments: LocationOption[];
  batches: LocationOption[];
}) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const editing = Boolean(location);
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(() => fromRow(location));

  function openForm(next: boolean) {
    if (next) setForm(fromRow(location));
    setOpen(next);
  }

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Vui lòng nhập tên địa điểm.");
      return;
    }
    if (form.latitude < -90 || form.latitude > 90 || form.longitude < -180 || form.longitude > 180) {
      toast.error("Tọa độ GPS không hợp lệ.");
      return;
    }
    if (form.radius_m <= 0) {
      toast.error("Bán kính điểm danh phải lớn hơn 0.");
      return;
    }

    const payload = {
      code: form.code.trim() || null,
      name: form.name.trim(),
      address: form.address.trim() || null,
      latitude: form.latitude,
      longitude: form.longitude,
      radius_m: form.radius_m,
      min_accuracy_meters: form.min_accuracy_meters,
      check_in_start_time: timeOrNull(form.check_in_start_time),
      check_in_end_time: timeOrNull(form.check_in_end_time),
      check_out_start_time: timeOrNull(form.check_out_start_time),
      check_out_end_time: timeOrNull(form.check_out_end_time),
      department_id: form.department_id || null,
      internship_batch_id: form.internship_batch_id || null,
      is_active: form.is_active,
    };

    setPending(true);
    const { error } = editing
      ? await supabase.from("attendance_locations").update(payload).eq("id", location!.id)
      : await supabase.from("attendance_locations").insert(payload);
    setPending(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("Mã địa điểm đã tồn tại.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success(editing ? "Đã cập nhật địa điểm." : "Đã tạo địa điểm.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {editing ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openForm(true)}
          aria-label={`Sửa ${location!.name}`}
        >
          <Pencil /> Sửa
        </Button>
      ) : (
        <Button onClick={() => openForm(true)}>
          <MapPin /> Thêm địa điểm
        </Button>
      )}
      <Sheet open={open} onOpenChange={openForm}>
        <SheetContent className="w-full max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Sửa địa điểm" : "Thêm địa điểm làm việc"}</SheetTitle>
            <SheetDescription>
              Địa điểm có tọa độ GPS và bán kính điểm danh. Thực tập sinh chỉ điểm
              danh được khi ở trong bán kính cho phép.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-4 px-4 pb-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="wl-name">Tên địa điểm</Label>
                <Input
                  id="wl-name"
                  value={form.name}
                  onChange={(e) => patch("name", e.target.value)}
                  placeholder="Văn phòng công ty"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="wl-code">Mã địa điểm</Label>
                <Input
                  id="wl-code"
                  value={form.code}
                  onChange={(e) => patch("code", e.target.value)}
                  placeholder="HQ-01"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="wl-address">Địa chỉ</Label>
              <Input
                id="wl-address"
                value={form.address}
                onChange={(e) => patch("address", e.target.value)}
                placeholder="Địa chỉ văn phòng thực tế"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="wl-lat">Vĩ độ (latitude)</Label>
                <Input
                  id="wl-lat"
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => patch("latitude", Number(e.target.value))}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="wl-lng">Kinh độ (longitude)</Label>
                <Input
                  id="wl-lng"
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => patch("longitude", Number(e.target.value))}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="wl-radius">Bán kính (m)</Label>
                <Input
                  id="wl-radius"
                  type="number"
                  min={1}
                  value={form.radius_m}
                  onChange={(e) => patch("radius_m", Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <LocationMapPicker
              latitude={form.latitude}
              longitude={form.longitude}
              radiusMeters={form.radius_m}
              onChange={(lat, lng) =>
                setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))
              }
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="wl-acc">Ngưỡng GPS chính xác (m)</Label>
                <Input
                  id="wl-acc"
                  type="number"
                  min={1}
                  value={form.min_accuracy_meters}
                  onChange={(e) => patch("min_accuracy_meters", Number(e.target.value))}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="wl-in-start">Giờ bắt đầu check-in</Label>
                <Input
                  id="wl-in-start"
                  type="time"
                  value={form.check_in_start_time}
                  onChange={(e) => patch("check_in_start_time", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="wl-in-end">Hạn chót check-in</Label>
                <Input
                  id="wl-in-end"
                  type="time"
                  value={form.check_in_end_time}
                  onChange={(e) => patch("check_in_end_time", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="wl-out-start">Giờ chuẩn check-out</Label>
                <Input
                  id="wl-out-start"
                  type="time"
                  value={form.check_out_start_time}
                  onChange={(e) => patch("check_out_start_time", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="wl-out-end">Hạn chót check-out</Label>
                <Input
                  id="wl-out-end"
                  type="time"
                  value={form.check_out_end_time}
                  onChange={(e) => patch("check_out_end_time", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="wl-dept">Phòng ban áp dụng</Label>
                <select
                  id="wl-dept"
                  value={form.department_id}
                  onChange={(e) => patch("department_id", e.target.value)}
                  className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                >
                  <option value="">Tất cả phòng ban</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="wl-batch">Đợt thực tập áp dụng</Label>
                <select
                  id="wl-batch"
                  value={form.internship_batch_id}
                  onChange={(e) => patch("internship_batch_id", e.target.value)}
                  className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                >
                  <option value="">Tất cả đợt thực tập</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => patch("is_active", e.target.checked)}
                className="size-4 accent-emerald-600"
              />
              Địa điểm đang hoạt động
            </label>

            <SheetFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Đang lưu..." : editing ? "Cập nhật" : "Tạo địa điểm"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function ToggleWorkLocation({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [pending, setPending] = React.useState(false);

  async function toggle() {
    setPending(true);
    const { error } = await supabase
      .from("attendance_locations")
      .update({ is_active: !isActive })
      .eq("id", id);
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isActive ? "Đã vô hiệu hóa địa điểm." : "Đã kích hoạt địa điểm.");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} disabled={pending}>
      {isActive ? "Vô hiệu" : "Kích hoạt"}
    </Button>
  );
}

export function DeleteWorkLocation({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [pending, setPending] = React.useState(false);

  async function remove() {
    if (!window.confirm(`Xóa địa điểm "${name}"? Hành động này không thể hoàn tác.`)) return;
    setPending(true);
    const { error } = await supabase.from("attendance_locations").delete().eq("id", id);
    setPending(false);
    if (error) {
      toast.error(
        error.code === "23503"
          ? "Địa điểm đang được dùng cho bản ghi điểm danh — hãy vô hiệu hóa thay vì xóa."
          : error.message,
      );
      return;
    }
    toast.success("Đã xóa địa điểm.");
    router.refresh();
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={remove}
      disabled={pending}
      aria-label={`Xóa ${name}`}
    >
      Xóa
    </Button>
  );
}
