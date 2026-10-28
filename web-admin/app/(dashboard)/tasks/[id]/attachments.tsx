"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Paperclip, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteTaskAttachment } from "../task-actions";

export type AttachmentRow = {
  id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
};

export function AttachmentsPanel({
  attachments,
  signedUrls,
  canManage,
}: {
  attachments: AttachmentRow[];
  signedUrls: (string | null)[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  if (!attachments.length) return null;

  return (
    <div className="flex flex-col gap-3">
      {attachments.map((a, idx) => {
        const url = signedUrls[idx];
        return (
          <div key={a.id} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-sm font-medium">
                <Paperclip className="size-4" />
                {a.file_name}
                {a.file_size ? (
                  <span className="text-xs text-muted-foreground">
                    {(a.file_size / 1024 / 1024).toFixed(1)} MB
                  </span>
                ) : null}
              </span>
              <div className="flex items-center gap-2">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    Tải xuống
                  </a>
                ) : null}
                {canManage ? (
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const { error } = await deleteTaskAttachment(a.id);
                        if (error) toast.error(error);
                        else {
                          toast.success("Đã xóa file.");
                          router.refresh();
                        }
                      });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
            {url && a.mime_type?.startsWith("video/") ? (
              <video src={url} controls className="max-h-96 w-full rounded-lg bg-black" />
            ) : null}
            {url && a.mime_type?.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={a.file_name} className="max-h-96 rounded-lg object-contain" />
            ) : null}
            {url && a.mime_type === "application/pdf" ? (
              <iframe src={url} className="h-96 w-full rounded-lg border" title={a.file_name} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
