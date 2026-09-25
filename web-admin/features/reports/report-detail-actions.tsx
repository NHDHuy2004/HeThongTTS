"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createReportClientSubmit,
  reviewReportAction,
  type ReportActionState,
} from "./actions";

const REVIEWABLE = new Set(["submitted", "in_review"]);
const SUBMITTABLE = new Set(["draft", "needs_revision"]);
const CANCELLABLE = new Set(["draft", "submitted", "in_review", "needs_revision"]);

export function ReportDetailActions({
  reportId,
  status,
  mode,
}: {
  reportId: string;
  status: string;
  mode: "mine" | "review";
}) {
  const [comment, setComment] = React.useState("");

  const [submitState, submitFormAction, submitPending] = useActionState<
    ReportActionState,
    FormData
  >(
    async (previous, formData) => {
      const result = await createReportClientSubmit(previous, formData);
      if (result.error) {
        toast.error(result.error);
        return result;
      }
      toast.success(result.success ?? "Đã nộp báo cáo.");
      return result;
    },
    {},
  );

  const [reviewState, reviewFormAction, reviewPending] = useActionState<
    ReportActionState,
    FormData
  >(
    async (previous, formData) => {
      const result = await reviewReportAction(previous, formData);
      if (result.error) {
        toast.error(result.error);
        return result;
      }
      toast.success(result.success ?? "Đã cập nhật báo cáo.");
      setComment("");
      return result;
    },
    {},
  );

  function runReview(action: string, opts?: { requireComment?: boolean; confirm?: string }) {
    const trimmed = comment.trim();
    if (opts?.requireComment && trimmed.length < 5) {
      toast.error("Vui lòng nhập lý do / nội dung (tối thiểu 5 ký tự).");
      return;
    }
    if (opts?.confirm && !window.confirm(opts.confirm)) return;

    const formData = new FormData();
    formData.set("report_id", reportId);
    formData.set("action", action);
    formData.set("comment", trimmed);
    reviewFormAction(formData);
  }

  function runSubmit() {
    if (!window.confirm("Xác nhận nộp báo cáo cho mentor xét duyệt?")) return;
    const formData = new FormData();
    formData.set("report_id", reportId);
    submitFormAction(formData);
  }

  if (mode === "mine") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">Thao tác với báo cáo</h3>
        {submitState.error ? (
          <p className="text-sm text-destructive">{submitState.error}</p>
        ) : null}
        {reviewState.error ? (
          <p className="text-sm text-destructive">{reviewState.error}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {SUBMITTABLE.has(status) ? (
            <Button size="sm" disabled={submitPending} onClick={runSubmit}>
              {submitPending ? "Đang nộp..." : "Nộp báo cáo"}
            </Button>
          ) : null}
          {CANCELLABLE.has(status) && status !== "draft" ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={reviewPending}
              onClick={() => runReview("cancel", { confirm: "Hủy báo cáo này?" })}
            >
              Hủy báo cáo
            </Button>
          ) : null}
        </div>
        {!SUBMITTABLE.has(status) && !CANCELLABLE.has(status) ? (
          <p className="text-sm text-muted-foreground">
            Báo cáo đã được xử lý — không thể thay đổi nữa.
          </p>
        ) : null}
        {status === "draft" ? (
          <p className="text-xs text-muted-foreground">
            Đây là bản nháp — chưa được tính là đã nộp.
          </p>
        ) : null}
      </div>
    );
  }

  if (!REVIEWABLE.has(status)) {
    return (
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Báo cáo không ở trạng thái chờ xét duyệt.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Xét duyệt báo cáo</h3>
      {reviewState.error ? (
        <p className="text-sm text-destructive">{reviewState.error}</p>
      ) : null}
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Nhận xét / lý do từ chối / nội dung cần chỉnh sửa (bắt buộc với từ chối và yêu cầu chỉnh sửa)"
        rows={3}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={reviewPending || status !== "submitted"}
          onClick={() => runReview("take")}
        >
          Tiếp nhận
        </Button>
        <Button
          size="sm"
          disabled={reviewPending}
          onClick={() => runReview("approve", { confirm: "Phê duyệt báo cáo này?" })}
        >
          Phê duyệt
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={reviewPending}
          onClick={() => runReview("request_revision", { requireComment: true })}
        >
          Yêu cầu chỉnh sửa
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={reviewPending}
          onClick={() => runReview("reject", { requireComment: true, confirm: "Từ chối báo cáo này?" })}
        >
          Từ chối
        </Button>
      </div>
    </div>
  );
}
