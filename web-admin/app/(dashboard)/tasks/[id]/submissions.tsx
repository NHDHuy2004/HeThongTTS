"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LinkIcon, Paperclip, Plus, Send, Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/features/labels";
import { submitTask, type TaskFormState } from "../task-actions";
import type { SubtaskRow } from "./subtasks";

export type SubmissionRow = {
  id: string;
  subtask_id: string | null;
  submitted_by: string;
  work_summary: string | null;
  implementation_details: string | null;
  problems: string | null;
  solutions: string | null;
  notes: string | null;
  submission_no: number;
  submitted_at: string;
  task_submission_files: { id: string; file_path: string; file_name: string }[];
  task_submission_links: { id: string; title: string | null; url: string }[];
};

const initialState: TaskFormState = {};

export function SubmissionsPanel({
  taskId,
  submissions,
  subtasks,
  nameOf,
  canManage,
  isIntern,
}: {
  taskId: string;
  submissions: SubmissionRow[];
  subtasks: subtasksType;
  nameOf: (id: string | null) => string;
  canManage: boolean;
  isIntern: boolean;
}) {
  const [showForm, setShowForm] = React.useState(false);
  const [links, setLinks] = React.useState([{ title: "", url: "" }]);
  const [files, setFiles] = React.useState<File[]>([]);
  const [pendingUrl, setPendingUrl] = React.useState<Record<string, string>>({});
  const router = useRouter();
  const supabase = createClient();

  const [state, formAction, pending] = useActionState(
    async (prev: TaskFormState, formData: FormData) => {
      formData.set(
        "links",
        JSON.stringify(
          links.filter((l) => l.url.trim()).map((l) => ({ title: l.title.trim() || undefined, url: l.url.trim() })),
        ),
      );
      for (const f of files) formData.append("files", f);

      const result = await submitTask(taskId, prev, formData);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Đã nộp bài, chờ mentor đánh giá.");
        setShowForm(false);
        setLinks([{ title: "", url: "" }]);
        setFiles([]);
        router.refresh();
      }
      return result;
    },
    initialState,
  );

  const sign = async (path: string) => {
    if (pendingUrl[path]) return;
    setPendingUrl((p) => ({ ...p, [path]: "loading" }));
    const { data } = await supabase.storage
      .from("task-attachments")
      .createSignedUrl(path, 3600);
    setPendingUrl((p) => ({ ...p, [path]: data?.signedUrl ?? "" }));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Nộp bài &amp; lịch sử ({submissions.length})</CardTitle>
        {isIntern ? (
          <Button size="xs" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus className="size-4" />
            Nộp bài
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {showForm ? (
          <form action={formAction} className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="sub_subtask">Sub-task liên quan</Label>
              <select
                id="sub_subtask"
                name="subtask_id"
                className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="">— Toàn bộ task —</option>
                {(subtasks ?? []).map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sub_summary">Tóm tắt công việc đã làm</Label>
              <Textarea id="sub_summary" name="work_summary" rows={3} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sub_details">Chi tiết triển khai</Label>
              <Textarea id="sub_details" name="implementation_details" rows={3} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="sub_problems">Vấn đề gặp phải</Label>
                <Textarea id="sub_problems" name="problems" rows={2} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="sub_solutions">Giải pháp</Label>
                <Textarea id="sub_solutions" name="solutions" rows={2} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sub_notes">Ghi chú</Label>
              <Textarea id="sub_notes" name="notes" rows={2} />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Link sản phẩm (PR, deploy, demo)</Label>
              {links.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="Tiêu đề"
                    value={l.title}
                    onChange={(e) =>
                      setLinks((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    placeholder="https://"
                    value={l.url}
                    onChange={(e) =>
                      setLinks((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)),
                      )
                    }
                  />
                  {links.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <Trash className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => setLinks((prev) => [...prev, { title: "", url: "" }])}
              >
                <Plus className="size-4" />
                Thêm link
              </Button>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="sub_files">File nộp (source, screenshot, doc...)</Label>
              <Input
                id="sub_files"
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              {files.length ? (
                <p className="text-xs text-muted-foreground">
                  {files.map((f) => f.name).join(", ")}
                </p>
              ) : null}
            </div>

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Hủy
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                <Send className="size-4" />
                Nộp bài
              </Button>
            </div>
          </form>
        ) : null}

        {submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có bài nộp nào. {isIntern ? "Hãy nộp bài để được đánh giá." : ""}
          </p>
        ) : (
          submissions.map((s, idx) => (
            <div key={s.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  Lần nộp #{s.submission_no} · {nameOf(s.submitted_by)}
                </span>
                {idx === 0 && !canManage ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                    Mới nhất
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(s.submitted_at)}
                </span>
              </div>
              {s.work_summary ? <p className="text-sm">{s.work_summary}</p> : null}
              {s.implementation_details ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  Triển khai: {s.implementation_details}
                </p>
              ) : null}
              {s.problems ? (
                <p className="text-sm text-muted-foreground">Vấn đề: {s.problems}</p>
              ) : null}
              {s.solutions ? (
                <p className="text-sm text-muted-foreground">Giải pháp: {s.solutions}</p>
              ) : null}
              {s.task_submission_links?.length ? (
                <div className="flex flex-wrap gap-2">
                  {s.task_submission_links.map((l) => (
                    <a
                      key={l.id}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-primary"
                    >
                      <LinkIcon className="size-3" />
                      {l.title ?? l.url}
                    </a>
                  ))}
                </div>
              ) : null}
              {s.task_submission_files?.length ? (
                <div className="flex flex-wrap gap-2">
                  {s.task_submission_files.map((f) => {
                    const url = pendingUrl[f.file_path];
                    if (url === "loading")
                      return (
                        <span key={f.id} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Paperclip className="size-3" /> {f.file_name}…
                        </span>
                      );
                    if (url)
                      return (
                        <a
                          key={f.id}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-primary"
                        >
                          <Paperclip className="size-3" />
                          {f.file_name}
                        </a>
                      );
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => sign(f.file_path)}
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:text-primary"
                      >
                        <Paperclip className="size-3" />
                        {f.file_name}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// Type-only alias để tránh import vòng từ subtasks (server type Share)
type subtasksType = SubtaskRow[] | null | undefined;