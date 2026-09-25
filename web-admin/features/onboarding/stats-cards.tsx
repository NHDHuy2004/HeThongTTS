import { AlertTriangle, CheckCircle2, CircleDashed, Clock3, FileWarning, Layers3 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { OnboardingStats } from "./types";

const cardStyles = [
  { key: "total" as const, label: "Tổng hồ sơ", icon: Layers3, className: "text-sky-600 bg-sky-50" },
  { key: "not_started" as const, label: "Chưa bắt đầu", icon: CircleDashed, className: "text-slate-600 bg-slate-100" },
  { key: "in_progress" as const, label: "Đang thực hiện", icon: Clock3, className: "text-amber-600 bg-amber-50" },
  { key: "pending_review" as const, label: "Chờ kiểm tra", icon: FileWarning, className: "text-orange-600 bg-orange-50" },
  { key: "needs_revision" as const, label: "Cần bổ sung", icon: AlertTriangle, className: "text-red-600 bg-red-50" },
  { key: "completed" as const, label: "Đã hoàn tất", icon: CheckCircle2, className: "text-emerald-600 bg-emerald-50" },
  { key: "overdue" as const, label: "Quá hạn", icon: AlertTriangle, className: "text-red-600 bg-red-50" },
];

export function OnboardingStatsCards({ stats }: { stats: OnboardingStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      {cardStyles.map(({ key, label, icon: Icon, className }) => (
        <Card key={key} size="sm">
          <CardContent className="flex items-center gap-3">
            <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${className}`}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xl font-bold tabular-nums">{stats[key]}</p>
              <p className="truncate text-xs text-muted-foreground">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
