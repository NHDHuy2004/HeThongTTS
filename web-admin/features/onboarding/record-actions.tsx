"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Mail, PlayCircle, RefreshCcw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useConfirm, usePrompt } from "@/components/confirm-dialog";
import { activateInternshipAction, cancelOnboardingAction, completeOnboardingAction, reopenOnboardingAction, sendOnboardingInviteAction } from "./actions";
import type { OnboardingDetail } from "./types";

export function OnboardingRecordActions({ detail }: { detail: OnboardingDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const [prompt, promptDialog] = usePrompt();

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

  async function complete() {
    const ok = await confirm({
      title: "Hoàn tất onboarding?",
      description:
        "Xác nhận checklist và tài liệu bắt buộc đã đủ điều kiện và hoàn tất hồ sơ.",
      confirmLabel: "Hoàn tất",
    });
    if (!ok) return;
    run("complete", () => completeOnboardingAction(detail.id));
  }

  async function cancel() {
    const reason = await prompt({
      title: "Hủy hồ sơ onboarding",
      label: "Lý do hủy",
      placeholder: "Nhập lý do hủy hồ sơ...",
      minLength: 5,
      confirmLabel: "Hủy hồ sơ",
    });
    if (!reason) return;
    run("cancel", () => cancelOnboardingAction(detail.id, reason));
  }

  async function reopen() {
    const reason = await prompt({
      title: "Mở lại hồ sơ onboarding",
      label: "Lý do mở lại",
      placeholder: "Nhập lý do mở lại hồ sơ...",
      minLength: 5,
      confirmLabel: "Mở lại",
    });
    if (!reason) return;
    run("reopen", () => reopenOnboardingAction(detail.id, reason));
  }

  async function activate() {
    const ok = await confirm({
      title: "Bắt đầu kỳ thực tập?",
      description: "Chuyển thực tập sinh sang kỳ thực tập chính thức.",
      confirmLabel: "Bắt đầu",
    });
    if (!ok) return;
    run("activate", () => activateInternshipAction(detail.id, detail.internship_id));
  }

  return (
    <>
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
      {confirmDialog}
      {promptDialog}
    </>
  );
}
