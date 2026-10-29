import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton cho dashboard: header + stat cards + bảng gần đúng hình dáng thật. */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-between p-4 pt-5">
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-16" />
              </div>
              <Skeleton className="size-11 rounded-xl" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-3 p-4">
              <Skeleton className="h-4 w-40" />
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** Skeleton cho trang danh sách: header + bộ lọc + bảng. */
export function TableSkeleton({ withFilters = true }: { withFilters?: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {withFilters ? (
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-full max-w-xs" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b bg-muted/40 px-4 py-3">
          <Skeleton className="h-3 w-full" />
        </div>
        <div className="flex flex-col divide-y divide-border/50">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
