import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();
  if (!session) redirect("/login");

  const profile = session.profile;
  const role = profile?.role_code ?? "intern";
  const full_name = profile?.full_name ?? session.user.email ?? "";

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-64 shrink-0 border-r bg-muted/20 md:block">
        <div className="sticky top-0 h-svh">
          <Sidebar role={role} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={{
            email: session.user.email ?? "",
            full_name,
            role,
          }}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 space-y-6">
          {children}
        </main>
        <footer className="border-t border-border/60 bg-card px-6 py-3.5 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© Đại học Đà Lạt · Hệ thống Quản lý Thực tập sinh (IMS)</span>
          <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400 font-medium">Khoa Công nghệ Thông tin</span>
        </footer>
      </div>
    </div>
  );
}