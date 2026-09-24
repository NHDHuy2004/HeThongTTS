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
    <nav className="flex h-full flex-col gap-1 p-2">
      <div className="flex items-center gap-2 px-2 pb-3 pt-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-dalat.png"
          alt="Đại học Đà Lạt"
          className="size-8 shrink-0 rounded-lg bg-white object-contain p-0.5 ring-1 ring-border"
        />
        {!compact ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              Hệ thống Quản lý Thực tập
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {roleLabel[role] ?? role}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              <span className={cn("truncate", compact && "hidden")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}