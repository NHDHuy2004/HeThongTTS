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
    <div className="flex min-h-svh bg-muted/30">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 md:block">
        <Sidebar role={role} />
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
        <footer className="flex flex-col items-center justify-center gap-1 border-t border-border/60 bg-card px-6 py-3.5 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <span>© Đại học Đà Lạt · Hệ thống Quản lý Thực tập sinh (IMS)</span>
          <span className="text-[11px] font-medium text-primary">Khoa Công nghệ Thông tin</span>
        </footer>
      </div>
    </div>
  );
}