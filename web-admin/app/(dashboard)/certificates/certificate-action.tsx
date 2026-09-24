"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Award, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { setCertificateStatus } from "./certificate-actions";

export function CertificateAction({
  id,
  status,
  canManage,
}: {
  id: string;
  status: string;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!canManage) return null;
  if (status === "issued" || status === "revoked") {
    if (status === "issued") {
      return (
        <Button
          size="xs"
          variant="outline"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const { error } = await setCertificateStatus(id, "revoked");
              if (error) toast.error(error);
              else {
                toast.success("Đã thu hồi chứng nhận.");
                router.refresh();
              }
            });
          }}
        >
          <RotateCcw className="size-3.5" />
          Thu hồi
        </Button>
      );
    }
    return null;
  }
  return (
    <Button
      size="xs"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const { error } = await setCertificateStatus(id, "issued");
          if (error) toast.error(error);
          else {
            toast.success("Đã cấp chứng nhận.");
            router.refresh();
          }
        });
      }}
    >
      <Award className="size-3.5" />
      Cấp chứng nhận
    </Button>
  );
}