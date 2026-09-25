import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import type { TasksRow } from "@/types/database";
import { TaskForm } from "./task-form";
import { TasksBoard, type BoardTask } from "./tasks-board";

type TaskRow = TasksRow & {
  internships: { interns: { full_name: string } | null } | null;
  task_assignees: {
    intern_id: string;
    role: string | null;
    interns: { full_name: string } | null;
  }[];
};

type IpOptionRow = {
  id: string;
  interns: { full_name: string } | null;
};

function toOptions(rows: IpOptionRow[]): { id: string; name: string }[] {
  return rows.map((ip) => ({ id: ip.id, name: ip.interns?.full_name ?? "—" }));
}

export default async function TasksPage() {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  const userId = session.user.id;

  const supabase = await createClient();

  const canManage = role === "admin" || role === "hr" || role === "mentor";
  let internships: { id: string; name: string }[] = [];

  if (canManage) {
    // RLS đã giới hạn: admin/hr thấy toàn bộ, mentor thấy intern của mình.
    const { data: ipList } = await supabase
      .from("internships")
      .select("id, interns(full_name)")
      .is("deleted_at", null)
      .order("start_date", { ascending: false });
    internships = toOptions(ipList ?? []);
  } else if (role === "intern") {
    const { data: myIntern } = await supabase
      .from("interns")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!myIntern) redirect("/dashboard");
  } else {
    redirect("/dashboard");
  }

  const { data, error } = await supabase
    .from("tasks")
    .select(
      "*, internships(interns(full_name)), task_assignees(intern_id, role, interns(full_name))",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return <p className="text-sm text-destructive">Lỗi tải danh sách: {error.message}</p>;

  const boardTasks: BoardTask[] = (data ?? []).map((t) => {
    const row = t as unknown as TaskRow;
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      deadline: row.deadline,
      assignment_type: row.assignment_type,
      interns: row.internships?.interns?.full_name ?? "—",
      assigneeNames: (row.task_assignees ?? [])
        .map((a) => a.interns?.full_name)
        .filter((n): n is string => Boolean(n)),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Công việc"
        description="Giao việc và theo dõi tiến độ thực tập sinh"
        actions={canManage ? <TaskForm internships={internships} /> : undefined}
      />
      <TasksBoard tasks={boardTasks} />
    </div>
  );
}