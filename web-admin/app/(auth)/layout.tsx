import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IMS · Đăng nhập",
  description: "Đăng nhập Hệ thống Quản lý Thực tập",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4 sm:p-8">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-dalat.png"
            alt="Logo Đại học Đà Lạt"
            className="size-16 rounded-xl bg-white object-contain p-1 shadow-sm ring-1 ring-border"
          />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Hệ thống Quản lý Thực tập
            </h1>
            <p className="text-sm text-muted-foreground">
              Đại học Đà Lạt · Internship Management System
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
