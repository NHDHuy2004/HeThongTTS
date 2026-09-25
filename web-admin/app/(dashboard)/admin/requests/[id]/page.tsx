import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Paperclip } from "lucide-react";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  formatDate,
  formatDateTime,
  requestActionLabel,
  requestTypeLabel,
} from "@/features/labels";
import { RequestDetailActions } from "@/features/requests/request-detail-actions";
import type {
  RequestApprovalLogsRow,
  RequestAttachmentsRow,
  RequestsRow,
} from "@/types/database";

type RequestAttachmentRow = RequestAttachmentsRow;
type RequestLogRow = RequestApprovalLogsRow & { profiles: { full_name: string } | null };

type RequestDetail = RequestsRow & {
  interns: { full_name: string; student_code: string | null } | null;
  profiles: { full_name: string } | null;
  request_attachments: RequestAttachmentRow[];
  request_approval_logs: RequestLogRow[];
};

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  if (role !== "admin" && role !== "hr" && role !== "mentor") {
    notFound();
  }

  const supabase = await createClient();

  const { data } = await supabase
    .from("requests")
    .select(
      `*,
       interns(full_name, student_code),
       profiles!requests_reviewer_id_fkey(full_name),
       request_attachments(*),
       request_approval_logs(*, profiles(full_name))`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const request = data as RequestDetail;

  const attachmentUrls = await Promise.all(
    (request.request_attachments ?? []).map(async (a) => {
      const { data: signed } = await supabase.storage
        .from("request-attachments")
        .createSignedUrl(a.file_path, 3600);
      return { ...a, url: signed?.signedUrl ?? null };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Đơn ${request.request_code}`}
        description={
          request.interns
            ? `${request.interns.full_name}${request.interns.student_code ? ` · ${request.interns.student_code}` : ""} — ${request.title}`
            : request.title
        }
        actions={
          <Link
            href="/admin/requests"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
          >
            <ArrowLeft className="size-4" />
            Quay lại
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
          <span className="text-muted-foreground">Trạng thái</span>
          <StatusBadge value={request.status} />
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
          <span className="text-muted-foreground">Loại đơn</span>
          <span className="font-medium">
            {requestTypeLabel[request.request_type] ?? request.request_type}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
          <span className="text-muted-foreground">Thời gian áp dụng</span>
          <span className="font-medium">
            {request.start_date ? formatDate(request.start_date) : "—"}
            {request.end_date && request.end_date !== request.start_date
              ? ` – ${formatDate(request.end_date)}`
              : ""}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
          <span className="text-muted-foreground">Nộp lúc</span>
          <span className="font-medium">{formatDateTime(request.submitted_at)}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
          <span className="text-muted-foreground">Người xét duyệt</span>
          <span className="font-medium">
            {request.profiles?.full_name ?? "Chưa phân công"}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-4 text-sm">
          <span className="text-muted-foreground">Kết quả lúc</span>
          <span className="font-medium">
            {request.reviewed_at ? formatDateTime(request.reviewed_at) : "—"}
          </span>
        </div>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Nội dung đơn</h2>
        <div className="text-sm">
          <span className="text-muted-foreground">Lý do: </span>
          {request.reason}
        </div>
        {request.description ? (
          <div className="text-sm">
            <span className="text-muted-foreground">Mô tả: </span>
            {request.description}
          </div>
        ) : null}
        {request.rejection_reason ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
            <span className="font-medium">Lý do từ chối: </span>
            {request.rejection_reason}
          </div>
        ) : null}
        {request.revision_note ? (
          <div className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm">
            <span className="font-medium">Cần bổ sung: </span>
            {request.revision_note}
          </div>
        ) : null}
        {request.review_comment ? (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Ghi chú duyệt: </span>
            {request.review_comment}
          </div>
        ) : null}
      </section>

      <RequestDetailActions
        requestId={request.id}
        status={request.status}
        mode="review"
      />

      {attachmentUrls.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-lg border p-4">
          <h2 className="text-sm font-semibold">Tài liệu đính kèm</h2>
          <ul className="flex flex-col gap-1">
            {attachmentUrls.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {a.file_name}
                  </a>
                ) : (
                  <span>{a.file_name}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-2 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Lịch sử xử lý</h2>
        <ul className="flex flex-col gap-2">
          {(request.request_approval_logs ?? [])
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map((log) => (
              <li key={log.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {formatDateTime(log.created_at)}
                </span>
                <span className="font-medium">
                  {requestActionLabel[log.action] ?? log.action}
                </span>
                <span className="text-muted-foreground">
                  {log.profiles?.full_name ?? "Hệ thống"}
                </span>
                {log.new_status ? <StatusBadge value={log.new_status} /> : null}
                {log.comment ? (
                  <span className="text-muted-foreground">— {log.comment}</span>
                ) : null}
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
