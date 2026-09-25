"use client";

import * as React from "react";
import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Layers3, Plus, Power } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { CatalogDocumentManager, type CatalogDocument } from "./catalog-document-manager";
import { ONBOARDING_CATEGORIES } from "./constants";
import { createOnboardingDocumentTypeAction, createOnboardingTemplateAction, createOnboardingTemplateItemAction, toggleOnboardingTemplateAction } from "./actions";
import type { ActionState, NamedOption, OnboardingTemplateView } from "./types";

function CreateTemplateForm() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await createOnboardingTemplateAction(previous, formData);
    if (result.error) toast.error(result.error);
    else {
      toast.success(result.success ?? "Đã tạo mẫu.");
      setOpen(false);
      router.refresh();
    }
    return result;
  }, {});

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus />Tạo mẫu</Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-lg">
          <SheetHeader><SheetTitle>Tạo mẫu checklist</SheetTitle><SheetDescription>Mẫu có thể được sao chép sang hồ sơ mới.</SheetDescription></SheetHeader>
          <form action={formAction} className="flex flex-col gap-4 px-4 pb-4">
            <div className="flex flex-col gap-2"><Label>Mã mẫu</Label><Input name="code" placeholder="STANDARD_V2" required /></div>
            <div className="flex flex-col gap-2"><Label>Tên mẫu</Label><Input name="name" required /></div>
            <div className="flex flex-col gap-2"><Label>Mô tả</Label><Textarea name="description" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="hidden" name="is_active" value="false" /><input type="checkbox" name="is_active" value="true" defaultChecked />Kích hoạt ngay</label>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <SheetFooter><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Tạo mẫu"}</Button></SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function AddTemplateItemForm({ templateId, documents }: { templateId: string; documents: NamedOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const action = createOnboardingTemplateItemAction.bind(null, templateId);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await action(previous, formData);
    if (result.error) toast.error(result.error);
    else {
      toast.success(result.success ?? "Đã thêm mục mẫu.");
      setOpen(false);
      router.refresh();
    }
    return result;
  }, {});

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus />Thêm mục</Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Thêm mục vào mẫu</SheetTitle><SheetDescription>Đặt số ngày tương đối so với ngày bắt đầu onboarding.</SheetDescription></SheetHeader>
          <form action={formAction} className="flex flex-col gap-4 px-4 pb-4">
            <div className="flex flex-col gap-2"><Label>Tên công việc</Label><Input name="title" required /></div>
            <div className="flex flex-col gap-2"><Label>Mô tả</Label><Textarea name="description" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2"><Label>Nhóm</Label><select name="category" className="h-8 rounded-lg border bg-background px-2 text-sm">{ONBOARDING_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></div>
              <div className="flex flex-col gap-2"><Label>Vai trò mặc định</Label><select name="default_assignee_role" className="h-8 rounded-lg border bg-background px-2 text-sm"><option value="intern">Intern</option><option value="mentor">Mentor</option><option value="hr">HR</option></select></div>
              <div className="flex flex-col gap-2"><Label>Số ngày tương đối</Label><Input name="due_offset_days" type="number" defaultValue="0" /></div>
              <div className="flex flex-col gap-2"><Label>Tài liệu hướng dẫn</Label><select name="guide_document_id" className="h-8 rounded-lg border bg-background px-2 text-sm"><option value="">Không có</option>{documents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="hidden" name="is_required" value="false" /><input type="checkbox" name="is_required" value="true" defaultChecked />Bắt buộc</label>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <SheetFooter><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Thêm mục"}</Button></SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function DocumentTypeForm() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await createOnboardingDocumentTypeAction(previous, formData);
    if (result.error) toast.error(result.error);
    else {
      toast.success(result.success ?? "Đã thêm loại tài liệu.");
      setOpen(false);
      router.refresh();
    }
    return result;
  }, {});

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Plus />Thêm loại</Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-md">
          <SheetHeader><SheetTitle>Loại tài liệu</SheetTitle><SheetDescription>Cấu hình loại HR có thể giao cho thực tập sinh.</SheetDescription></SheetHeader>
          <form action={formAction} className="flex flex-col gap-4 px-4 pb-4">
            <div className="flex flex-col gap-2"><Label>Mã</Label><Input name="code" placeholder="tax_code" required /></div>
            <div className="flex flex-col gap-2"><Label>Tên loại</Label><Input name="name" required /></div>
            <div className="flex flex-col gap-2"><Label>Mô tả</Label><Textarea name="description" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="hidden" name="is_required_default" value="false" /><input type="checkbox" name="is_required_default" value="true" />Mặc định bắt buộc</label>
            <label className="flex items-center gap-2 text-sm"><input type="hidden" name="is_active" value="false" /><input type="checkbox" name="is_active" value="true" defaultChecked />Kích hoạt</label>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <SheetFooter><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Thêm loại"}</Button></SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function OnboardingConfigurationManager({
  templates,
  documentTypes,
  documents,
  catalogDocuments,
}: {
  templates: OnboardingTemplateView[];
  documentTypes: NamedOption[];
  documents: NamedOption[];
  catalogDocuments: CatalogDocument[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end"><CreateTemplateForm /></div>
      <div className="grid gap-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div><CardTitle className="flex items-center gap-2"><Layers3 className="size-4" />{template.name}</CardTitle><p className="mt-1 font-mono text-xs text-muted-foreground">{template.code} · {template.items.length} mục</p></div>
              <div className="flex gap-2">{template.is_active ? <StatusBadge value="active" /> : <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">Tạm tắt</span>}<AddTemplateItemForm templateId={template.id} documents={documents} /><Button size="icon-sm" variant="outline" disabled={pending} aria-label="Đổi trạng thái mẫu" onClick={() => startTransition(async () => { const result = await toggleOnboardingTemplateAction(template.id); if (result.error) toast.error(result.error); else { toast.success(result.success); router.refresh(); } })}><Power /></Button></div>
            </CardHeader>
            <CardContent className="divide-y rounded-lg border">
              {template.items.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div><span className="font-medium">{item.title}</span><span className="ml-2 text-xs text-muted-foreground">{item.category} · {item.due_offset_days ?? 0} ngày</span></div>
                  <span className="text-xs font-semibold text-muted-foreground">{item.is_required ? "Bắt buộc" : "Tùy chọn"} · {item.default_assignee_role?.toUpperCase() ?? "Chưa gán"}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <CatalogDocumentManager documents={catalogDocuments} types={documentTypes} />
      <Card>
        <CardHeader className="flex-row items-center justify-between"><CardTitle>Loại tài liệu</CardTitle><DocumentTypeForm /></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {documentTypes.map((type) => <span key={type.id} className="rounded-full border bg-muted/40 px-3 py-1 text-xs">{type.name}</span>)}
        </CardContent>
      </Card>
    </div>
  );
}
