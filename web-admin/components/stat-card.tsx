import type { LucideIcon } from "lucide-react";

import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Thẻ thống kê dùng chung — thay cho 3 kiểu stat card copy-paste
 * trong dashboard, admin/reports, admin/requests.
 * `tone` tương thích ngược: emerald -> success, orange -> warning.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "emerald",
  className,
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  tone?: "emerald" | "orange" | "success" | "warning" | "info";
  className?: string;
}) {
  const isWarning = tone === "orange" || tone === "warning";
  const isInfo = tone === "info";
  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "absolute left-0 right-0 top-0 h-1 transition-all group-hover:h-1.5",
          isWarning ? "bg-warning" : isInfo ? "bg-info" : "bg-primary",
        )}
      />
      <CardContent className="flex items-center justify-between gap-3 p-4 pt-5">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs font-semibold tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
        </div>
        {Icon ? (
          <div
            aria-hidden
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-105 motion-reduce:group-hover:scale-100",
              isWarning
                ? "bg-warning/12 text-warning ring-1 ring-warning/20 dark:text-warning"
                : isInfo
                  ? "bg-info/12 text-info ring-1 ring-info/20 dark:text-info"
                  : "bg-primary/12 text-primary ring-1 ring-primary/20",
            )}
          >
            <Icon className="size-5.5" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
