import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EvaluationsTable, type EvalRow } from "./evaluations-table";
import { evaluationTypeLabel } from "@/features/labels";

type Filters = {
  batch?: string;
  department?: string;
  type?: string;
  status?: string;
};

function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
      >
        <option value="">Tất cả</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const session = await requireAuth();
  const role = session.profile?.role_code ?? "intern";
  const userId = session.user.id;

  const supabase = await createClient();
  const filters = await searchParams;

  // --- Scope theo vai trò (RLS vẫn enforcing, đây là filter nghiệp vụ) ---
  let internshipIds: string[] | null = null; // null = không giới hạn (admin/hr)
  if (role === "mentor") {
    const { data: mentor } = await supabase.from("mentors").select("id").eq("user_id", userId).maybeSingle();
    if (mentor) {
      const { data: ipList } = await supabase
        .from("internships")
        .select("id, batch_id, department_id, interns(full_name, student_code)")
        .eq("mentor_id", mentor.id)
        .is("deleted_at", null);
      internshipIds = (ipList ?? []).map((ip) => ip.id);
    } else {
      internshipIds = [];
    }
  } else if (role === "intern") {
    const { data: myIntern } = await supabase.from("interns").select("id").eq("user_id", userId).maybeSingle();
    if (myIntern) {
      const { data: ipList } = await supabase.from("internships").select("id").eq("intern_id", myIntern.id).is("deleted_at", null);
      internshipIds = (ipList ?? []).map((ip) => ip.id);
    } else {
      internshipIds = [];
    }
  } else if (role !== "admin" && role !== "hr") {
    redirect("/dashboard");
  }

  const canManage = role === "admin" || role === "hr" || role === "mentor";

  // --- Lấy options cho bộ lọc (batches / departments) ---
  let batches: Array<{ id: string; name: string }> = [];
  let departments: Array<{ id: string; name: string }> = [];
  if (canManage) {
    const [{ data: b }, { data: d }] = await Promise.all([
      supabase.from("internship_batches").select("id, name").order("created_at", { ascending: false }).limit(100),
      supabase.from("departments").select("id, name").eq("is_active", true).order("name").limit(100),
    ]);
    batches = (b ?? []) as Array<{ id: string; name: string }>;
    departments = (d ?? []) as Array<{ id: string; name: string }>;
  }

  // --- Thống kê theo phạm vi (sau lọc batch/department nếu có) ---
  // Tổng internships trong scope và có bao nhiêu intern đã có ít nhất 1 phiếu.
  let totalInternships = 0;
  let evaluatedInternships = 0;
  if (canManage || role === "intern") {
    let scopeQuery = supabase.from("internships").select("id").is("deleted_at", null);
    if (filters.batch) scopeQuery = scopeQuery.eq("batch_id", filters.batch);
    if (filters.department) scopeQuery = scopeQuery.eq("department_id", filters.department);
    if (internshipIds !== null) {
      if (internshipIds.length === 0) {
        // giữ 0
      } else {
        scopeQuery = scopeQuery.in("id", internshipIds);
      }
    }
    const { data: scopeIps } = await scopeQuery.limit(2000);
    const scopeIds = (scopeIps ?? []).map((ip) => ip.id);
    totalInternships = scopeIds.length;
    if (scopeIds.length > 0) {
      const { data: evalIps } = await supabase.from("evaluations").select("internship_id").in("internship_id", scopeIds);
      evaluatedInternships = new Set((evalIps ?? []).map((e) => e.internship_id)).size;
    }
    if (internshipIds !== null && internshipIds.length === 0) {
      totalInternships = 0;
      evaluatedInternships = 0;
    }
  }
  const notEvaluated = Math.max(0, totalInternships - evaluatedInternships);

  // --- Danh sách phiếu theo filter ---
  let rows: EvalRow[] = [];
  if (internshipIds === null || internshipIds.length > 0) {
    let query = supabase
      .from("evaluations")
      .select(
        "*, internships(interns(full_name, student_code), departments(name), internship_batches(name), mentors(full_name)), profiles!evaluations_reviewer_id_fkey(full_name)",
      )
      .order("updated_at", { ascending: false })
      .limit(200);

    if (internshipIds !== null) query = query.in("internship_id", internshipIds);
    if (filters.type) query = query.eq("type", filters.type as "weekly" | "midterm" | "final" | "feedback_360");
    if (filters.status) query = query.eq("status", filters.status);
    // Lọc đợt / phòng ban phải qua internship_id
    if (filters.batch || filters.department) {
      let ipQuery = supabase.from("internships").select("id").is("deleted_at", null);
      if (filters.batch) ipQuery = ipQuery.eq("batch_id", filters.batch);
      if (filters.department) ipQuery = ipQuery.eq("department_id", filters.department);
      if (internshipIds !== null) ipQuery = ipQuery.in("id", internshipIds);
      const { data: filteredIps } = await ipQuery.limit(2000);
      const ids = (filteredIps ?? []).map((ip) => ip.id);
      if (ids.length === 0) {
        rows = [];
      } else {
        const { data } = await query.in("internship_id", ids);
        rows = (data ?? []) as unknown as EvalRow[];
      }
    } else {
      const { data } = await query;
      rows = (data ?? []) as unknown as EvalRow[];
    }
  }

  const hasFilter = Boolean(filters.batch || filters.department || filters.type || filters.status);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Đánh giá thực tập sinh"
        description="Theo dõi tiến độ chấm điểm, xem chi tiết và xuất phiếu Word (.docx) cho từng kỳ đánh giá."
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Link href="/evaluations/new">
                <Button size="sm">
                  <Plus className="size-4" aria-hidden />
                  Tạo đánh giá
                </Button>
              </Link>
            </div>
          ) : undefined
        }
      />

      <section aria-label="Tóm tắt" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="text-xs text-muted-foreground">Tổng số thực tập sinh (trong phạm vi lọc)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{totalInternships}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="text-xs text-muted-foreground">Đã có phiếu đánh giá</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">{evaluatedInternships}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="text-xs text-muted-foreground">Chưa có phiếu đánh giá</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-600">{notEvaluated}</p>
        </div>
      </section>

      {canManage ? (
        <form
          method="get"
          className="grid grid-cols-2 gap-3 rounded-xl border border-border/70 bg-card p-4 md:grid-cols-5"
          aria-label="Bộ lọc danh sách đánh giá"
        >
          <FilterSelect
            label="Đợt thực tập"
            name="batch"
            value={filters.batch}
            options={batches.map((b) => ({ value: b.id, label: b.name }))}
          />
          <FilterSelect
            label="Phòng ban"
            name="department"
            value={filters.department}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
          />
          <FilterSelect
            label="Loại đánh giá"
            name="type"
            value={filters.type}
            options={Object.entries(evaluationTypeLabel).map(([v, l]) => ({ value: v, label: l }))}
          />
          <FilterSelect
            label="Trạng thái"
            name="status"
            value={filters.status}
            options={[
              { value: "draft", label: "Nháp" },
              { value: "submitted", label: "Đã nộp" },
              { value: "reviewed", label: "Đã review" },
              { value: "finalized", label: "Đã chốt điểm" },
            ]}
          />
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm" variant="outline" className="flex-1">
              Áp dụng
            </Button>
            {hasFilter ? (
              <Link
                href="/evaluations"
                className="inline-flex h-8 items-center rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Xóa lọc
              </Link>
            ) : null}
          </div>
        </form>
      ) : null}

      <section aria-label="Danh sách phiếu đánh giá" className="rounded-xl border border-border/70 bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Danh sách phiếu đánh giá ({rows.length})</h2>
          <p className="text-xs text-muted-foreground">
            Mở <span className="font-medium">Chi tiết</span> để chấm điểm, xem lịch sử và xuất Word. Tìm kiếm theo MSSV / họ tên trong ô tìm kiếm của bảng.
          </p>
        </div>
        <EvaluationsTable data={rows} canDownload />
      </section>
    </div>
  );
}
