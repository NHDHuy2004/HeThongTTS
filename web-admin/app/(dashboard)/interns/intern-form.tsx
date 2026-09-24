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
import { createIntern, type InternFormState } from "./actions";

type Option = { id: string; name: string };

const initialState: InternFormState = {};

export function InternForm({
  batches,
  departments,
  mentors,
}: {
  batches: Option[];
  departments: Option[];
  mentors: Option[];
}) {
  const [open, setOpen] = React.useState(false);
  const [createAccount, setCreateAccount] = React.useState(false);
  const router = useRouter();

  const [state, formAction, pending] = useActionState(
    async (prev: InternFormState, formData: FormData) => {
      const result = await createIntern(prev, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Đã tạo thực tập sinh.");
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
        Thêm thực tập sinh
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Thêm thực tập sinh</SheetTitle>
            <SheetDescription>
              Tạo hồ sơ mới, có thể kèm tài khoản đăng nhập.
            </SheetDescription>
          </SheetHeader>
          <form action={formAction} className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="student_code">Mã sinh viên</Label>
                <Input id="student_code" name="student_code" placeholder="SV-2026-0002" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="full_name">Họ tên</Label>
                <Input id="full_name" name="full_name" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">SĐT</Label>
                <Input id="phone" name="phone" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="school">Trường</Label>
                <Input id="school" name="school" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="major">Ngành</Label>
                <Input id="major" name="major" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="class_name">Lớp</Label>
                <Input id="class_name" name="class_name" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="gender">Giới tính</Label>
                <select
                  id="gender"
                  name="gender"
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">—</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="birth_date">Ngày sinh</Label>
                <Input id="birth_date" name="birth_date" type="date" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="status">Trạng thái</Label>
                <select
                  id="status"
                  name="status"
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
                  defaultValue="pending"
                >
                  <option value="pending">Chờ xử lý</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="active">Đang hoạt động</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="address">Địa chỉ</Label>
              <Input id="address" name="address" />
            </div>

            <SeparatorV />

            <div className="flex flex-col gap-2">
              <Label htmlFor="batch_id">Đợt thực tập</Label>
              <select
                id="batch_id"
                name="batch_id"
                className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="">— Chưa chọn —</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="department_id">Phòng ban</Label>
                <select
                  id="department_id"
                  name="department_id"
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">—</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mentor_id">Mentor</Label>
                <select
                  id="mentor_id"
                  name="mentor_id"
                  className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">—</option>
                  {mentors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <SeparatorV />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="create_account"
                checked={createAccount}
                onChange={(e) => setCreateAccount(e.target.checked)}
              />
              Tạo tài khoản đăng nhập cho intern
            </label>
            {createAccount ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Tối thiểu 6 ký tự"
                  required
                />
              </div>
            ) : null}

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

function SeparatorV() {
  return <div className="h-px bg-border" />;
}