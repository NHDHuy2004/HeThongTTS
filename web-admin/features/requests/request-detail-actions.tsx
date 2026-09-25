"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reviewRequestAction, type RequestActionState } from "./actions";

const REVIEWABLE = new Set(["pending", "in_review"]);
const CANCELLABLE = new Set(["pending", "in_review", "needs_revision"]);

export function RequestDetailActions({
  requestId,
  status,
  mode,
}: {
  requestId: string;
  status: string;
  mode: "mine" | "review";
}) {
  const [comment, setComment] = React.useState("");

  const [state, formAction, pending] = useActionState<RequestActionState, FormData>(
    async (previous, formData) => {
      const result = await reviewRequestAction(previous, formData);
      if (result.error) {
        toast.error(result.error);
        return result;
      }
      toast.success(result.success ?? "Đã cập nhật đơn.");
      setComment("");
      return result;
    },
    {},
  );

  function run(action: string, opts?: { requireComment?: boolean; confirm?: string }) {
    const trimmed = comment.trim();
    if (opts?.requireComment && trimmed.length < 5) {
      toast.error("Vui lòng nhập lý do / nội dung (tối thiểu 5 ký tự).");
      return;
    }
    if (opts?.confirm && !window.confirm(opts.confirm)) return;

    const formData = new FormData();
    formData.set("request_id", requestId);
    formData.set("action", action);
    formData.set("comment", trimmed);
    formAction(formData);
  }

  if (mode === "review") {
    if (!REVIEWABLE.has(status)) {
      return (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Đơn đã được xử lý — không thể thay đổi nữa.
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">Xét duyệt đơn</h3>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Lý do từ chối / nội dung cần bổ sung (bắt buộc với 2 hành động này)"
          rows={2}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pending || status !== "pending"}
            onClick={() => run("take")}
          >
            Tiếp nhận
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run("approve", { confirm: "Phê duyệt đơn này? Attendance sẽ được cập nhật tương ứng." })}
          >
            Duyệt
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => run("reject", { requireComment: true })}
          >
            Từ chối
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => run("request_revision", { requireComment: true })}
          >
            Yêu cầu bổ sung
          </Button>
        </div>
        {state.error ? (
          <p role="alert" className="text-sm text-destructive">{state.error}</p>
        ) : null}
      </div>
    );
  }

  // mode === "mine" — intern
  const canCancel = CANCELLABLE.has(status);
  const canResubmit = status === "needs_revision";
  if (!canCancel && !canResubmit) {
    return (
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Đơn đã hoàn tất xử lý — bạn không thể thay đổi.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Thao tác với đơn của bạn</h3>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Nội dung bổ sung khi gửi lại (tùy chọn)"
        rows={2}
      />
      <div className="flex flex-wrap gap-2">
        {canResubmit ? (
          <Button size="sm" disabled={pending} onClick={() => run("resubmit")}>
            Gửi lại đơn
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              run("cancel", { confirm: "Hủy đơn này? Hành động không thể hoàn tác." })
            }
          >
            Hủy đơn
          </Button>
        ) : null}
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}
    </div>
  );
}
