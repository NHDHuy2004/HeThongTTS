"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Mail, PlayCircle, RefreshCcw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { activateInternshipAction, cancelOnboardingAction, completeOnboardingAction, reopenOnboardingAction, sendOnboardingInviteAction } from "./actions";
import type { OnboardingDetail } from "./types";

export function OnboardingRecordActions({ detail }: { detail: OnboardingDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function run(key: string, operation: () => Promise<{ error?: string; success?: string }>) {
    setBusy(key);
    startTransition(async () => {
      const result = await operation();
      setBusy(null);
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.success ?? "Đã cập nhật hồ sơ.");
        router.refresh();
      }
    });
  }

  function complete() {
    if (!window.confirm("Xác nhận checklist và tài liệu bắt buộc đã đủ điều kiện và hoàn tất onboarding?")) return;
    run("complete", () => completeOnboardingAction(detail.id));
  }

  function cancel() {
    const reason = window.prompt("Lý do hủy hồ sơ onboarding:");
    if (!reason) return;
    run("cancel", () => cancelOnboardingAction(detail.id, reason));
  }

  function reopen() {
    const reason = window.prompt("Lý do mở lại hồ sơ onboarding:");
    if (!reason) return;
    run("reopen", () => reopenOnboardingAction(detail.id, reason));
  }

  function activate() {
    if (!window.confirm("Chuyển thực tập sinh sang kỳ thực tập chính thức?")) return;
    run("activate", () => activateInternshipAction(detail.id, detail.internship_id));
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={pending || busy !== null} onClick={() => run("email", () => sendOnboardingInviteAction(detail.id))}>
        <Mail />Gửi email
      </Button>
      {detail.status === "pending_review" && detail.progress.can_complete ? (
        <Button onClick={complete} disabled={pending || busy !== null}>
          <CheckCircle2 />Xác nhận hoàn tất
        </Button>
      ) : null}
      {detail.status === "completed" && detail.internship_status === "upcoming" ? (
        <Button onClick={activate} disabled={pending || busy !== null}>
          <PlayCircle />Bắt đầu kỳ thực tập
        </Button>
      ) : null}
      {["completed", "cancelled"].includes(detail.status) ? (
        <Button variant="outline" onClick={reopen} disabled={pending || busy !== null}>
          <RefreshCcw />Mở lại
        </Button>
      ) : null}
      {!["completed", "cancelled"].includes(detail.status) ? (
        <Button variant="destructive" onClick={cancel} disabled={pending || busy !== null}>
          <XCircle />Hủy hồ sơ
        </Button>
      ) : null}
    </div>
  );
}
