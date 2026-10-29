import Link from "next/link";
import { SearchX } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

/** Trang 404 branded — không để người dùng rơi vào ngõ cụt. */
export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-dashed bg-muted/30 px-6 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20">
          <SearchX className="size-6" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold">Không tìm thấy trang</p>
          <p className="text-sm text-muted-foreground">
            Trang bạn tìm không tồn tại hoặc đã được di chuyển.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard" className={buttonVariants()}>
            Về trang chủ
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}
