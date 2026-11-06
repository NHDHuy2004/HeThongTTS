"use client";

import * as React from "react";
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
import { validateTaskFile } from "../task-files";
import type { SubtaskRow } from "./subtasks";

// Upload qua REST API để theo dõi tiến độ thật
async function uploadToStorageWithProgress(
  path: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/task-submissions/${path}`;

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({});
      else resolve({ error: xhr.responseText || `HTTP ${xhr.status}` });
    };
    xhr.onerror = () => resolve({ error: "Lỗi mạng khi upload." });
    xhr.send(file);
  });
}

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
  task_submission_files: { id: string; file_path: string; file_name: string; mime_type: string | null }[];
  task_submission_links: { id: string; title: string | null; url: string }[];
};

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
  const [pending, setPending] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploads, setUploads] = React.useState<
    Record<string, { progress: number; status: "uploading" | "done" | "error"; error?: string }>
  >({});
  const [pendingUrl, setPendingUrl] = React.useState<Record<string, string>>({});
  const router = useRouter();
  const supabase = createClient();

  const sign = async (path: string) => {
    if (pendingUrl[path]) return;
    setPendingUrl((p) => ({ ...p, [path]: "loading" }));
    const { data } = await supabase.storage
      .from("task-submissions")
      .createSignedUrl(path, 3600);
    setPendingUrl((p) => ({ ...p, [path]: data?.signedUrl ?? "" }));
  };

  // Upload trực tiếp từ trình duyệt → có progress thật
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploadError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    for (const f of files) {
      const err = validateTaskFile(f);
      if (err) {
        setUploadError(`${f.name}: ${err}`);
        return;
      }
    }

    setPending(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Chưa đăng nhập.");

      // submission_no
      const { data: last } = await supabase
        .from("task_submissions")
        .select("submission_no")
        .eq("task_id", taskId)
        .order("submission_no", { ascending: false })
        .limit(1)
        .maybeSingle();

      const subtaskId = (formData.get("subtask_id") as string) || null;
      const { data: submission, error } = await supabase
        .from("task_submissions")
        .insert({
          task_id: taskId,
          subtask_id: subtaskId || null,
          submitted_by: userId,
          work_summary: (formData.get("work_summary") as string) ?? null,
          implementation_details: (formData.get("implementation_details") as string) ?? null,
          problems: (formData.get("problems") as string) ?? null,
          solutions: (formData.get("solutions") as string) ?? null,
          notes: (formData.get("notes") as string) ?? null,
          submission_no: ((last?.submission_no as number) ?? 0) + 1,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      // Links
      const validLinks = links.filter((l) => l.url.trim());
      if (validLinks.length) {
        const rows = validLinks.map((l) => ({
          submission_id: submission.id,
          title: l.title.trim() || null,
          url: l.url.trim(),
        }));
        const { error: le } = await supabase.from("task_submission_links").insert(rows);
        if (le) throw new Error(le.message);
      }

      // Files với progress
      for (const f of files) {
        const kind = f.type.startsWith("video/")
          ? "videos"
          : f.type.startsWith("image/")
            ? "images"
            : "documents";
        const safeName = f.name.replace(/[^\w.\-]+/g, "_");
        // eslint-disable-next-line react-hooks/purity
        const path = `${taskId}/${submission.id}/${kind}/${Date.now()}-${safeName}`;
        setUploads((u) => ({ ...u, [f.name]: { progress: 0, status: "uploading" } }));
        const result = await uploadToStorageWithProgress(path, f, (pct) =>
          setUploads((u) => ({ ...u, [f.name]: { progress: pct, status: "uploading" } })),
        );
        if (result.error) {
          setUploads((u) => ({ ...u, [f.name]: { progress: 0, status: "error", error: result.error } }));
          throw new Error(`${f.name}: ${result.error}`);
        }
        setUploads((u) => ({ ...u, [f.name]: { progress: 100, status: "done" } }));
        const { error: fe } = await supabase.from("task_submission_files").insert({
          submission_id: submission.id,
          file_path: path,
          file_name: f.name,
          mime_type: f.type || null,
          file_size: f.size,
          file_type: f.type.startsWith("video/") ? "video" : f.type.startsWith("image/") ? "image" : "document",
          uploaded_by: userId,
        });
        if (fe) throw new Error(fe.message);
      }

      toast.success("Đã nộp bài, chờ mentor đánh giá.");
      setShowForm(false);
      setLinks([{ title: "", url: "" }]);
      setFiles([]);
      setUploads({});
      router.refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Lỗi nộp bài.");
    } finally {
      setPending(false);
    }
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
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border p-3">
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
              <Label htmlFor="sub_files">File nộp (source, screenshot, doc, video...)</Label>
              <Input
                id="sub_files"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              {files.length ? (
                <div className="flex flex-col gap-2">
                  {files.map((f) => {
                    const up = uploads[f.name];
                    return (
                      <div key={f.name} className="rounded-lg border p-2">
                        <div className="flex items-center gap-2">
                          {f.type.startsWith("video/") ? (
                            <video
                              src={URL.createObjectURL(f)}
                              controls
                              className="h-24 w-40 rounded bg-black"
                            />
                          ) : f.type.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={URL.createObjectURL(f)}
                              alt={f.name}
                              className="h-16 w-16 rounded object-cover"
                            />
                          ) : (
                            <Paperclip className="size-5 text-muted-foreground" />
                          )}
                          <div className="flex flex-1 flex-col">
                            <span className="text-sm font-medium">{f.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {(f.size / 1024 / 1024).toFixed(1)} MB
                            </span>
                          </div>
                          {up?.status === "done" ? (
                            <span className="text-xs text-emerald-600">✓ Xong</span>
                          ) : null}
                          {up?.status === "error" ? (
                            <span className="text-xs text-destructive">✕ {up.error}</span>
                          ) : null}
                        </div>
                        {up?.status === "uploading" ? (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${up.progress}%` }}
                              />
                            </div>
                            <span className="w-10 text-right text-xs">{up.progress}%</span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}

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
                        <div key={f.id} className="w-full">
                          {f.mime_type?.startsWith("video/") ? (
                            <video src={url} controls className="max-h-64 w-full rounded-lg bg-black" />
                          ) : f.mime_type?.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt={f.file_name} className="max-h-64 rounded-lg object-contain" />
                          ) : f.mime_type === "application/pdf" ? (
                            <iframe src={url} className="h-64 w-full rounded-lg border" title={f.file_name} />
                          ) : null}
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-primary"
                          >
                            <Paperclip className="size-3" />
                            {f.file_name}
                          </a>
                        </div>
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