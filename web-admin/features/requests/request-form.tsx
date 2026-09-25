"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { FilePlus2, Paperclip, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createRequestAction, type RequestActionState } from "./actions";
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_SIZE,
  dateModeFor,
  timeFieldFor,
  toIsoLocal,
} from "./constants";

export type RequestTypeOption = {
  code: string;
  name: string;
  requires_attachment: boolean;
};

export function CreateRequestButton({
  userId,
  types,
}: {
  userId: string;
  types: RequestTypeOption[];
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [open, setOpen] = React.useState(false);
  const [requestType, setRequestType] = React.useState(types[0]?.code ?? "leave");
  const [files, setFiles] = React.useState<File[]>([]);
  const [fileError, setFileError] = React.useState<string | null>(null);

  const requiresAttachment =
    types.find((t) => t.code === requestType)?.requires_attachment ?? false;
  const dateMode = dateModeFor(requestType);
  const timeMode = timeFieldFor(requestType);

  const [state, formAction, pending] = useActionState<RequestActionState, FormData>(
    async (previous, formData) => {
      formData.set("request_type", requestType);

      // Tài liệu đính kèm → upload lên Storage trước khi tạo đơn.
      const paths: string[] = [];
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._ -]/g, "_");
        const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage
          .from("request-attachments")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) {
          for (const p of paths) {
            await supabase.storage.from("request-attachments").remove([p]);
          }
          return { error: `Không thể tải tệp "${file.name}": ${error.message}` };
        }
        paths.push(path);
      }
      formData.set("attachment_paths", JSON.stringify(paths));

      // Payload cho đơn điều chỉnh chấm công (đề xuất giờ vào/ra).
      if (requestType === "attendance_adjustment") {
        const date = String(formData.get("start_date") ?? "");
        const proposedIn = String(formData.get("proposed_in") ?? "");
        const proposedOut = String(formData.get("proposed_out") ?? "");
        formData.set(
          "payload",
          JSON.stringify({
            proposed_check_in: toIsoLocal(date, proposedIn),
            proposed_check_out: toIsoLocal(date, proposedOut),
          }),
        );
      }

      const result = await createRequestAction(previous, formData);
      if (result.error) {
        for (const p of paths) {
          await supabase.storage.from("request-attachments").remove([p]);
        }
        toast.error(result.error);
        return result;
      }
      toast.success(result.success ?? "Đã gửi đơn.");
      setOpen(false);
      setFiles([]);
      return result;
    },
    {},
  );

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        setFileError(`Tệp "${file.name}" vượt quá 10 MB.`);
        continue;
      }
      if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
        setFileError(`Định dạng tệp "${file.name}" không được phép.`);
        continue;
      }
      next.push(file);
    }
    setFileError(null);
    setFiles(next);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <FilePlus2 /> Tạo đơn
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Tạo đơn mới</SheetTitle>
            <SheetDescription>
              Chọn loại đơn, điền lý do và gửi cho mentor / HR xét duyệt.
            </SheetDescription>
          </SheetHeader>
          <form action={formAction} className="flex flex-col gap-4 px-4 pb-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rq-type">Loại đơn</Label>
                <select
                  id="rq-type"
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                  className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                >
                  {types.map((t) => (
                    <option key={t.code} value={t.code}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rq-title">Tiêu đề *</Label>
                <Input
                  id="rq-title"
                  name="title"
                  placeholder="Ví dụ: Xin nghỉ phép ngày 10/10"
                  minLength={3}
                  required
                />
              </div>
            </div>

            {dateMode !== "none" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="rq-start">
                    {dateMode === "range" ? "Từ ngày *" : "Ngày áp dụng *"}
                  </Label>
                  <Input id="rq-start" name="start_date" type="date" required />
                </div>
                {dateMode === "range" ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="rq-end">Đến ngày *</Label>
                    <Input id="rq-end" name="end_date" type="date" required />
                  </div>
                ) : null}
              </div>
            ) : null}

            {timeMode === "start" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="rq-time">Giờ đến dự kiến</Label>
                <Input id="rq-time" name="start_time" type="time" />
              </div>
            ) : null}
            {timeMode === "end" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="rq-time">Giờ về dự kiến</Label>
                <Input id="rq-time" name="end_time" type="time" />
              </div>
            ) : null}
            {timeMode === "proposed" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="rq-in">Giờ check-in đề xuất</Label>
                  <Input id="rq-in" name="proposed_in" type="time" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="rq-out">Giờ check-out đề xuất</Label>
                  <Input id="rq-out" name="proposed_out" type="time" />
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="rq-reason">Lý do *</Label>
              <Textarea
                id="rq-reason"
                name="reason"
                required
                minLength={5}
                placeholder="Mô tả lý do gửi đơn (tối thiểu 5 ký tự)"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="rq-desc">Mô tả chi tiết</Label>
              <Textarea
                id="rq-desc"
                name="description"
                placeholder="Thông tin bổ sung (không bắt buộc)"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="rq-files">
                Tài liệu đính kèm
                {requiresAttachment ? " * (bắt buộc với loại đơn này)" : ""}
              </Label>
              <input
                id="rq-files"
                type="file"
                multiple
                onChange={(e) => addFiles(e.target.files)}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm"
              />
              {fileError ? (
                <p className="text-sm text-destructive">{fileError}</p>
              ) : null}
              {files.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Paperclip className="size-3.5 shrink-0" />
                        {f.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFiles(files.filter((_, j) => j !== i))}
                        aria-label={`Bỏ ${f.name}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {state.error ? (
              <p role="alert" className="text-sm text-destructive">{state.error}</p>
            ) : null}

            <SheetFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Đang gửi..." : "Gửi đơn"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
