"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { roleLabel } from "@/features/labels";
import { getNavItems } from "@/features/nav";

export function Sidebar({
  role,
  compact = false,
}: {
  role: string;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const items = getNavItems(role);

  return (
    <nav className="flex h-full flex-col justify-between p-3 bg-card border-r border-border/80">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 px-2 pb-3 pt-1 border-b border-border/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="relative">
            <img
              src="/logo-dalat.png"
              alt="Đại học Đà Lạt"
              className="size-9 shrink-0 rounded-xl bg-white object-contain p-1 shadow-sm ring-1 ring-emerald-600/20"
            />
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
          {!compact ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground tracking-tight">
                IMS Đà Lạt
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-semibold rounded-md bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {roleLabel[role] ?? role}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-1 overflow-y-auto pt-2">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-emerald-500/12 text-emerald-900 font-semibold shadow-xs dark:bg-emerald-500/20 dark:text-emerald-200"
                    : "text-muted-foreground hover:bg-emerald-500/8 hover:text-emerald-900 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-md bg-emerald-600" />
                )}
                <item.icon
                  className={cn(
                    "size-4 shrink-0 transition-transform group-hover:scale-110",
                    active
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
                  )}
                />
                <span className={cn("truncate", compact && "hidden")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {!compact && (
        <div className="mt-auto pt-3 border-t border-border/60 px-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
            </span>
            <span className="font-medium text-emerald-700 dark:text-emerald-400">Trực tuyến</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground/80">v1.0-ims</span>
        </div>
      )}
    </nav>
  );
}