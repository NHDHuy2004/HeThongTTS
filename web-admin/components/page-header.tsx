import type { ReactNode } from "react";

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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border/40">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <span className="size-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        </div>
        {description ? (
          <p className="text-xs sm:text-sm text-muted-foreground pl-4.5">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}