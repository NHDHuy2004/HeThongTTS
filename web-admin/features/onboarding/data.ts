import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  DocumentsRow,
  InternsRow,
  OnboardingActivityLogsRow,
  OnboardingChecklistItemsRow,
  OnboardingChecklistTemplatesRow,
  OnboardingDocumentTypesRow,
  OnboardingDocumentVersionsRow,
  OnboardingDocumentsRow,
  OnboardingRecordStatus,
  OnboardingRecordsRow,
  NotificationsRow,
  UserRole,
} from "@/types/database";
import {
  ONBOARDING_RECORD_STATUSES,
} from "./constants";
import type {
  NamedOption,
  OnboardingChecklistView,
  OnboardingDetail,
  OnboardingDocumentView,
  OnboardingListRecord,
  OnboardingStats,
  SelectOption,
} from "./types";

export type OnboardingListFilters = {
  q?: string;
  status?: string;
  batchId?: string;
  departmentId?: string;
  startFrom?: string;
  startTo?: string;
  sort?: string;
  direction?: string;
  page?: number;
};

export type OnboardingRecordOption = {
  id: string;
  label: string;
  intern: SelectOption;
  batch: SelectOption;
  department: SelectOption | null;
  mentor: SelectOption | null;
  start_date: string | null;
  end_date: string | null;
};

export type OnboardingPageData = {
  records: OnboardingListRecord[];
  total: number;
  page: number;
  pageSize: number;
  filters: OnboardingListFilters;
  stats: OnboardingStats;
  batches: SelectOption[];
  departments: SelectOption[];
};

function single<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function isRecordStatus(value?: string): value is OnboardingRecordStatus {
  return ONBOARDING_RECORD_STATUSES.includes(value as (typeof ONBOARDING_RECORD_STATUSES)[number]);
}

function emptyStats(): OnboardingStats {
  return {
    total: 0,
    not_started: 0,
    in_progress: 0,
    pending_review: 0,
    needs_revision: 0,
    completed: 0,
    cancelled: 0,
    overdue: 0,
    completion_rate: 0,
    by_batch: [],
    by_department: [],
    incomplete: [],
  };
}

export async function loadOnboardingPage(
  role: UserRole,
  rawFilters: OnboardingListFilters,
): Promise<OnboardingPageData> {
  if (role === "intern") throw new Error("PERMISSION_DENIED");
  const supabase = await createClient();
  const pageSize = 10;
  const page = Math.max(1, rawFilters.page ?? 1);
  const filters: OnboardingListFilters = {
    ...rawFilters,
    q: rawFilters.q?.trim() || undefined,
    status: isRecordStatus(rawFilters.status) ? rawFilters.status : undefined,
    page,
  };

  let searchInternshipIds: string[] | undefined;
  if (filters.q) {
    const escapedQuery = filters.q.replace(/[%,()]/g, " ");
    const { data: internMatches, error: internError } = await supabase
      .from("interns")
      .select("id")
      .or(
        `full_name.ilike.%${escapedQuery}%,student_code.ilike.%${escapedQuery}%,email.ilike.%${escapedQuery}%`,
      )
      .is("deleted_at", null);
    if (internError) throw internError;

    const internIds = (internMatches ?? []).map((item) => item.id);
    if (internIds.length === 0) {
      searchInternshipIds = [];
    } else {
      const { data: internshipMatches, error: internshipError } = await supabase
        .from("internships")
        .select("id")
        .in("intern_id", internIds)
        .is("deleted_at", null);
      if (internshipError) throw internshipError;
      searchInternshipIds = (internshipMatches ?? []).map((item) => item.id);
    }
  }

  let query = supabase
    .from("onboarding_records")
    .select(
      `
        *,
        internships!inner (
          id,
          status,
          intern_id,
          interns!inner (id, full_name, student_code, email)
        ),
        internship_batches!onboarding_records_batch_id_fkey (id, name, code),
        departments!onboarding_records_department_id_fkey (id, name),
        mentors!onboarding_records_mentor_id_fkey (id, full_name),
        profiles!onboarding_records_assigned_hr_id_fkey (id, full_name)
      `,
      { count: "exact" },
    )
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filters.q) {
    const codeQuery = filters.q.replace(/[%,()]/g, " ");
    if (searchInternshipIds?.length) {
      query = query.or(
        `code.ilike.%${codeQuery}%,internship_id.in.(${searchInternshipIds.join(",")})`,
      );
    } else {
      query = query.ilike("code", `%${codeQuery}%`);
    }
  }
  if (filters.status) query = query.eq("status", filters.status as OnboardingRecordStatus);
  if (filters.batchId) query = query.eq("batch_id", filters.batchId);
  if (filters.departmentId) query = query.eq("department_id", filters.departmentId);
  if (filters.startFrom) query = query.gte("start_date", filters.startFrom);
  if (filters.startTo) query = query.lte("start_date", filters.startTo);

  const sortColumn = ["start_date", "due_date", "progress_percent"].includes(filters.sort ?? "")
    ? filters.sort!
    : "due_date";
  const ascending = filters.direction === "asc";
  query = query.order(sortColumn, { ascending, nullsFirst: false });

  const [{ data, error, count }, statsResult, batchesResult, departmentsResult] = await Promise.all([
    query,
    supabase.rpc("get_onboarding_dashboard_stats"),
    supabase
      .from("internship_batches")
      .select("id, name")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("departments")
      .select("id, name")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
  ]);

  if (error) throw error;
  if (batchesResult.error) throw batchesResult.error;
  if (departmentsResult.error) throw departmentsResult.error;

  const records = ((data ?? []) as unknown as Array<
    OnboardingRecordsRow & {
      internships: {
        id: string;
        status: string;
        intern_id: string;
        interns: Pick<InternsRow, "id" | "full_name" | "student_code" | "email"> | null;
      };
      internship_batches: { id: string; name: string; code: string } | null;
      departments: { id: string; name: string } | null;
      mentors: { id: string; full_name: string } | null;
      profiles: { id: string; full_name: string } | null;
    }
  >).map(mapRecord);

  return {
    records,
    total: count ?? records.length,
    page,
    pageSize,
    filters,
    stats: (statsResult.data as unknown as OnboardingStats | null) ?? emptyStats(),
    batches: (batchesResult.data ?? []).map((item) => ({ id: item.id, name: item.name })),
    departments: (departmentsResult.data ?? []).map((item) => ({ id: item.id, name: item.name })),
  };
}

function mapRecord(
  record: OnboardingRecordsRow & {
    internships: {
      id: string;
      status: string;
      intern_id: string;
      interns: Pick<InternsRow, "id" | "full_name" | "student_code" | "email"> | null;
    };
    internship_batches: { id: string; name: string; code: string } | null;
    departments: { id: string; name: string } | null;
    mentors: { id: string; full_name: string } | null;
    profiles: { id: string; full_name: string } | null;
  },
): OnboardingListRecord {
  return {
    ...record,
    intern: single(record.internships?.interns),
    batch: single(record.internship_batches),
    department: single(record.departments),
    mentor: single(record.mentors),
    assigned_hr: single(record.profiles),
  } as OnboardingListRecord;
}

export async function loadOnboardingRecordOptions(): Promise<{
  internships: OnboardingRecordOption[];
  templates: NamedOption[];
  hrUsers: NamedOption[];
}> {
  const supabase = await createClient();
  const [internshipsResult, recordsResult, templatesResult, profilesResult] = await Promise.all([
    supabase
      .from("internships")
      .select(
        `
          id, intern_id, batch_id, department_id, mentor_id, start_date, end_date, status,
          interns!inner (id, full_name),
          internship_batches!inner (id, name),
          departments (id, name),
          mentors (id, full_name)
        `,
      )
      .is("deleted_at", null)
      .eq("status", "upcoming")
      .order("created_at", { ascending: false }),
    supabase.rpc("list_onboarding_internship_ids_for_hr"),
    supabase
      .from("onboarding_checklist_templates")
      .select("id, name, code, is_default, is_active")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, roles!inner(code)")
      .eq("is_active", true)
      .in("roles.code", ["hr", "admin"])
      .order("full_name"),
  ]);

  if (internshipsResult.error) throw internshipsResult.error;
  if (recordsResult.error) throw recordsResult.error;
  if (templatesResult.error) throw templatesResult.error;
  if (profilesResult.error) throw profilesResult.error;

  const existingIds = new Set(recordsResult.data ?? []);
  const internships = ((internshipsResult.data ?? []) as unknown as Array<{
    id: string;
    intern_id: string;
    batch_id: string;
    department_id: string | null;
    mentor_id: string | null;
    start_date: string | null;
    end_date: string | null;
    status: string;
    interns: { id: string; full_name: string };
    internship_batches: { id: string; name: string };
    departments: { id: string; name: string } | null;
    mentors: { id: string; full_name: string } | null;
  }>)
    .filter((item) => !existingIds.has(item.id))
    .map((item) => {
      const intern = single(item.interns)!;
      const batch = single(item.internship_batches)!;
      const department = single(item.departments);
      const mentor = single(item.mentors);
      return {
        id: item.id,
        label: `${intern.full_name} · ${batch.name}`,
        intern: { id: intern.id, name: intern.full_name },
        batch: { id: batch.id, name: batch.name },
        department: department ? { id: department.id, name: department.name } : null,
        mentor: mentor ? { id: mentor.id, name: mentor.full_name } : null,
        start_date: item.start_date,
        end_date: item.end_date,
      };
    });

  return {
    internships,
    templates: (templatesResult.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
    })),
    hrUsers: (profilesResult.data ?? []).map((item) => ({
      id: item.id,
      name: item.full_name,
    })),
  };
}

export async function loadOnboardingDetail(recordId: string): Promise<OnboardingDetail | null> {
  const supabase = await createClient();
  const recordResult = await supabase
    .from("onboarding_records")
    .select(
      `
        *,
        internships!inner (
          id, status, intern_id,
          interns!inner (id, full_name, student_code, email)
        ),
        internship_batches!onboarding_records_batch_id_fkey (id, name, code),
        departments!onboarding_records_department_id_fkey (id, name),
        mentors!onboarding_records_mentor_id_fkey (id, full_name),
        profiles!onboarding_records_assigned_hr_id_fkey (id, full_name)
      `,
    )
    .eq("id", recordId)
    .maybeSingle();

  if (recordResult.error) throw recordResult.error;
  if (!recordResult.data) return null;

  const rawRecord = recordResult.data as Parameters<typeof mapRecord>[0];
  const internshipStatus = single(rawRecord.internships)?.status ?? "upcoming";
  const record = mapRecord(rawRecord);
  const [checklistResult, documentsResult, activityResult, progressResult] = await Promise.all([
    supabase
      .from("onboarding_checklist_items")
      .select(
        `
          *,
          assigned_profile:profiles!onboarding_checklist_items_assigned_to_fkey (id, full_name),
          performer_profile:profiles!onboarding_checklist_items_performer_id_fkey (id, full_name),
          documents!onboarding_checklist_items_guide_document_id_fkey (id, title, file_path, file_url)
        `,
      )
      .eq("onboarding_id", recordId)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("onboarding_documents")
      .select(
        `
          *,
          documents!onboarding_documents_catalog_document_id_fkey (
            id, title, file_path, file_url, file_name, mime_type, file_size
          )
        `,
      )
      .eq("onboarding_id", recordId)
      .order("created_at"),
    supabase
      .from("onboarding_activity_logs")
      .select("*, profiles!onboarding_activity_logs_actor_id_fkey (id, full_name)")
      .eq("onboarding_id", recordId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.rpc("get_onboarding_progress", { p_onboarding_id: recordId }),
  ]);

  if (checklistResult.error) throw checklistResult.error;
  if (documentsResult.error) throw documentsResult.error;
  if (activityResult.error) throw activityResult.error;
  if (progressResult.error) throw progressResult.error;

  const checklist = ((checklistResult.data ?? []) as unknown as Array<
    OnboardingChecklistItemsRow & {
      assigned_profile: { id: string; full_name: string } | null;
      performer_profile: { id: string; full_name: string } | null;
      documents: Pick<DocumentsRow, "id" | "title" | "file_path" | "file_url"> | null;
    }
  >).map((item) => ({
    ...item,
    assigned_to_profile: single(item.assigned_profile),
    performer: single(item.performer_profile),
    guide_document: single(item.documents),
  })) as OnboardingChecklistView[];

  const rawDocuments = ((documentsResult.data ?? []) as unknown as Array<
    OnboardingDocumentsRow & {
      documents: Pick<
        DocumentsRow,
        "id" | "title" | "file_path" | "file_url" | "file_name" | "mime_type" | "file_size"
      > | null;
    }
  >).map((item) => ({ ...item, catalog: single(item.documents) })) as Array<
    OnboardingDocumentsRow & { catalog: OnboardingDocumentView["catalog"] }
  >;

  const documentIds = rawDocuments.map((item) => item.id);
  const versionsResult = documentIds.length
    ? await supabase
        .from("onboarding_document_versions")
        .select("*")
        .in("document_id", documentIds)
        .order("version_number", { ascending: false })
    : { data: [], error: null };
  if (versionsResult.error) throw versionsResult.error;

  const versions = (versionsResult.data ?? []) as OnboardingDocumentVersionsRow[];
  const documents: OnboardingDocumentView[] = rawDocuments.map((item) => ({
    ...item,
    versions: versions.filter((version) => version.document_id === item.id),
  }));

  const activity = ((activityResult.data ?? []) as unknown as Array<
    OnboardingActivityLogsRow & { profiles: { id: string; full_name: string } | null }
  >).map((item) => ({ ...item, actor: single(item.profiles) }));

  return {
    ...record,
    internship_status: internshipStatus,
    checklist,
    documents,
    activity,
    progress: (progressResult.data as unknown as OnboardingDetail["progress"]) ?? {
      required_checklists: 0,
      completed_checklists: 0,
      required_documents: 0,
      approved_documents: 0,
      progress_percent: 0,
      can_complete: true,
    },
  };
}

export async function loadInternOnboarding(userId: string): Promise<{
  detail: OnboardingDetail | null;
  intern: InternsRow | null;
  notifications: NotificationsRow[];
}> {
  const supabase = await createClient();
  const { data: intern, error: internError } = await supabase
    .from("interns")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (internError) throw internError;

  const [recordsResult, notificationsResult] = await Promise.all([
    supabase
      .from("onboarding_records")
      .select("id, status, due_date")
      .neq("status", "cancelled"),
    supabase
      .from("notifications")
      .select("*")
      .in("type", [
        "onboarding_assigned",
        "onboarding_updated",
        "onboarding_due_soon",
        "onboarding_overdue",
        "onboarding_checklist_submitted",
        "onboarding_document_submitted",
        "onboarding_document_reviewed",
        "onboarding_completed",
        "onboarding_reopened",
        "onboarding_cancelled",
      ])
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (recordsResult.error) throw recordsResult.error;
  if (notificationsResult.error) throw notificationsResult.error;

  const selected = [...(recordsResult.data ?? [])].sort((left, right) => {
    const leftOpen = left.status === "completed" ? 1 : 0;
    const rightOpen = right.status === "completed" ? 1 : 0;
    if (leftOpen !== rightOpen) return leftOpen - rightOpen;
    return (left.due_date ?? "9999-12-31").localeCompare(right.due_date ?? "9999-12-31");
  })[0];
  if (!selected) {
    return {
      detail: null,
      intern: intern ?? null,
      notifications: notificationsResult.data ?? [],
    };
  }
  return {
    detail: await loadOnboardingDetail(selected.id),
    intern: intern ?? null,
    notifications: notificationsResult.data ?? [],
  };
}

export async function loadOnboardingDetailOptions(
  role: UserRole,
  internId?: string,
): Promise<{
  profiles: NamedOption[];
  documents: Array<{
    id: string;
    name: string;
    document_type: string | null;
    is_required_default: boolean;
    file_path: string | null;
    file_url: string | null;
  }>;
  documentTypes: NamedOption[];
  departments: SelectOption[];
  mentors: SelectOption[];
  hrUsers: NamedOption[];
  intern: InternsRow | null;
}> {
  const supabase = await createClient();
  const [profilesResult, documentsResult, typesResult, departmentsResult, mentorsResult, internResult] = await Promise.all([
    role === "intern"
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("profiles")
          .select("id, full_name, roles(code)")
          .eq("is_active", true)
          .order("full_name"),
    supabase
      .from("documents")
      .select("id, title, document_type, is_required_default, file_path, file_url, is_active")
      .eq("is_active", true)
      .order("title"),
    supabase
      .from("onboarding_document_types")
      .select("id, code, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("departments")
      .select("id, name")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("mentors")
      .select("id, full_name")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("full_name"),
    role === "intern" && internId
      ? supabase.from("interns").select("*").eq("id", internId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (documentsResult.error) throw documentsResult.error;
  if (typesResult.error) throw typesResult.error;
  if (departmentsResult.error) throw departmentsResult.error;
  if (mentorsResult.error) throw mentorsResult.error;
  if (internResult.error) throw internResult.error;

  return {
    profiles: ((profilesResult.data ?? []) as Array<{
      id: string;
      full_name: string;
      roles: { code: UserRole } | null;
    }>).map((item) => ({
      id: item.id,
      name: `${item.full_name}${item.roles ? ` · ${item.roles.code.toUpperCase()}` : ""}`,
    })),
    documents: (documentsResult.data ?? []).map((item) => ({
      id: item.id,
      name: item.title,
      document_type: item.document_type,
      is_required_default: item.is_required_default,
      file_path: item.file_path,
      file_url: item.file_url,
    })),
    documentTypes: (typesResult.data ?? []).map((item) => ({
      id: item.code,
      code: item.code,
      name: item.name,
    })),
    departments: (departmentsResult.data ?? []).map((item) => ({ id: item.id, name: item.name })),
    mentors: (mentorsResult.data ?? []).map((item) => ({ id: item.id, name: item.full_name })),
    hrUsers: ((profilesResult.data ?? []) as Array<{
      id: string;
      full_name: string;
      roles: { code: UserRole } | null;
    }>)
      .filter((item) => item.roles && ["hr", "admin"].includes(item.roles.code))
      .map((item) => ({ id: item.id, name: item.full_name })),
    intern: (internResult.data as InternsRow | null) ?? null,
  };
}

export async function loadOnboardingConfiguration(): Promise<{
  templates: OnboardingChecklistTemplatesRow[];
  items: Array<{
    id: string;
    template_id: string;
    title: string;
    description: string | null;
    category: string;
    is_required: boolean;
    sort_order: number;
    due_offset_days: number | null;
    default_assignee_role: string | null;
  }>;
  documentTypes: OnboardingDocumentTypesRow[];
  documents: Array<Pick<DocumentsRow, "id" | "title" | "document_type" | "file_path" | "file_url">>;
}> {
  const supabase = await createClient();
  const [templatesResult, itemsResult, typesResult, documentsResult] = await Promise.all([
    supabase
      .from("onboarding_checklist_templates")
      .select("*")
      .order("is_default", { ascending: false })
      .order("name"),
    supabase
      .from("onboarding_checklist_template_items")
      .select(
        "id, template_id, title, description, category, is_required, sort_order, due_offset_days, default_assignee_role",
      )
      .order("sort_order"),
    supabase.from("onboarding_document_types").select("*").order("name"),
    supabase
      .from("documents")
      .select("id, title, document_type, file_path, file_url")
      .eq("is_active", true)
      .order("title"),
  ]);

  if (templatesResult.error) throw templatesResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (typesResult.error) throw typesResult.error;
  if (documentsResult.error) throw documentsResult.error;

  return {
    templates: templatesResult.data ?? [],
    items: itemsResult.data ?? [],
    documentTypes: typesResult.data ?? [],
    documents: documentsResult.data ?? [],
  };
}
