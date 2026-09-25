"use client";

import * as React from "react";
import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Paperclip, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createReportAction,
  updateReportAction,
  type ReportActionState,
} from "./actions";
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_SIZE,
  REPORT_FIELDS,
  REPORT_TYPES,
  linksToText,
  parseLinks,
} from "./constants";

export type ReportFormValues = {
  report_id?: string;
  report_type: string;
  title: string;
  period_start: string;
  period_end: string;
  due_date: string | null;
  content: Record<string, string>;
  links: unknown;
  task_ids: string[];
  attachment_paths: string[];
};

type TaskOption = { id: string; title: string };

export function ReportForm({
  userId,
  initial,
}: {
  userId: string;
  initial?: ReportFormValues;
}) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);

  const isEdit = Boolean(initial?.report_id);

  const [reportType, setReportType] = React.useState(initial?.report_type ?? "daily");
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [periodStart, setPeriodStart] = React.useState(initial?.period_start ?? "");
  const [periodEnd, setPeriodEnd] = React.useState(initial?.period_end ?? "");
  const [dueDate, setDueDate] = React.useState(initial?.due_date ?? "");
  const [content, setContent] = React.useState<Record<string, string>>(initial?.content ?? {});
  const [linksText, setLinksText] = React.useState(linksToText(initial?.links));
  const [taskIds, setTaskIds] = React.useState<string[]>(initial?.task_ids ?? []);
  const [files, setFiles] = React.useState<File[]>([]);
  const [existingPaths, setExistingPaths] = React.useState<string[]>(
    initial?.attachment_paths ?? [],
  );
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [tasks, setTasks] = React.useState<TaskOption[]>([]);
  const submitMode = useRef("");

  const dirty = React.useRef(false);
  const setDirty = () => {
    dirty.current = true;
  };

  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const intern = await supabase
          .from("interns")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        if (!intern.data) return;
        const internship = await supabase
          .from("internships")
          .select("id")
          .eq("intern_id", intern.data.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!internship.data) return;
        const rows = await supabase
          .from("tasks")
          .select("id,title")
          .eq("internship_id", internship.data.id)
          .order("created_at", { ascending: true })
          .limit(100);
        if (!cancelled && rows.data) setTasks(rows.data as TaskOption[]);
      } catch {
        /* danh sách nhiệm vụ không bắt buộc */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const action = isEdit ? updateReportAction : createReportAction;
  const [state, formAction, pending] = useActionState<ReportActionState, FormData>(
    async (previous, formData) => {
      // Nội dung -> JSON
      const contentJson: Record<string, string> = {};
      for (const f of REPORT_FIELDS[reportType] ?? []) {
        const value = (content[f.key] ?? "").trim();
        if (value) contentJson[f.key] = value;
      }
      const required = (REPORT_FIELDS[reportType] ?? []).filter((f) => f.required);
      const missing = required.filter((f) => !contentJson[f.key]);
      if (submitMode.current === "1" && missing.length > 0) {
        const msg = `Bắt buộc điền: ${missing.map((m) => m.label).join(", ")}.`;
        toast.error(msg);
        return { error: msg };
      }

      const links = parseLinks(linksText);

      // Tài liệu đính kèm -> upload lên Storage
      const paths: string[] = [...existingPaths];
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._ -]/g, "_");
        const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage
          .from("report-attachments")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) {
          return { error: `Không thể tải tệp "${file.name}": ${error.message}` };
        }
        paths.push(path);
      }

      formData.set("content", JSON.stringify(contentJson));
      formData.set("links", JSON.stringify(links));
      formData.set("task_ids", JSON.stringify(taskIds));
      formData.set("attachment_paths", JSON.stringify(paths));
      formData.set("submit", submitMode.current);

      const result = await action(previous, formData);
      if (result.error) {
        const uploaded = paths.slice(existingPaths.length);
        for (const p of uploaded) {
          await supabase.storage.from("report-attachments").remove([p]).catch(() => null);
        }
        toast.error(result.error);
        return result;
      }
      dirty.current = false;
      toast.success(result.success ?? "Đã lưu báo cáo.");
      if (result.report_id) {
        router.push(`/intern/reports/${result.report_id}`);
      } else if (isEdit && initial?.report_id) {
        router.push(`/intern/reports/${initial.report_id}`);
      } else {
        router.refresh();
      }
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
    setDirty();
  }

  const fields = REPORT_FIELDS[reportType] ?? [];

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {isEdit ? <input type="hidden" name="report_id" value={initial?.report_id} /> : null}
      <input type="hidden" name="report_type" value={reportType} />

      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Thông tin kỳ báo cáo</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="rp-type">Loại báo cáo</Label>
            <select
              id="rp-type"
              value={reportType}
              disabled={isEdit}
              onChange={(e) => {
                setReportType(e.target.value);
                setDirty();
              }}
              className="h-9 w-full rounded-lg border bg-background px-2 text-sm disabled:opacity-60"
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.code} value={t.code}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rp-title">Tiêu đề *</Label>
            <Input
              id="rp-title"
              name="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty();
              }}
              placeholder="Ví dụ: Báo cáo tuần 12/09 – 18/09"
              minLength={5}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rp-start">Kỳ từ *</Label>
            <Input
              id="rp-start"
              type="date"
              value={periodStart}
              onChange={(e) => {
                setPeriodStart(e.target.value);
                setDirty();
              }}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rp-end">Kỳ đến *</Label>
            <Input
              id="rp-end"
              type="date"
              value={periodEnd}
              onChange={(e) => {
                setPeriodEnd(e.target.value);
                setDirty();
              }}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rp-due">Hạn nộp (tự lấy từ cấu hình nếu để trống)</Label>
            <Input
              id="rp-due"
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                setDirty();
              }}
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Nội dung báo cáo</h2>
        <div className="grid gap-4">
          {fields.map((f) => (
            <div key={f.key} className="flex flex-col gap-2">
              <Label htmlFor={`rp-${f.key}`}>
                {f.label}
                {f.required ? " *" : ""}
              </Label>
              <Textarea
                id={`rp-${f.key}`}
                value={content[f.key] ?? ""}
                onChange={(e) => {
                  setContent((prev) => ({ ...prev, [f.key]: e.target.value }));
                  setDirty();
                }}
                placeholder={f.placeholder}
                rows={f.key === "note" ? 2 : 3}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Nhiệm vụ liên quan (Tasks)</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có nhiệm vụ nào được giao.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {tasks.map((t) => {
              const checked = taskIds.includes(t.id);
              return (
                <li key={t.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setTaskIds((prev) =>
                          checked ? prev.filter((id) => id !== t.id) : [...prev, t.id],
                        );
                        setDirty();
                      }}
                    />
                    <span className={checked ? "font-medium" : "text-muted-foreground"}>
                      {t.title}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Liên kết &amp; tài liệu</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rp-links">Liên kết (mỗi dòng1 URL, có thể kèm “ - tên”)</Label>
          <Textarea
            id="rp-links"
            value={linksText}
            onChange={(e) => {
              setLinksText(e.target.value);
              setDirty();
            }}
            placeholder={"https://github.com/.../pull/123 - Pull request\nhttps://docs.google.com/..."}
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="rp-files">Tài liệu / hình ảnh đính kèm</Label>
          <input
            id="rp-files"
            type="file"
            multiple
            onChange={(e) => addFiles(e.target.files)}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm"
          />
          {fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}
          {existingPaths.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {existingPaths.map((p) => (
                <li
                  key={p}
                  className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Paperclip className="size-3.5 shrink-0" />
                    {p.split("/").slice(1).join("/")}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setExistingPaths((prev) => prev.filter((x) => x !== p));
                      setDirty();
                    }}
                    aria-label="Bỏ tệp"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
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
      </section>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          onClick={() => {
            submitMode.current = "";
          }}
        >
          {pending ? "Đang lưu..." : "Lưu nháp"}
        </Button>
        <Button
          type="submit"
          disabled={pending}
          onClick={(e) => {
            submitMode.current = "1";
            if (!window.confirm("Xác nhận nộp báo cáo cho mentor xét duyệt?")) {
              submitMode.current = "";
              e.preventDefault();
            }
          }}
        >
          {pending ? "Đang nộp..." : "Nộp báo cáo"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={pending}
        >
          Quay lại
        </Button>
      </div>
    </form>
  );
}
