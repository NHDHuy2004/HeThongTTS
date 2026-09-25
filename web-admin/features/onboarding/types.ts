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
} from "@/types/database";

export type ActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
  recordId?: string;
};

export type ActionResult = {
  error?: string;
  success?: string;
  url?: string;
  versionId?: string;
};

export type SelectOption = {
  id: string;
  name: string;
};

export type NamedOption = SelectOption & {
  code?: string;
};

export type OnboardingListRecord = OnboardingRecordsRow & {
  intern: Pick<InternsRow, "id" | "full_name" | "student_code" | "email"> | null;
  batch: { id: string; name: string; code: string } | null;
  department: { id: string; name: string } | null;
  mentor: { id: string; full_name: string } | null;
  assigned_hr: { id: string; full_name: string } | null;
};

export type OnboardingChecklistView = OnboardingChecklistItemsRow & {
  assigned_to_profile: { id: string; full_name: string } | null;
  performer: { id: string; full_name: string } | null;
  guide_document: Pick<DocumentsRow, "id" | "title" | "file_path" | "file_url"> | null;
};

export type OnboardingDocumentView = OnboardingDocumentsRow & {
  catalog: Pick<
    DocumentsRow,
    "id" | "title" | "file_path" | "file_url" | "file_name" | "mime_type" | "file_size"
  > | null;
  versions: OnboardingDocumentVersionsRow[];
};

export type OnboardingDetail = OnboardingListRecord & {
  internship_status: string;
  checklist: OnboardingChecklistView[];
  documents: OnboardingDocumentView[];
  activity: (OnboardingActivityLogsRow & {
    actor: { id: string; full_name: string } | null;
  })[];
  progress: {
    required_checklists: number;
    completed_checklists: number;
    required_documents: number;
    approved_documents: number;
    progress_percent: number;
    can_complete: boolean;
  };
};

export type OnboardingStats = {
  total: number;
  not_started: number;
  in_progress: number;
  pending_review: number;
  needs_revision: number;
  completed: number;
  cancelled: number;
  overdue: number;
  completion_rate: number;
  by_batch: Array<{
    id: string;
    batch_name: string;
    total: number;
    completed: number;
    completion_rate: number | null;
  }>;
  by_department: Array<{
    id: string;
    department_name: string;
    total: number;
    completed: number;
    completion_rate: number | null;
  }>;
  incomplete: Array<{
    id: string;
    code: string;
    full_name: string;
    batch_name: string;
    due_date: string;
    status: OnboardingRecordStatus;
    progress_percent: number;
  }>;
};

export type OnboardingTemplateView = OnboardingChecklistTemplatesRow & {
  items: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    is_required: boolean;
    sort_order: number;
    due_offset_days: number | null;
    default_assignee_role: string | null;
  }>;
};

export type OnboardingDocumentTypeView = OnboardingDocumentTypesRow;

export type InternOnboardingData = {
  record: OnboardingListRecord;
  intern: InternsRow;
  checklist: OnboardingChecklistView[];
  documents: OnboardingDocumentView[];
  progress: OnboardingDetail["progress"];
  activity: OnboardingDetail["activity"];
};
