import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IMS · Đăng nhập",
  description: "Đăng nhập Hệ thống Quản lý Thực tập",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4 sm:p-8">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="font-semibold tracking-tight">IMS</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Hệ thống Quản lý Thực tập
          </h1>
        </div>
        {children}
      </div>
    </div>
  );
}
