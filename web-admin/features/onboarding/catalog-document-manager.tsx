"use client";

import * as React from "react";
import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { createCatalogDocumentAction, finalizeCatalogDocumentUpload, getOnboardingDocumentUrl } from "./actions";
import type { ActionState, NamedOption } from "./types";

export type CatalogDocument = {
  id: string;
  name: string;
  document_type: string | null;
  file_path: string | null;
  file_url: string | null;
};

function CreateCatalogForm({ types }: { types: NamedOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await createCatalogDocumentAction(previous, formData);
    if (result.error) toast.error(result.error);
    else {
      toast.success(result.success ?? "Đã tạo tài liệu.");
      setOpen(false);
      router.refresh();
    }
    return result;
  }, {});
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus />Thêm tài liệu</Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-md">
          <SheetHeader><SheetTitle>Thêm tài liệu thư viện</SheetTitle><SheetDescription>Tạo mẫu để giao cho nhiều hồ sơ.</SheetDescription></SheetHeader>
          <form action={formAction} className="flex flex-col gap-4 px-4 pb-4">
            <div className="flex flex-col gap-2"><Label>Tên tài liệu</Label><Input name="title" required /></div>
            <div className="flex flex-col gap-2"><Label>Loại</Label><select name="document_type" className="h-8 rounded-lg border bg-background px-2 text-sm">{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></div>
            <div className="flex flex-col gap-2"><Label>Mô tả</Label><Textarea name="description" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="hidden" name="is_required" value="false" /><input type="checkbox" name="is_required" value="true" />Mặc định bắt buộc</label>
            <label className="flex items-center gap-2 text-sm"><input type="hidden" name="is_guidance" value="false" /><input type="checkbox" name="is_guidance" value="true" defaultChecked />Tài liệu hướng dẫn</label>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <SheetFooter><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Tạo tài liệu"}</Button></SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function CatalogDocumentRow({ document }: { document: CatalogDocument }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      toast.error("Tệp vượt quá giới hạn 10 MB.");
      return;
    }
    const allowed = ["application/pdf", "image/png", "image/jpeg", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) {
      toast.error("Định dạng tệp không được phép.");
      return;
    }
    startTransition(async () => {
      const path = `${document.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._ -]/g, "_")}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from("onboarding").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        toast.error(uploadError.message);
        return;
      }
      const result = await finalizeCatalogDocumentUpload({ documentId: document.id, filePath: path, fileName: file.name, fileSize: file.size, mimeType: file.type });
      if (result.error) {
        await supabase.storage.from("onboarding").remove([path]);
        toast.error(result.error);
      } else {
        toast.success(result.success ?? "Đã cập nhật tệp.");
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      }
    });
  }

  async function open() {
    const popup = window.open("about:blank", "_blank");
    const result = await getOnboardingDocumentUrl({ catalogDocumentId: document.id });
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3 last:border-0">
      <div><p className="text-sm font-medium">{document.name}</p><p className="text-xs text-muted-foreground">{document.document_type ?? "Chưa phân loại"}</p></div>
      <div className="flex items-center gap-2">
        {document.file_path || document.file_url ? <Button size="sm" variant="outline" onClick={open}>Mở tệp</Button> : null}
        <input ref={inputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); }} />
        <Button size="sm" disabled={pending} onClick={() => inputRef.current?.click()}><FileUp />{pending ? "Đang tải..." : document.file_path ? "Thay tệp" : "Tải tệp"}</Button>
      </div>
    </div>
  );
}

export function CatalogDocumentManager({ documents, types }: { documents: CatalogDocument[]; types: NamedOption[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between"><CardTitle>Thư viện tài liệu</CardTitle><CreateCatalogForm types={types} /></CardHeader>
      <CardContent className="p-0">{documents.map((document) => <CatalogDocumentRow key={document.id} document={document} />)}</CardContent>
    </Card>
  );
}
