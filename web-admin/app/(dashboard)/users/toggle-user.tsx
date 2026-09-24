"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toggleUserActive } from "./actions";

export function ToggleUser({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="xs"
      variant={active ? "outline" : "default"}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const { error } = await toggleUserActive(id, !active);
          if (error) toast.error(error);
          else {
            toast.success(active ? "Đã vô hiệu hóa tài khoản." : "Đã kích hoạt tài khoản.");
            router.refresh();
          }
        });
      }}
    >
      {active ? "Vô hiệu" : "Kích hoạt"}
    </Button>
  );
}