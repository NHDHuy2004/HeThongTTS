import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import type { TasksRow } from "@/types/database";
import { TaskForm } from "./task-form";
import { TasksBoard, type BoardTask } from "./tasks-board";

type TaskRow = TasksRow & {
  internships: {
    interns: { full_name: string } | null;
  } | null;
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

  let tasks: TaskRow[] = [];
  let canCreate = false;
  let internships: { id: string; name: string }[] = [];

  if (role === "admin" || role === "hr") {
    const [{ data }, { data: ipList }] = await Promise.all([
      supabase
        .from("tasks")
        .select("*, internships(interns(full_name))")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("internships")
        .select("id, interns(full_name)")
        .is("deleted_at", null),
    ]);
    tasks = (data ?? []) as TaskRow[];
    internships = toOptions(ipList ?? []);
    canCreate = true;
  } else if (role === "mentor") {
    const { data: mentor } = await supabase
      .from("mentors")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (mentor) {
      const { data: ipList } = await supabase
        .from("internships")
        .select("id, interns(full_name)")
        .eq("mentor_id", mentor.id);
      const { data } = await supabase
        .from("tasks")
        .select("*, internships(interns(full_name))")
        .in(
          "internship_id",
          (ipList ?? []).map((ip) => ip.id),
        )
        .order("created_at", { ascending: false })
        .limit(200);
      tasks = (data ?? []) as TaskRow[];
      internships = toOptions(ipList ?? []);
      canCreate = true;
    }
  } else if (role === "intern") {
    const { data: myIntern } = await supabase
      .from("interns")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (myIntern) {
      const ipList = (
        await supabase.from("internships").select("id").eq("intern_id", myIntern.id)
      ).data;
      if (ipList?.length) {
        const { data } = await supabase
          .from("tasks")
          .select("*, internships(interns(full_name))")
          .in(
            "internship_id",
            ipList.map((ip) => ip.id),
          )
          .order("created_at", { ascending: false })
          .limit(200);
        tasks = (data ?? []) as TaskRow[];
      }
    }
  } else {
    redirect("/dashboard");
  }

  const boardTasks: BoardTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    deadline: t.deadline,
    internships: t.internships,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Công việc"
        description="Giao việc và theo dõi tiến độ thực tập sinh"
        actions={canCreate ? <TaskForm internships={internships} /> : undefined}
      />
      <TasksBoard tasks={boardTasks} />
    </div>
  );
}