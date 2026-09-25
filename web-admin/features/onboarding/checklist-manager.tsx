"use client";

import * as React from "react";
import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Download, Pencil, Plus, RotateCcw, Send, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, getStatusLabel } from "@/features/labels";
import { ONBOARDING_CATEGORIES, ONBOARDING_CHECKLIST_STATUSES } from "./constants";
import {
  createChecklistItemAction,
  deleteChecklistItemAction,
  getOnboardingDocumentUrl,
  reviewChecklistItemAction,
  submitChecklistItemAction,
  updateChecklistItemAction,
} from "./actions";
import type {
  ActionState,
  NamedOption,
  OnboardingChecklistView,
  OnboardingDetail,
  SelectOption,
} from "./types";

function ChecklistFields({
  profiles,
  documents,
  defaults,
}: {
  profiles: NamedOption[];
  documents: SelectOption[];
  defaults?: OnboardingChecklistView;
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label>Tên công việc</Label>
        <Input name="title" required defaultValue={defaults?.title} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Mô tả</Label>
        <Textarea name="description" defaultValue={defaults?.description ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Nhóm công việc</Label>
          <select name="category" defaultValue={defaults?.category ?? ONBOARDING_CATEGORIES[0]} className="h-8 rounded-lg border bg-background px-2 text-sm">
            {ONBOARDING_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Người phụ trách / thực hiện</Label>
          <select name="assigned_to" defaultValue={defaults?.assigned_to ?? ""} className="h-8 rounded-lg border bg-background px-2 text-sm">
            <option value="">Chưa gán</option>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Ngày bắt đầu</Label>
          <Input name="start_date" type="date" defaultValue={defaults?.start_date ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Hạn hoàn thành</Label>
          <Input name="due_date" type="date" defaultValue={defaults?.due_date ?? ""} />
        </div>
        {defaults ? (
          <div className="flex flex-col gap-2">
            <Label>Trạng thái</Label>
            <select name="status" defaultValue={defaults.status} className="h-8 rounded-lg border bg-background px-2 text-sm">
              {ONBOARDING_CHECKLIST_STATUSES.map((status) => <option key={status} value={status}>{getStatusLabel(status)}</option>)}
            </select>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label>Tài liệu / hướng dẫn</Label>
        <select name="guide_document_id" defaultValue={defaults?.guide_document_id ?? ""} className="h-8 rounded-lg border bg-background px-2 text-sm">
          <option value="">Không đính kèm</option>
          {documents.map((document) => <option key={document.id} value={document.id}>{document.name}</option>)}
        </select>
      </div>
      {defaults ? (
        <div className="flex flex-col gap-2">
          <Label>Phản hồi</Label>
          <Textarea name="feedback" defaultValue={defaults.feedback ?? ""} />
        </div>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="hidden" name="is_required" value="false" />
        <input type="checkbox" name="is_required" value="true" defaultChecked={defaults?.is_required ?? true} />
        Mục bắt buộc
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="hidden" name="review_required" value="false" />
        <input type="checkbox" name="review_required" value="true" defaultChecked={defaults?.review_required ?? true} />
        Cần HR hoặc mentor được giao quyền duyệt
      </label>
    </>
  );
}

function AddChecklistForm({ recordId, profiles, documents, disabled }: {
  recordId: string;
  profiles: NamedOption[];
  documents: SelectOption[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const action = createChecklistItemAction.bind(null, recordId);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await action(previous, formData);
    if (result.error) toast.error(result.error);
    else {
      toast.success(result.success ?? "Đã thêm checklist.");
      setOpen(false);
      router.refresh();
    }
    return result;
  }, {});

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={disabled}><Plus />Thêm công việc</Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>Thêm checklist</SheetTitle><SheetDescription>Tạo công việc riêng cho hồ sơ này.</SheetDescription></SheetHeader>
          <form action={formAction} className="flex flex-col gap-4 px-4 pb-4">
            <ChecklistFields profiles={profiles} documents={documents} />
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <SheetFooter><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Thêm công việc"}</Button></SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function EditChecklistForm({ item, recordId, profiles, documents, disabled }: {
  item: OnboardingChecklistView;
  recordId: string;
  profiles: NamedOption[];
  documents: SelectOption[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const action = updateChecklistItemAction.bind(null, item.id, recordId);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await action(previous, formData);
    if (result.error) toast.error(result.error);
    else {
      toast.success(result.success ?? "Đã cập nhật checklist.");
      setOpen(false);
      router.refresh();
    }
    return result;
  }, {});

  return (
    <>
      <Button size="icon-sm" variant="ghost" onClick={() => setOpen(true)} disabled={disabled} aria-label="Sửa checklist"><Pencil /></Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>Chỉnh sửa checklist</SheetTitle><SheetDescription>Cập nhật nội dung, người phụ trách và thời hạn.</SheetDescription></SheetHeader>
          <form action={formAction} className="flex flex-col gap-4 px-4 pb-4">
            <ChecklistFields profiles={profiles} documents={documents} defaults={item} />
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <SheetFooter><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Lưu"}</Button></SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function ChecklistManager({
  detail,
  profiles,
  documents,
  currentUserId,
  role,
}: {
  detail: OnboardingDetail;
  profiles: NamedOption[];
  documents: SelectOption[];
  currentUserId: string;
  role: "admin" | "hr" | "mentor" | "intern";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canManage = role === "admin" || role === "hr";
  const locked = detail.status === "completed" || detail.status === "cancelled";
  const groups = Array.from(new Set(detail.checklist.map((item) => item.category)));

  function run(operation: () => Promise<{ error?: string; success?: string }>) {
    startTransition(async () => {
      const result = await operation();
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.success ?? "Đã cập nhật.");
        router.refresh();
      }
    });
  }

  async function openGuide(documentId: string) {
    const popup = window.open("about:blank", "_blank");
    const result = await getOnboardingDocumentUrl({ catalogDocumentId: documentId });
    if (result.error) {
      popup?.close();
      toast.error(result.error);
    } else if (result.url && popup) {
      popup.location.href = result.url;
    } else {
      popup?.close();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {canManage ? <div className="flex justify-end"><AddChecklistForm recordId={detail.id} profiles={profiles} documents={documents} disabled={locked} /></div> : null}
      {!detail.checklist.length ? <EmptyState title="Chưa có checklist" description="Thêm công việc thủ công để bắt đầu." /> : null}
      {groups.map((category) => (
        <section key={category} className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b bg-muted/40 px-4 py-3 text-sm font-semibold">{category}</div>
          <div className="divide-y">
            {detail.checklist.filter((item) => item.category === category).map((item) => {
              const canSubmit = (role === "intern" || role === "mentor")
                && [item.assigned_to, item.performer_id].includes(currentUserId);
              const canReview = canManage
                || (role === "mentor" && item.assigned_to === currentUserId && item.performer_id !== currentUserId);
              return (
                <div key={item.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      {item.is_required ? <span className="text-[11px] font-semibold text-red-600">Bắt buộc</span> : <span className="text-[11px] text-muted-foreground">Tùy chọn</span>}
                      <StatusBadge value={item.status} />
                    </div>
                    {item.description ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.description}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Phụ trách: {item.assigned_to_profile?.full_name ?? "Chưa gán"}</span>
                      <span>Hạn: {formatDate(item.due_date)}</span>
                      {item.feedback ? <span className="text-red-600">Phản hồi: {item.feedback}</span> : null}
                    </div>
                    {item.guide_document && (item.guide_document.file_path || item.guide_document.file_url) ? (
                      <Button size="xs" variant="link" className="px-0" onClick={() => openGuide(item.guide_document!.id)}>
                        <Download />{item.guide_document.title}
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    {canSubmit && !["completed", "cancelled", "pending_review"].includes(item.status) ? (
                      <>
                        {item.status === "not_started" ? <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => submitChecklistItemAction(item.id, detail.id, "in_progress"))}>Bắt đầu</Button> : null}
                        {role === "mentor" && !item.review_required ? (
                          <Button size="sm" disabled={pending} onClick={() => run(() => submitChecklistItemAction(item.id, detail.id, "completed"))}><Check />Hoàn thành</Button>
                        ) : (
                          <Button size="sm" disabled={pending} onClick={() => run(() => submitChecklistItemAction(item.id, detail.id, "pending_review"))}><Send />Gửi duyệt</Button>
                        )}
                      </>
                    ) : null}
                    {canSubmit && item.status === "needs_revision" ? (
                      <Button size="sm" disabled={pending} onClick={() => run(() => submitChecklistItemAction(item.id, detail.id, role === "mentor" && !item.review_required ? "completed" : "pending_review"))}><RotateCcw />{role === "mentor" && !item.review_required ? "Đã sửa xong" : "Nộp lại"}</Button>
                    ) : null}
                    {canReview && item.status === "pending_review" ? (
                      <>
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => {
                          if (!window.confirm("Duyệt mục checklist này?")) return;
                          run(() => reviewChecklistItemAction(item.id, detail.id, "approved"));
                        }}><Check />Duyệt</Button>
                        <Button size="sm" variant="destructive" disabled={pending} onClick={() => {
                          const feedback = window.prompt("Nội dung cần chỉnh sửa:");
                          if (!feedback) return;
                          run(() => reviewChecklistItemAction(item.id, detail.id, "needs_revision", feedback));
                        }}>Yêu cầu sửa</Button>
                      </>
                    ) : null}
                    {canManage ? (
                      <>
                        <EditChecklistForm item={item} recordId={detail.id} profiles={profiles} documents={documents} disabled={locked} />
                        <Button size="icon-sm" variant="ghost" disabled={pending || locked} aria-label="Xóa checklist" onClick={() => {
                          if (!window.confirm(`Xóa checklist “${item.title}”?`)) return;
                          run(() => deleteChecklistItemAction(item.id, detail.id));
                        }}><Trash2 /></Button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
