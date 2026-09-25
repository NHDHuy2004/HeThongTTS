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

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  const { id } = await params;

  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select(
      "*, internships(id, interns(full_name)), task_assignees(intern_id, role, interns(full_name))",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !task) notFound();

  const { data: reviewsData = [] } = await supabase
    .from("task_reviews")
    .select("*")
    .eq("task_id", id)
    .order("reviewed_at", { ascending: false });
  const reviews = reviewsData ?? [];

  const submissionsData =
    await supabase.from("task_submissions")
      .select("*, task_submission_files(*), task_submission_links(*)")
      .eq("task_id", id)
      .order("submitted_at", { ascending: false });
  const submissions = submissionsData.data ?? [];

  const subtasksData =
    await supabase.from("task_subtasks")
      .select("*")
      .eq("task_id", id)
      .order("created_at", { ascending: true });
  const subtasks = subtasksData.data ?? [];

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

  const { data: attachmentsData = [] } = await supabase
    .from("task_attachments")
    .select("*")
    .eq("task_id", id)
    .order("created_at", { ascending: true });
  const attachments = attachmentsData ?? [];

  const signed = await Promise.all(
    attachments.map(async (a) =>
      (await supabase.storage.from("task-attachments").createSignedUrl(a.file_path, 3600)).data
        ?.signedUrl ?? null,
    ),
  );
  const urlOf = (idx: number) => signed[idx] ?? null;

  const canReview = role === "admin" || role === "hr" || role === "mentor";
  const canManage = canReview;

  const assignees = task.task_assignees ?? [];

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
                <CardTitle>File giao việc</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {attachments.map((a, idx) => {
                  const url = urlOf(idx);
                  return url ? (
                    <a
                      key={a.id}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary underline-offset-4 hover:underline"
                    >
                      📎 {a.file_name}
                    </a>
                  ) : (
                    <span key={a.id} className="text-sm">
                      📎 {a.file_name}
                    </span>
                  );
                })}
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