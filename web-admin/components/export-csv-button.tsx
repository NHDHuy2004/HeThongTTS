import Link from "next/link";
import { Download } from "lucide-react";

import { cn } from "cn";

/** Nút xuất CSV dùng chung (trước đây copy-paste ở 5 trang). */
export function ExportCsvButton({
  href,
  className,
}: {
  href: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent",
        className,
      )}
    >
      <Download className="size-4" />
      Xuất CSV
    </Link>
  );
}
