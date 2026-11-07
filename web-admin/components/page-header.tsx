import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/40 pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />
          <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        </div>
        {description ? (
          <p className="pl-4.5 text-xs text-muted-foreground sm:text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className={cn("flex flex-wrap items-center gap-2 sm:justify-end")}>{actions}</div>
      ) : null}
    </div>
  );
}