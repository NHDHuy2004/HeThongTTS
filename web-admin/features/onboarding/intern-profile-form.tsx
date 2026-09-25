"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserRoundPen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { InternsRow } from "@/types/database";
import { updateInternOnboardingProfileAction } from "./actions";
import type { ActionState } from "./types";

export function InternOnboardingProfileForm({ intern }: { intern: InternsRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await updateInternOnboardingProfileAction(previous, formData);
    if (result.error) toast.error(result.error);
    else {
      toast.success(result.success ?? "Đã cập nhật thông tin.");
      setOpen(false);
      router.refresh();
    }
    return result;
  }, {});

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><UserRoundPen />Cập nhật thông tin</Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Thông tin liên hệ</SheetTitle>
            <SheetDescription>Chỉ cập nhật các trường HR cho phép trong quá trình onboarding.</SheetDescription>
          </SheetHeader>
          <form action={formAction} className="flex flex-col gap-4 px-4 pb-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-name">Họ và tên</Label>
              <Input id="profile-name" name="full_name" defaultValue={intern.full_name} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-phone">Số điện thoại</Label>
                <Input id="profile-phone" name="phone" defaultValue={intern.phone ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-emergency-name">Người liên hệ khẩn cấp</Label>
                <Input id="profile-emergency-name" name="emergency_contact_name" defaultValue={intern.emergency_contact_name ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-emergency-phone">SĐT khẩn cấp</Label>
                <Input id="profile-emergency-phone" name="emergency_contact_phone" defaultValue={intern.emergency_contact_phone ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-emergency-email">Email khẩn cấp</Label>
                <Input id="profile-emergency-email" name="emergency_contact_email" type="email" defaultValue={intern.emergency_contact_email ?? ""} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-address">Địa chỉ</Label>
              <Textarea id="profile-address" name="address" defaultValue={intern.address ?? ""} />
            </div>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <SheetFooter><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Lưu thông tin"}</Button></SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
