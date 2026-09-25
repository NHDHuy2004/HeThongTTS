import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IMS · Đăng nhập",
  description: "Đăng nhập Hệ thống Quản lý Thực tập",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-svh flex flex-col items-center justify-center p-4 sm:p-8 bg-background overflow-hidden">
      {/* Background ambient decorative glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 size-96 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-96 rounded-full bg-orange-500/10 blur-3xl" />

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="relative">
            <img
              src="/logo-dalat.png"
              alt="Logo Đại học Đà Lạt"
              className="size-16 rounded-2xl bg-white object-contain p-1.5 shadow-md ring-2 ring-emerald-600/20"
            />
            <span className="absolute -bottom-1 -right-1 size-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Hệ thống Quản lý Thực tập
            </h1>
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
              Đại học Đà Lạt · Internship Management System
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
