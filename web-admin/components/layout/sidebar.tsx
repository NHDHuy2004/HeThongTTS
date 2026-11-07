"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { roleLabel } from "@/features/labels";
import { getNavSections } from "@/features/nav";
import { Badge } from "@/components/ui/badge";

export function Sidebar({ role, onNavigate }: { role: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const sections = getNavSections(role);

  return (
    <nav aria-label="Điều hướng chính" className="flex h-full flex-col justify-between gap-3 p-3 bg-card">
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center gap-3 px-2 pb-3 pt-1">
          <div className="relative shrink-0">
            <Image
              src="/logo-dalat.png"
              alt="Đại học Đà Lạt"
              width={36}
              height={36}
              priority
              className="size-9 rounded-xl bg-card object-contain p-1 ring-1 ring-primary/20"
            />
            <span aria-hidden className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-tight text-foreground">
              IMS Đà Lạt
            </p>
            <div className="mt-0.5">
              <Badge variant="success" className="text-[11px]">
                {roleLabel[role] ?? role}
              </Badge>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pt-1 pr-0.5 [scrollbar-width:thin]">
          {sections.map((section) => (
            <div key={section.title} className="pb-1">
              <p aria-hidden className="px-3 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {section.title}
              </p>
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                          active
                            ? "bg-primary/12 font-semibold text-foreground shadow-xs"
                            : "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
                        )}
                      >
                        {active && (
                          <span aria-hidden className="absolute bottom-1.5 left-0 top-1.5 w-1 rounded-r-md bg-primary" />
                        )}
                        <item.icon
                          aria-hidden
                          className={cn(
                            "size-4 shrink-0 transition-transform group-hover:scale-110 motion-reduce:group-hover:scale-100",
                            active ? "text-primary" : "text-muted-foreground group-hover:text-primary",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-border/60 px-2 pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inline-flex size-full rounded-full bg-primary opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          <span className="font-medium text-primary">Trực tuyến</span>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground/80">v1.0-ims</span>
      </div>
    </nav>
  );
}
