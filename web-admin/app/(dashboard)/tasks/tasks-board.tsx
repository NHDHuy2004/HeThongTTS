"use client";

import { useState } from "react";
import { Columns3, List } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/features/labels";
import { cn } from "@/lib/utils";
import { TaskStatusControl } from "./task-status";

export type BoardTask = {
  id: string;
  title: string;
  status: string | null;
  priority: string | null;
  deadline: string | null;
  internships: { interns: { full_name: string } | null } | null;
};

const COLUMNS: { value: string; label: string; accent: string }[] = [
  { value: "todo", label: "TODO", accent: "bg-muted" },
  { value: "in_progress", label: "IN PROGRESS", accent: "bg-blue-50 dark:bg-blue-950/40" },
  { value: "review", label: "REVIEW", accent: "bg-amber-50 dark:bg-amber-950/40" },
  { value: "done", label: "DONE", accent: "bg-emerald-50 dark:bg-emerald-950/40" },
];

export function TasksBoard({ tasks }: { tasks: BoardTask[] }) {
  const [view, setView] = useState<"list" | "kanban">("list");

  const listColumns: Column<BoardTask>[] = [
    {
      key: "title",
      header: "Tiêu đề",
      cell: (r) => <span className="font-medium">{r.title}</span>,
    },
    {
      key: "internship_id",
      header: "Intern",
      cell: (r) => r.internships?.interns?.full_name ?? "—",
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
      cell: (r) => <StatusBadge value={r.status ?? "todo"} />,
    },
    {
      key: "actions",
      header: "",
      cell: (r) => <TaskStatusControl id={r.id} status={r.status ?? "todo"} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as "list" | "kanban")}
        >
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
          searchKeys={["title", "internships.interns.full_name"]}
          searchPlaceholder="Tìm theo tiêu đề, tên intern..."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => (t.status ?? "todo") === col.value);
            return (
              <div
                key={col.value}
                className={cn("flex min-h-[180px] flex-col gap-3 rounded-xl p-3", col.accent)}
              >
                <div className="flex items-center justify-between px-1">
                  <p className="text-sm font-semibold">{col.label}</p>
                  <Badge variant="secondary">{colTasks.length}</Badge>
                </div>
                {colTasks.length === 0 ? (
                  <p className="px-1 text-xs text-muted-foreground">
                    Chưa có task nào.
                  </p>
                ) : (
                  colTasks.map((task) => (
                    <Card key={task.id} className="shadow-sm">
                      <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-sm leading-snug">
                          {task.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-2 p-3 pt-1">
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="truncate">
                            {task.internships?.interns?.full_name ?? "—"}
                          </span>
                          <StatusBadge value={task.priority ?? "medium"} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Hạn: {formatDateTime(task.deadline)}
                        </p>
                        <div className="pt-1">
                          <TaskStatusControl id={task.id} status={task.status ?? "todo"} />
                        </div>
                      </CardContent>
                    </Card>
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