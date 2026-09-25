import { CalendarDays, Mail, MapPin, UserRound, UsersRound, type LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatDateTime, getStatusLabel } from "@/features/labels";
import type { InternsRow, Json } from "@/types/database";
import { ChecklistManager } from "./checklist-manager";
import { DocumentManager, type DocumentCatalogOption } from "./document-manager";
import { EditOnboardingRecordForm } from "./edit-record-form";
import { InternOnboardingProfileForm } from "./intern-profile-form";
import { OnboardingProgress } from "./progress";
import { OnboardingRealtimeRefresh } from "./realtime-refresh";
import { OnboardingRecordActions } from "./record-actions";
import type { NamedOption, OnboardingDetail, SelectOption } from "./types";

export type OnboardingDetailOptions = {
  profiles: NamedOption[];
  documents: DocumentCatalogOption[];
  documentTypes: NamedOption[];
  departments: SelectOption[];
  mentors: SelectOption[];
  hrUsers: NamedOption[];
  intern: InternsRow | null;
};

function changedFields(details: Json) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  const before = details.before;
  const after = details.after;
  if (!before || !after || typeof before !== "object" || typeof after !== "object" || Array.isArray(before) || Array.isArray(after)) return [];
  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]) && !["updated_at"].includes(key),
  );
}

function Info({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value?: string | null }) {
  return (
    <div className="flex gap-3 rounded-lg border bg-card p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></span>
      <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="truncate text-sm font-medium">{value || "—"}</p></div>
    </div>
  );
}

export function OnboardingDetailView({
  detail,
  role,
  currentUserId,
  options,
}: {
  detail: OnboardingDetail;
  role: "admin" | "hr" | "mentor" | "intern";
  currentUserId: string;
  options: OnboardingDetailOptions;
}) {
  const canManage = role === "admin" || role === "hr";
  return (
    <div className="flex flex-col gap-6">
      <OnboardingRealtimeRefresh recordId={detail.id} userId={currentUserId} />
      <PageHeader
        title={`Onboarding ${detail.code}`}
        description={`${detail.intern?.full_name ?? "Thực tập sinh"} · ${detail.batch?.name ?? "Chưa có đợt thực tập"}`}
        actions={
          <>
            {role === "intern" && options.intern ? (
              <InternOnboardingProfileForm intern={options.intern} />
            ) : null}
            {canManage ? <EditOnboardingRecordForm detail={detail} hrUsers={options.hrUsers} departments={options.departments} mentors={options.mentors} /> : null}
            {canManage ? <OnboardingRecordActions detail={detail} /> : null}
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={detail.status} />
              <span className="text-sm text-muted-foreground">Hạn hoàn thành: {formatDate(detail.due_date)}</span>
            </div>
            <OnboardingProgress value={detail.progress_percent} />
            <p className="text-xs text-muted-foreground">Tiến độ tính trên checklist bắt buộc; tài liệu bắt buộc được kiểm tra riêng.</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
              <span>Checklist bắt buộc: {detail.progress.completed_checklists}/{detail.progress.required_checklists}</span>
              <span>Tài liệu bắt buộc: {detail.progress.approved_documents}/{detail.progress.required_documents}</span>
              <span>Hoàn thành: {formatDate(detail.completed_at)}</span>
              <span>Người xác nhận: {detail.completed_by ? "Đã ghi nhận" : "—"}</span>
            </div>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4 text-emerald-900">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Điều kiện hoàn tất</p>
            <p className="mt-1 text-sm font-semibold">{detail.progress.can_complete ? "Đã đủ điều kiện chờ HR xác nhận" : "Còn điều kiện bắt buộc chưa hoàn tất"}</p>
            <p className="mt-1 text-xs">Intern không thể tự chuyển hồ sơ sang trạng thái hoàn tất.</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList className="w-full max-w-2xl">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="documents">Tài liệu</TabsTrigger>
          <TabsTrigger value="activity">Lịch sử</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Info icon={UserRound} label="Thực tập sinh" value={detail.intern?.full_name} />
            <Info icon={Mail} label="Email" value={detail.intern?.email} />
            <Info icon={UsersRound} label="Mentor" value={detail.mentor?.full_name} />
            <Info icon={MapPin} label="Phòng ban" value={detail.department?.name} />
            <Info icon={CalendarDays} label="Ngày bắt đầu" value={formatDate(detail.start_date)} />
            <Info icon={CalendarDays} label="Ngày kết thúc dự kiến" value={formatDate(detail.end_date)} />
            <Info icon={UserRound} label="Người phụ trách" value={detail.assigned_hr?.full_name} />
            <Info icon={CalendarDays} label="Bắt đầu onboarding" value={formatDate(detail.onboarding_start_date)} />
            <Info icon={CalendarDays} label="Hạn hoàn thành" value={formatDate(detail.due_date)} />
          </div>
          {detail.notes ? (
            <Card className="mt-4"><CardHeader><CardTitle>Ghi chú HR</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap text-sm">{detail.notes}</CardContent></Card>
          ) : null}
        </TabsContent>
        <TabsContent value="checklist">
          <ChecklistManager detail={detail} profiles={options.profiles} documents={options.documents} currentUserId={currentUserId} role={role} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentManager detail={detail} catalog={options.documents} documentTypes={options.documentTypes} role={role} />
        </TabsContent>
        <TabsContent value="activity">
          {detail.activity.length ? (
            <div className="overflow-hidden rounded-xl border bg-card">
              {detail.activity.map((item) => {
                const fields = changedFields(item.details);
                return (
                  <div key={item.id} className="flex gap-3 border-b p-4 last:border-0">
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-emerald-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{getStatusLabel(item.action)} {item.entity_type.replaceAll("_", " ")}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.actor?.full_name ?? "Hệ thống"} · {formatDateTime(item.created_at)}</p>
                      {fields.length ? <p className="mt-1 text-xs text-muted-foreground">Các trường thay đổi: {fields.join(", ")}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <EmptyState title="Chưa có lịch sử hiển thị" description="Các thay đổi quan trọng sẽ được ghi lại tại đây." />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
