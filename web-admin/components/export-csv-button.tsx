import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Nút xuất CSV dùng chung (trước đây copy-paste ở 5 trang). */
export function ExportCsvButton({
  href,
  className,
}: {
  href: string;
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      nativeButton={false}
      render={<a href={href} />}
    >
      <Download className="size-4" aria-hidden />
      Xuất CSV
    </Button>
  );
}
