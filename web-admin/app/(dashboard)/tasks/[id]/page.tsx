import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/status-badge";
import {
  assignmentTypeLabel,
  deliverableKindLabel,
  formatDateTime,
} from "@/features/labels";
import { TaskStatusControl } from "../task-status";
import { SubtasksPanel } from "./subtasks";
import { SubmissionsPanel } from "./submissions";
import { ReviewsPanel } from "./reviews";
import { AttachmentsPanel } from "./attachments";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  const { id } = await params;

  const supabase = await createClient();

  // 5 query độc lập (chỉ cần id) chạy song song; profiles phụ thuộc
  // reviews+submissions nên chạy sau.
  const internIdPromise =
    role === "intern"
      ? supabase
          .from("interns")
          .select("id")
          .eq("user_id", session.profile?.id ?? "")
          .maybeSingle()
      : Promise.resolve({ data: null });

  const [
    taskRes,
    reviewsRes,
    submissionsRes,
    subtasksRes,
    attachmentsRes,
    meRes,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "*, internships(id, interns(full_name)), task_assignees(intern_id, role, interns(full_name))",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("task_reviews")
      .select("*")
      .eq("task_id", id)
      .order("reviewed_at", { ascending: false }),
    supabase
      .from("task_submissions")
      .select("*, task_submission_files(*), task_submission_links(*)")
      .eq("task_id", id)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("task_subtasks")
      .select("*")
      .eq("task_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("task_attachments")
      .select("*")
      .eq("task_id", id)
      .order("created_at", { ascending: true }),
    internIdPromise,
  ]);

  const task = taskRes.data;
  if (taskRes.error || !task) notFound();

  const reviews = reviewsRes.data ?? [];
  const submissions = submissionsRes.data ?? [];
  const subtasks = subtasksRes.data ?? [];
  const attachments = attachmentsRes.data ?? [];

  const personIds = Array.from(
    new Set([
      ...reviews.map((r) => r.reviewer_id),
      ...submissions.map((s) => s.submitted_by),
    ]),
  );
  const { data: profilesData = [] } = personIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", personIds)
    : { data: [] };
  const profiles = profilesData ?? [];
  const nameOf = (uid: string | null) =>
    uid ? profiles.find((p) => p.id === uid)?.full_name ?? "—" : "—";

  const signed = await Promise.all(
    attachments.map(async (a) =>
      (await supabase.storage.from("task-attachments").createSignedUrl(a.file_path, 3600)).data
        ?.signedUrl ?? null,
    ),
  );
  const canReview = role === "admin" || role === "hr" || role === "mentor";
  const canManage = canReview;

  const assignees = task.task_assignees ?? [];

  // Intern hiện tại (để lọc phần việc của họ)
  const myInternId: string | null = meRes.data?.id ?? null;

  // Thống kê theo từng intern trên chính task này
  const perIntern = new Map<
    string,
    { name: string; total: number; completed: number; inProgress: number; overdue: number; changes: number }
  >();
  for (const s of subtasks) {
    if (!s.assignee_id) continue;
    const name =
      assignees.find((a) => a.intern_id === s.assignee_id)?.interns?.full_name ?? "—";
    const cur = perIntern.get(s.assignee_id) ?? {
      name, total: 0, completed: 0, inProgress: 0, overdue: 0, changes: 0,
    };
    cur.total += 1;
    if (s.status === "completed") cur.completed += 1;
    if (s.status === "in_progress") cur.inProgress += 1;
    if (s.status === "changes_requested") cur.changes += 1;
    if (
      s.due_date &&
      s.status !== "completed" &&
      s.status !== "cancelled" &&
      // eslint-disable-next-line react-hooks/purity
      new Date(s.due_date).getTime() < Date.now()
    ) {
      cur.overdue += 1;
    }
    perIntern.set(s.assignee_id, cur);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={task.title}
        description={`Task · ${assignmentTypeLabel[task.assignment_type ?? "individual"]}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge value={task.priority ?? "medium"} />
            <StatusBadge value={task.status} />
          </div>
        }
      />

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Chuyển trạng thái</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskStatusControl id={task.id} status={task.status ?? "not_started"} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tiến độ tổng thể</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, Math.max(0, Number(task.progress ?? 0)))}%` }}
              />
            </div>
            <span className="w-12 text-right text-sm font-semibold">{Number(task.progress ?? 0)}%</span>
          </div>
          {canManage && perIntern.size > 0 ? (
            <div className="mt-2 flex flex-col gap-1 text-sm">
              {Array.from(perIntern.values()).map((p) => (
                <div key={p.name} className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span className="w-36 font-medium text-foreground">{p.name}</span>
                  <span>{p.total} task</span>
                  <span className="text-emerald-600">{p.completed} xong</span>
                  <span className="text-blue-600">{p.inProgress} đang làm</span>
                  {p.changes > 0 ? <span className="text-amber-600">{p.changes} cần sửa</span> : null}
                  {p.overdue > 0 ? <span className="text-red-600">{p.overdue} quá hạn</span> : null}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-3">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Thông tin công việc</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
              <Info label="Dự án / Module" value={`${task.project ?? "—"} / ${task.module ?? "—"}`} />
              <Info label="Loại task" value={task.task_type} />
              <Info label="Intern chính" value={task.internships?.interns?.full_name} />
              <Info
                label="Thành viên"
                value={
                  assignees.length
                    ? assignees
                        .map(
                          (a) =>
                            `${a.interns?.full_name ?? "—"}${
                              a.role && a.role !== "assignee" ? ` (${a.role})` : ""
                            }`,
                        )
                        .join(", ")
                    : "—"
                }
              />
              <Info label="Bắt đầu" value={formatDateTime(task.start_date)} />
              <Info label="Hạn chót" value={formatDateTime(task.deadline)} />
              <Info
                label="Deliverable"
                value={
                  (task.deliverables as string[] | null)?.length
                    ? (task.deliverables as string[])
                        .map((d) => deliverableKindLabel[d] ?? d)
                        .join(", ")
                    : "—"
                }
              />
              <Info
                label="Giờ dự kiến"
                value={task.estimated_hours != null ? `${task.estimated_hours}h` : "—"}
              />
            </CardContent>
          </Card>

          {task.objective || task.requirements || task.acceptance_criteria ? (
            <Card>
              <CardHeader>
                <CardTitle>Yêu cầu</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Section title="Mục tiêu" value={task.objective} />
                <Section title="Yêu cầu chi tiết" value={task.requirements} />
                <Section title="Tiêu chí nghiệm thu" value={task.acceptance_criteria} />
              </CardContent>
            </Card>
          ) : null}

          {task.description ? (
            <Card>
              <CardHeader>
                <CardTitle>Mô tả</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>
              </CardContent>
            </Card>
          ) : null}

          {attachments.length ? (
            <Card>
              <CardHeader>
                <CardTitle>📚 File giao việc</CardTitle>
              </CardHeader>
              <CardContent>
                <AttachmentsPanel attachments={attachments} signedUrls={signed} canManage={canManage} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Separator />

      <SubtasksPanel
        taskId={id}
        subtasks={subtasks}
        assignees={assignees}
        canManage={canManage}
        isIntern={role === "intern"}
        myInternId={myInternId}
      />

      <SubmissionsPanel
        taskId={id}
        submissions={submissions}
        subtasks={subtasks}
        nameOf={nameOf}
        canManage={canManage}
        isIntern={role === "intern"}
      />

      <ReviewsPanel
        taskId={id}
        reviews={reviews}
        submissions={submissions}
        nameOf={nameOf}
        canReview={canReview}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={value ? "font-medium" : "font-medium text-muted-foreground"}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function Section({ title, value }: { title: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <p className="whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

export function TaskRoleBadge({ role }: { role: string | null | undefined }) {
  if (!role || role === "assignee") return <Badge variant="outline">Thành viên</Badge>;
  return <Badge variant={role === "lead" ? "default" : "secondary"}>{role}</Badge>;
}