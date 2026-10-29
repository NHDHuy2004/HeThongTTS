"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, CornerDownLeft, Search } from "lucide-react";

import { cn } from "cn";
import { getNavItems, type NavItem } from "@/features/nav";

/**
 * Command palette ⌘K / Ctrl+K — tìm trang theo menu của role hiện tại.
 * Không thêm dependency: overlay + input + lọc mảng nav items.
 */
export function CommandPalette({ role }: { role: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const items = React.useMemo(() => getNavItems(role), [role]);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q),
    );
  }, [items, query]);

  // Clamp active theo kết quả hiện tại (không cần effect reset).
  const safeActive = Math.min(active, Math.max(0, results.length - 1));

  function openPalette() {
    setQuery("");
    setActive(0);
    setOpen(true);
    // Focus sau khi render frame — tránh mất focus do animation.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setActive(0);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(item: NavItem) {
    setOpen(false);
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[safeActive]) {
      e.preventDefault();
      go(results[safeActive]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="hidden h-8 items-center gap-2 rounded-lg border border-input bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent md:flex"
        aria-label="Tìm trang (⌘K)"
      >
        <Search className="size-3.5" />
        <span>Tìm trang...</span>
        <kbd className="pointer-events-none rounded border bg-muted px-1.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Tìm trang"
            className="w-full max-w-lg overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nhập tên trang cần tới..."
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                Esc
              </kbd>
            </div>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Không tìm thấy trang phù hợp.
                </p>
              ) : (
                results.map((item, i) => (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => go(item)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      i === safeActive ? "bg-emerald-500/12 text-emerald-900 dark:text-emerald-200" : "",
                    )}
                  >
                    <item.icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {item.href}
                    </span>
                    {i === safeActive ? (
                      <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : null}
                  </button>
                ))
              )}
            </div>
            <div className="flex items-center gap-3 border-t bg-muted/40 px-3 py-1.5 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <ArrowUp className="size-3" /> <ArrowUp className="size-3 rotate-180" /> di chuyển
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft className="size-3" /> mở trang
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
