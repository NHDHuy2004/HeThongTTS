"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ExportDocxButton({
  evaluationId,
  label = "Xuất Word",
  size = "sm",
  variant = "outline",
}: {
  evaluationId: string;
  label?: string;
  size?: "xs" | "sm" | "default";
  variant?: "default" | "outline" | "secondary" | "ghost";
}) {
  const [pending, setPending] = React.useState(false);

  const download = async () => {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/evaluations/${evaluationId}/docx`);
      if (!res.ok) {
        let message = "Không thể xuất file Word.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) message = body.error;
        } catch {
          // ignore JSON parse failure
        }
        toast.error(message);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      // Ưu tiên filename từ Content-Disposition nếu có
      const cd = res.headers.get("Content-Disposition") ?? "";
      const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(cd);
      let filename = "Phieu_Danh_Gia.docx";
      if (m?.[1]) {
        try {
          filename = decodeURIComponent(m[1].replace(/^"|"$/g, ""));
        } catch {
          filename = m[1];
        }
      }
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Đã tải phiếu đánh giá (.docx).");
    } catch {
      toast.error("Không thể xuất file Word. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      disabled={pending}
      onClick={download}
      title="Tải phiếu đánh giá (.docx)"
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
      {pending ? "Đang tạo file..." : label}
    </Button>
  );
}
