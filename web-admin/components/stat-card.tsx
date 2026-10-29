import type { LucideIcon } from "lucide-react";

import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Thẻ thống kê dùng chung — thay cho 3 kiểu stat card copy-paste
 * trong dashboard, admin/reports, admin/requests.
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
  tone?: "emerald" | "orange";
  className?: string;
}) {
  const isEmerald = tone === "emerald";
  return (
    <Card
      className={cn(
        "group relative overflow-hidden border border-border/80 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
    >
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-1 transition-all group-hover:h-1.5",
          isEmerald ? "bg-emerald-600" : "bg-orange-500",
        )}
      />
      <CardContent className="flex items-center justify-between p-4 pt-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
        </div>
        {Icon ? (
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-105",
              isEmerald
                ? "bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-400"
                : "bg-orange-500/12 text-orange-700 ring-1 ring-orange-500/20 dark:bg-orange-950/50 dark:text-orange-400",
            )}
          >
            <Icon className="size-5.5" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
