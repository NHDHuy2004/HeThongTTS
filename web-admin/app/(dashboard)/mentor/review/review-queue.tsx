"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Eye, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { useConfirm, usePrompt } from "@/components/confirm-dialog";
import {
  formatDate,
  formatDateTime,
  requestTypeLabel,
  reportTypeLabel,
} from "@/features/labels";
import {
  reviewReportAction,
  type ReportActionState,
} from "@/features/reports/actions";
import {
  reviewRequestAction,
  type RequestActionState,
} from "@/features/requests/actions";

export type ReviewReportItem = {
  id: string;
  report_code: string;
  title: string | null;
  report_type: string;
  status: string;
  period_start: string;
  period_end: string;
  due_date: string | null;
  submitted_at: string | null;
  intern_name: string | null;
};

export type ReviewRequestItem = {
  id: string;
  request_code: string;
  title: string;
  request_type: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  submitted_at: string | null;
  intern_name: string | null;
};

/**
 * Hàng đợi duyệt của mentor: gộp báo cáo + đơn từ đang chờ vào một trang,
 * duyệt nhanh không cần mở từng chi tiết.
 */
export function ReviewQueue({
  reports,
  requests,
}: {
  reports: ReviewReportItem[];
  requests: ReviewRequestItem[];
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">Báo cáo ({reports.length})</TabsTrigger>
          <TabsTrigger value="requests">Đơn từ ({requests.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="reports" className="mt-4">
          {reports.length === 0 ? (
            <EmptyQueue label="Không có báo cáo nào đang chờ duyệt." />
          ) : (
            <div className="flex flex-col gap-3">
              {reports.map((r) => (
                <ReportReviewCard key={r.id} item={r} overdue={r.due_date != null && r.due_date < today} />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="requests" className="mt-4">
          {requests.length === 0 ? (
            <EmptyQueue label="Không có đơn từ nào đang chờ duyệt." />
          ) : (
            <div className="flex flex-col gap-3">
              {requests.map((r) => (
                <RequestReviewCard key={r.id} item={r} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyQueue({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function useReviewRunner(run: (fd: FormData) => Promise<ReportActionState | RequestActionState>) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function act(id: string, action: string, comment?: string) {
    setPendingId(id);
    const fd = new FormData();
    // Cả 2 action đều đọc cùng field "report_id"/"request_id" — truyền cả hai cho chắc.
    fd.set("report_id", id);
    fd.set("request_id", id);
    fd.set("action", action);
    fd.set("comment", comment ?? "");
    const res = await run(fd);
    setPendingId(null);
    if (res.error) toast.error(res.error);
    else {
      toast.success(res.success ?? "Đã cập nhật.");
      router.refresh();
    }
  }

  return { act, pendingId };
}

function ReportReviewCard({ item, overdue }: { item: ReviewReportItem; overdue: boolean }) {
  const [confirm, confirmDialog] = useConfirm();
  const [prompt, promptDialog] = usePrompt();
  const { act, pendingId } = useReviewRunner((fd) => reviewReportAction({}, fd));
  const busy = pendingId === item.id;

  async function approve() {
    const ok = await confirm({
      title: "Phê duyệt báo cáo",
      description: `Phê duyệt báo cáo ${item.report_code}?`,
      confirmLabel: "Phê duyệt",
    });
    if (ok) await act(item.id, "approve");
  }

  async function requestRevision() {
    const note = await prompt({
      title: "Yêu cầu chỉnh sửa",
      description: "Nhập nội dung cần báo cáo viên chỉnh sửa (tối thiểu 5 ký tự).",
      confirmLabel: "Gửi yêu cầu",
      minLength: 5,
    });
    if (note != null) await act(item.id, "request_revision", note);
  }

  async function reject() {
    const reason = await prompt({
      title: "Từ chối báo cáo",
      description: "Nhập lý do từ chối (tối thiểu 5 ký tự).",
      confirmLabel: "Từ chối",
      minLength: 5,
    });
    if (reason != null) await act(item.id, "reject", reason);
  }

  return (
    <>
      {confirmDialog}
      {promptDialog}
      <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{item.report_code}</span>
            <StatusBadge value={item.status} />
            {overdue ? (
              <span className="text-xs font-medium text-destructive">Quá hạn</span>
            ) : null}
          </div>
          <p className="truncate text-sm font-medium">
            {item.title ?? reportTypeLabel[item.report_type] ?? item.report_type}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.intern_name ?? "—"} · {reportTypeLabel[item.report_type] ?? item.report_type} · Kỳ{" "}
            {formatDate(item.period_start)}
            {item.period_end !== item.period_start ? ` – ${formatDate(item.period_end)}` : ""}
            {item.submitted_at ? ` · Nộp ${formatDateTime(item.submitted_at)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={approve}>
            <Check />
            Phê duyệt
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={requestRevision}>
            <RotateCcw />
            Cần sửa
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            className="text-destructive hover:text-destructive"
            onClick={reject}
          >
            <X />
            Từ chối
          </Button>
          <Button size="sm" variant="ghost" render={<Link href={`/admin/reports/${item.id}`} />}>
            <Eye />
            Chi tiết
          </Button>
        </div>
      </CardContent>
      </Card>
    </>
  );
}

function RequestReviewCard({ item }: { item: ReviewRequestItem }) {
  const [confirm, confirmDialog] = useConfirm();
  const [prompt, promptDialog] = usePrompt();
  const { act, pendingId } = useReviewRunner((fd) => reviewRequestAction({}, fd));
  const busy = pendingId === item.id;

  async function approve() {
    const ok = await confirm({
      title: "Phê duyệt đơn",
      description: `Phê duyệt đơn ${item.request_code}?`,
      confirmLabel: "Phê duyệt",
    });
    if (ok) await act(item.id, "approve");
  }

  async function requestRevision() {
    const note = await prompt({
      title: "Yêu cầu bổ sung",
      description: "Nhập nội dung cần bổ sung (tối thiểu 5 ký tự).",
      confirmLabel: "Gửi yêu cầu",
      minLength: 5,
    });
    if (note != null) await act(item.id, "request_revision", note);
  }

  async function reject() {
    const reason = await prompt({
      title: "Từ chối đơn",
      description: "Nhập lý do từ chối (tối thiểu 5 ký tự).",
      confirmLabel: "Từ chối",
      minLength: 5,
    });
    if (reason != null) await act(item.id, "reject", reason);
  }

  return (
    <>
      {confirmDialog}
      {promptDialog}
      <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{item.request_code}</span>
            <StatusBadge value={item.status} />
          </div>
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {item.intern_name ?? "—"} · {requestTypeLabel[item.request_type] ?? item.request_type} ·{" "}
            {item.start_date
              ? `${formatDate(item.start_date)}${item.end_date && item.end_date !== item.start_date ? ` – ${formatDate(item.end_date)}` : ""}`
              : "—"}
            {item.submitted_at ? ` · Nộp ${formatDateTime(item.submitted_at)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={approve}>
            <Check />
            Phê duyệt
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={requestRevision}>
            <RotateCcw />
            Bổ sung
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            className="text-destructive hover:text-destructive"
            onClick={reject}
          >
            <X />
            Từ chối
          </Button>
          <Button size="sm" variant="ghost" render={<Link href={`/admin/requests/${item.id}`} />}>
            <Eye />
            Chi tiết
          </Button>
        </div>
      </CardContent>
      </Card>
    </>
  );
}
