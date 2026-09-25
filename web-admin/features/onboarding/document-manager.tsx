"use client";

import * as React from "react";
import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Download, FileText, Plus, Upload, XCircle } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime } from "@/features/labels";
import { createClient } from "@/lib/supabase/client";
import { ONBOARDING_ALLOWED_MIME_TYPES, ONBOARDING_MAX_FILE_SIZE } from "./constants";
import {
  createDocumentRequestAction,
  finalizeOnboardingDocumentUpload,
  getOnboardingDocumentUrl,
  reviewOnboardingDocumentAction,
} from "./actions";
import type {
  ActionState,
  NamedOption,
  OnboardingDetail,
  OnboardingDocumentView,
} from "./types";

const documentTypeLabels: Record<string, string> = {
  cv: "CV / Hồ sơ",
  internship_letter: "Giấy giới thiệu",
  personal_form: "Biểu mẫu cá nhân",
  identity: "Giấy tờ tùy thân",
  confidentiality: "Cam kết bảo mật",
  policy: "Hướng dẫn / nội quy",
  other: "Khác",
};

export type DocumentCatalogOption = NamedOption & {
  document_type?: string | null;
  is_required_default?: boolean;
};

function DocumentRequestForm({ recordId, catalog, types, disabled }: {
  recordId: string;
  catalog: DocumentCatalogOption[];
  types: NamedOption[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [catalogId, setCatalogId] = React.useState("");
  const selected = catalog.find((item) => item.id === catalogId);
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<string>("other");
  const action = createDocumentRequestAction.bind(null, recordId);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await action(previous, formData);
    if (result.error) toast.error(result.error);
    else {
      toast.success(result.success ?? "Đã tạo yêu cầu tài liệu.");
      setOpen(false);
      router.refresh();
    }
    return result;
  }, {});

  function selectCatalog(value: string) {
    setCatalogId(value);
    const item = catalog.find((document) => document.id === value);
    if (item) {
      setName(item.name);
      setType(item.document_type ?? "other");
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={disabled}><Plus />Yêu cầu tài liệu</Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Yêu cầu tài liệu</SheetTitle><SheetDescription>Tạo yêu cầu riêng hoặc dùng tài liệu trong thư viện.</SheetDescription></SheetHeader>
          <form action={formAction} className="flex flex-col gap-4 px-4 pb-4">
            <input type="hidden" name="catalog_document_id" value={catalogId} />
            <div className="flex flex-col gap-2">
              <Label>Tài liệu trong thư viện</Label>
              <select value={catalogId} onChange={(event) => selectCatalog(event.target.value)} className="h-8 rounded-lg border bg-background px-2 text-sm">
                <option value="">Tạo yêu cầu mới</option>
                {catalog.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tên tài liệu</Label>
              <Input name="document_name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Loại tài liệu</Label>
              <select name="document_type" value={type} onChange={(event) => setType(event.target.value)} className="h-8 rounded-lg border bg-background px-2 text-sm">
                {types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Hướng dẫn / mô tả</Label>
              <Textarea name="description" placeholder="Nêu rõ yêu cầu và thông tin cần nộp" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Hạn nộp</Label>
              <Input name="due_date" type="date" min={new Date().toISOString().slice(0, 10)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="hidden" name="is_required" value="false" />
              <input type="checkbox" name="is_required" value="true" defaultChecked={selected?.is_required_default ?? true} />
              Tài liệu bắt buộc
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="hidden" name="visible_to_mentor" value="false" />
              <input type="checkbox" name="visible_to_mentor" value="true" />
              Cho phép mentor xem tài liệu này
            </label>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <SheetFooter><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Tạo yêu cầu"}</Button></SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function DocumentUploader({ document, recordId, disabled }: {
  document: OnboardingDocumentView;
  recordId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    if (!ONBOARDING_ALLOWED_MIME_TYPES.includes(file.type)) {
      toast.error("Định dạng tệp không được phép.");
      return;
    }
    if (file.size <= 0 || file.size > ONBOARDING_MAX_FILE_SIZE) {
      toast.error("Tệp vượt quá giới hạn 10 MB.");
      return;
    }

    startTransition(async () => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120) || "document";
      const path = `records/${recordId}/documents/${document.id}/${crypto.randomUUID()}-${safeName}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("onboarding")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        toast.error(uploadError.message);
        return;
      }
      const result = await finalizeOnboardingDocumentUpload({
        documentId: document.id,
        filePath: path,
        fileName: safeName,
        fileSize: file.size,
        mimeType: file.type,
      });
      if (result.error) {
        await supabase.storage.from("onboarding").remove([path]);
        toast.error(result.error);
      } else {
        toast.success(result.success ?? "Đã nộp tài liệu.");
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={inputRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) upload(file);
      }} />
      <Button size="sm" disabled={pending || disabled} onClick={() => inputRef.current?.click()}>
        <Upload />{pending ? "Đang nộp..." : document.status === "needs_revision" ? "Nộp bản sửa" : "Tải tệp lên"}
      </Button>
      <span className="text-xs text-muted-foreground">PDF, DOCX, DOC, JPG, PNG hoặc TXT · tối đa 10 MB</span>
    </div>
  );
}

export function DocumentManager({
  detail,
  catalog,
  documentTypes,
  role,
}: {
  detail: OnboardingDetail;
  catalog: DocumentCatalogOption[];
  documentTypes: NamedOption[];
  role: "admin" | "hr" | "mentor" | "intern";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canManage = role === "admin" || role === "hr";
  const locked = detail.status === "completed" || detail.status === "cancelled";

  function run(operation: () => Promise<{ error?: string; success?: string }>) {
    startTransition(async () => {
      const result = await operation();
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.success ?? "Đã cập nhật tài liệu.");
        router.refresh();
      }
    });
  }

  async function openFile(input: { versionId?: string; catalogDocumentId?: string }) {
    const popup = window.open("about:blank", "_blank");
    const result = await getOnboardingDocumentUrl(input);
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
    <div className="flex flex-col gap-4">
      {canManage ? (
        <div className="flex justify-end">
          <DocumentRequestForm recordId={detail.id} catalog={catalog} types={documentTypes} disabled={locked} />
        </div>
      ) : null}
      {!detail.documents.length ? (
        <EmptyState title="Chưa có yêu cầu tài liệu" description="HR có thể thêm tài liệu bắt buộc hoặc tùy chọn cho hồ sơ." />
      ) : (
        <div className="grid gap-3">
          {detail.documents.map((document) => {
            const current = document.versions.find((version) => version.id === document.current_version_id) ?? document.versions[0];
            return (
              <article key={document.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="size-4 text-muted-foreground" />
                      <h3 className="font-medium">{document.document_name}</h3>
                      {document.is_required ? <span className="text-[11px] font-semibold text-red-600">Bắt buộc</span> : null}
                      <StatusBadge value={document.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {documentTypeLabels[document.document_type ?? ""] ?? "Tài liệu"} · Hạn {formatDate(document.due_date)}
                      {document.visible_to_mentor ? " · Mentor được xem" : ""}
                    </p>
                    {document.description ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{document.description}</p> : null}
                    {document.feedback ? <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">HR: {document.feedback}</p> : null}
                    {document.versions.length ? (
                      <div className="mt-3 space-y-1">
                        {document.versions.map((version) => (
                          <div key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs">
                            <span>Phiên bản {version.version_number} · {version.file_name} · {formatDateTime(version.uploaded_at)}</span>
                            <Button size="xs" variant="ghost" onClick={() => openFile({ versionId: version.id })}><Download />Tải</Button>
                          </div>
                        ))}
                      </div>
                    ) : document.catalog?.file_path || document.catalog?.file_url ? (
                      <Button size="xs" variant="link" className="mt-2 px-0" onClick={() => openFile({ catalogDocumentId: document.catalog!.id })}>
                        <Download />Tải tài liệu hướng dẫn
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {role === "intern" ? (
                      <DocumentUploader document={document} recordId={detail.id} disabled={locked || document.status === "approved"} />
                    ) : null}
                    {canManage && document.status === "pending_review" && document.current_version_id ? (
                      <>
                        <Button size="sm" disabled={pending} onClick={() => {
                          if (!window.confirm("Duyệt phiên bản tài liệu hiện tại?")) return;
                          run(() => reviewOnboardingDocumentAction(document.id, detail.id, document.current_version_id!, true));
                        }}><CheckCircle2 />Duyệt</Button>
                        <Button size="sm" variant="destructive" disabled={pending} onClick={() => {
                          const feedback = window.prompt("Nội dung cần bổ sung:");
                          if (!feedback) return;
                          run(() => reviewOnboardingDocumentAction(document.id, detail.id, document.current_version_id!, false, feedback));
                        }}><XCircle />Yêu cầu bổ sung</Button>
                      </>
                    ) : null}
                    {current && canManage && document.status === "pending_review" ? (
                      <Button size="xs" variant="outline" onClick={() => openFile({ versionId: current.id })}><Download />Mở tệp chờ duyệt</Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
