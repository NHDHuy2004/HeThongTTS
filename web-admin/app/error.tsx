"use client";

import { useRouter } from "next/navigation";
import { RefreshCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Error boundary cấp app — thông báo thân thiện + thử lại. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-dashed bg-muted/30 px-6 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
          <TriangleAlert className="size-6" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold">Đã xảy ra lỗi</p>
          <p className="text-sm text-muted-foreground">
            Không thể tải trang này. Vui lòng thử lại — nếu vẫn lỗi, hãy quay về
            trang chủ.
          </p>
        </div>
        {error.digest ? (
          <p className="font-mono text-[11px] text-muted-foreground/70">
            Mã lỗi: {error.digest}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button onClick={reset}>
            <RefreshCcw />
            Thử lại
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard")}
          >
            Về trang chủ
          </Button>
        </div>
      </div>
    </div>
  );
}
