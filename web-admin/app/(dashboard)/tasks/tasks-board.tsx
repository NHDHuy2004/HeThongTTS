"use client";

import { useState } from "react";
import Link from "next/link";
import { Columns3, List } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { assignmentTypeLabel, formatDateTime } from "@/features/labels";
import { cn } from "@/lib/utils";
import { TaskStatusControl } from "./task-status";

export type BoardTask = {
  id: string;
  title: string;
  status: string | null;
  priority: string | null;
  deadline: string | null;
  assignment_type: string | null;
  interns: string;
  assigneeNames: string[];
};

const COLUMNS: { value: string; label: string; accent: string }[] = [
  { value: "not_started", label: "CHƯA LÀM", accent: "bg-muted/60" },
  { value: "in_progress", label: "ĐANG LÀM", accent: "bg-blue-50 dark:bg-blue-950/40" },
  { value: "in_review", label: "CHỜ DUYỆT", accent: "bg-amber-50 dark:bg-amber-950/40" },
  { value: "changes_requested", label: "CẦN SỬA", accent: "bg-orange-50 dark:bg-orange-950/40" },
  { value: "completed", label: "HOÀN THÀNH", accent: "bg-emerald-50 dark:bg-emerald-950/40" },
  { value: "cancelled", label: "ĐÃ HỦY", accent: "bg-muted/60" },
];

export function TasksBoard({ tasks }: { tasks: BoardTask[] }) {
  const [view, setView] = useState<"list" | "kanban">("list");

  const listColumns: Column<BoardTask>[] = [
    {
      key: "title",
      header: "Tiêu đề",
      cell: (r) => (
        <Link href={`/tasks/${r.id}`} className="font-medium underline-offset-4 hover:underline">
          {r.title}
        </Link>
      ),
    },
    {
      key: "assignment_type",
      header: "Loại",
      cell: (r) => {
        const label = assignmentTypeLabel[r.assignment_type ?? "individual"];
        return (
          <Badge variant={r.assignment_type === "team" ? "secondary" : "outline"}>{label}</Badge>
        );
      },
    },
    {
      key: "interns",
      header: "Phụ trách",
      cell: (r) =>
        r.assigneeNames.length > 0 ? r.assigneeNames.join(", ") : r.interns,
    },
    {
      key: "priority",
      header: "Ưu tiên",
      cell: (r) => <StatusBadge value={r.priority ?? "medium"} />,
    },
    { key: "deadline", header: "Hạn", cell: (r) => formatDateTime(r.deadline) },
    {
      key: "status",
      header: "Trạng thái",
      cell: (r) => <StatusBadge value={r.status ?? "not_started"} />,
    },
    {
      key: "actions",
      header: "",
      cell: (r) => <TaskStatusControl id={r.id} status={r.status ?? "not_started"} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Tabs value={view} onValueChange={(v) => setView(v as "list" | "kanban")}>
          <TabsList>
            <TabsTrigger value="list" className="gap-2">
              <List className="size-4" />
              Danh sách
            </TabsTrigger>
            <TabsTrigger value="kanban" className="gap-2">
              <Columns3 className="size-4" />
              Kanban
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === "list" ? (
        <DataTable
          data={tasks}
          columns={listColumns}
          searchKeys={["title", "interns", "assigneeNames"]}
          searchPlaceholder="Tìm theo tiêu đề, tên intern..."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => (t.status ?? "not_started") === col.value);
            return (
              <div
                key={col.value}
                className={cn(
                  "flex min-h-[180px] flex-col gap-3 rounded-xl p-3",
                  col.accent,
                )}
              >
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-semibold">{col.label}</p>
                  <Badge variant="secondary">{colTasks.length}</Badge>
                </div>
                {colTasks.length === 0 ? (
                  <p className="px-1 text-xs text-muted-foreground">Chưa có task nào.</p>
                ) : (
                  colTasks.map((task) => (
                    <Link key={task.id} href={`/tasks/${task.id}`}>
                      <Card className="shadow-sm transition-shadow hover:shadow-md">
                        <CardHeader className="p-3 pb-1">
                          <CardTitle className="text-sm leading-snug">{task.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2 p-3 pt-1">
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="truncate">
                              {task.assigneeNames.length > 0
                                ? task.assigneeNames.join(", ")
                                : task.interns}
                            </span>
                            <StatusBadge value={task.priority ?? "medium"} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Hạn: {formatDateTime(task.deadline)}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}