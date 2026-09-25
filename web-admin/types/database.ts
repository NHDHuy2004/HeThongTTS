// ==========================================================================
// IMS – Web Admin Database Types
// Đồng bộ schema với supabase/migrations/0001..0007 (28 bảng + enum + RPC).
// Tự sinh thủ công từ migration, KHÔNG thêm/sửa gì lệch với DB thật.
// ==========================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// -- enums -------------------------------------------------------------------
export type UserRole = "admin" | "hr" | "mentor" | "intern";

export type InternStatus =
  | "pending"
  | "onboarding"
  | "active"
  | "completed"
  | "cancelled"
  | "converted";

export type InternshipStatus = "upcoming" | "active" | "completed" | "cancelled";

export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "in_review"
  | "changes_requested"
  | "completed"
  | "cancelled";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskAssignmentType = "individual" | "team";

export type ReviewDecision = "approved" | "changes_requested" | "rejected";

export type ReviewCompletion = "none" | "partial" | "complete";

export type RequestType =
  | "leave"
  | "wfh"
  | "late"
  | "early_leave"
  | "other"
  | "attendance_adjustment"
  | "schedule_change";

export type RequestStatus =
  | "pending"
  | "in_review"
  | "needs_revision"
  | "approved"
  | "rejected"
  | "cancelled";

export type ReportStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "needs_revision"
  | "approved"
  | "rejected"
  | "cancelled";

export type ReportType = "daily" | "weekly" | "monthly" | "final";

export type EvaluationType = "weekly" | "midterm" | "final" | "feedback_360";

export type AttendanceStatus =
  | "present"
  | "late"
  | "absent"
  | "leave"
  | "wfh"
  | "early_leave"
  | "weekend";

export type DayStatus = "working_day" | "weekend" | "holiday";

export type NotificationType =
  | "task_assigned"
  | "task_updated"
  | "task_review_approved"
  | "task_review_changes"
  | "report_approved"
  | "report_rejected"
  | "request_approved"
  | "request_rejected"
  | "evaluation"
  | "certificate"
  | "system"
  | "message"
  | "onboarding_assigned"
  | "onboarding_updated"
  | "onboarding_due_soon"
  | "onboarding_overdue"
  | "onboarding_checklist_submitted"
  | "onboarding_document_submitted"
  | "onboarding_document_reviewed"
  | "onboarding_completed"
  | "onboarding_reopened"
  | "onboarding_cancelled"
  | "request_submitted"
  | "request_revision"
  | "request_taken"
  | "request_cancelled"
  | "report_submitted"
  | "report_revision"
  | "report_due_soon"
  | "report_overdue";

export type OnboardingStatus = "not_started" | "in_progress" | "completed";

export type OnboardingRecordStatus =
  | "not_started"
  | "in_progress"
  | "pending_review"
  | "needs_revision"
  | "completed"
  | "cancelled";

export type OnboardingChecklistStatus =
  | "not_started"
  | "in_progress"
  | "pending_review"
  | "needs_revision"
  | "completed"
  | "cancelled";

export type OnboardingDocumentStatus =
  | "not_submitted"
  | "pending_review"
  | "approved"
  | "needs_revision";

export type CertificateStatus = "draft" | "issued" | "revoked";

export type DevicePlatform = "android" | "ios";

// -- table rows --------------------------------------------------------------
export interface RolesRow {
  id: string;
  name: string;
  code: UserRole;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfilesRow {
  id: string;
  email: string;
  full_name: string;
  avatar_path: string | null;
  phone: string | null;
  gender: "male" | "female" | "other" | null;
  birth_date: string | null;
  address: string | null;
  role_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DepartmentsRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  head_profile_id: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InternshipBatchesRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  start_date: string;
  end_date: string;
  max_interns: number | null;
  status: InternshipStatus;
  location: string | null;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InternsRow {
  id: string;
  user_id: string | null;
  student_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  gender: "male" | "female" | "other" | null;
  birth_date: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_email: string | null;
  school: string | null;
  major: string | null;
  class_name: string | null;
  cv_file_path: string | null;
  status: InternStatus;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MentorsRow {
  id: string;
  user_id: string | null;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  department_id: string | null;
  max_interns: number;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InternshipsRow {
  id: string;
  intern_id: string;
  batch_id: string;
  department_id: string | null;
  mentor_id: string | null;
  status: InternshipStatus;
  start_date: string | null;
  end_date: string | null;
  final_score: number | null;
  converted_to_employee: boolean;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingDocumentTypesRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_required_default: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentsRow {
  id: string;
  title: string;
  description: string | null;
  bucket: string;
  document_type: string | null;
  file_name: string | null;
  version: number;
  is_required_default: boolean;
  is_guidance: boolean;
  file_path: string | null;
  file_url: string | null;
  mime_type: string | null;
  file_size: number | null;
  batch_id: string | null;
  department_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingChecklistsRow {
  id: string;
  intern_id: string;
  title: string;
  description: string | null;
  status: OnboardingStatus;
  due_date: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingChecklistTemplatesRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingChecklistTemplateItemsRow {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  category: string;
  is_required: boolean;
  sort_order: number;
  due_offset_days: number | null;
  default_assignee_role: UserRole | null;
  guide_document_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingRecordsRow {
  id: string;
  code: string;
  internship_id: string;
  batch_id: string;
  department_id: string | null;
  mentor_id: string | null;
  assigned_hr_id: string | null;
  start_date: string | null;
  end_date: string | null;
  onboarding_start_date: string;
  due_date: string;
  status: OnboardingRecordStatus;
  progress_percent: number;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingChecklistItemsRow {
  id: string;
  onboarding_id: string | null;
  legacy_intern_id: string | null;
  template_item_id: string | null;
  title: string;
  description: string | null;
  category: string;
  guide_document_id: string | null;
  assigned_to: string | null;
  performer_id: string | null;
  status: OnboardingChecklistStatus;
  start_date: string | null;
  due_date: string | null;
  is_required: boolean;
  review_required: boolean;
  sort_order: number;
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  feedback: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingDocumentsRow {
  id: string;
  onboarding_id: string;
  catalog_document_id: string | null;
  document_name: string;
  document_type: string | null;
  description: string | null;
  is_required: boolean;
  visible_to_mentor: boolean;
  due_date: string | null;
  status: OnboardingDocumentStatus;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  feedback: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  current_version_id: string | null;
  reviewed_version_id: string | null;
}

export interface OnboardingDocumentVersionsRow {
  id: string;
  document_id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string | null;
  uploaded_at: string;
  version_number: number;
}

export interface OnboardingActivityLogsRow {
  id: string;
  onboarding_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Json;
  created_at: string;
}

export interface TaskTemplatesRow {
  id: string;
  title: string;
  description: string | null;
  department_id: string | null;
  priority: TaskPriority;
  estimated_hours: number | null;
  is_active: boolean;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TasksRow {
  id: string;
  internship_id: string;
  template_id: string | null;
  title: string;
  description: string | null;
  assignment_type: TaskAssignmentType;
  project: string | null;
  module: string | null;
  task_type: string | null;
  objective: string | null;
  requirements: string | null;
  acceptance_criteria: string | null;
  deliverables: Json;
  priority: TaskPriority;
  status: TaskStatus;
  start_date: string | null;
  deadline: string | null;
  estimated_hours: number | null;
  result_summary: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCommentsRow {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface TaskAttachmentsRow {
  id: string;
  task_id: string;
  uploaded_by: string | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface TaskAssigneesRow {
  id: string;
  task_id: string;
  intern_id: string;
  role: string | null;
  assigned_by: string | null;
  created_at: string;
}

export interface TaskSubtasksRow {
  id: string;
  task_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  deliverable: string | null;
  result_summary: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskSubmissionsRow {
  id: string;
  task_id: string;
  subtask_id: string | null;
  submitted_by: string;
  work_summary: string | null;
  implementation_details: string | null;
  problems: string | null;
  solutions: string | null;
  notes: string | null;
  submission_no: number;
  submitted_at: string;
}

export interface TaskSubmissionFilesRow {
  id: string;
  submission_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface TaskSubmissionLinksRow {
  id: string;
  submission_id: string;
  title: string | null;
  url: string;
  created_at: string;
}

export interface TaskReviewsRow {
  id: string;
  task_id: string;
  subtask_id: string | null;
  submission_id: string | null;
  reviewer_id: string;
  decision: ReviewDecision;
  completion: ReviewCompletion;
  completion_pct: number | null;
  quality_score: number | null;
  technical_score: number | null;
  documentation_score: number | null;
  soft_score: number | null;
  deadline_bucket: string | null;
  feedback: string | null;
  strengths: string | null;
  weaknesses: string | null;
  improvements: string | null;
  final_score: number | null;
  reviewed_at: string;
  created_at: string;
}

export interface AttendanceLocationsRow {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_m: number;
  min_accuracy_meters: number;
  check_in_start_time: string | null;
  check_in_end_time: string | null;
  check_out_start_time: string | null;
  check_out_end_time: string | null;
  department_id: string | null;
  internship_batch_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRow {
  id: string;
  intern_id: string;
  internship_id: string | null;
  location_id: string | null;
  work_date: string;
  check_in_at: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_accuracy: number | null;
  check_in_distance_meters: number | null;
  check_out_at: string | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_out_accuracy: number | null;
  check_out_distance_meters: number | null;
  total_working_minutes: number | null;
  status: AttendanceStatus;
  note: string | null;
  is_geo_validated: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttendanceVerificationLogsRow {
  id: string;
  user_id: string;
  attendance_id: string | null;
  work_location_id: string | null;
  action: "CHECK_IN" | "CHECK_OUT" | "ADJUST";
  latitude: number;
  longitude: number;
  accuracy: number | null;
  distance_meters: number | null;
  is_valid: boolean;
  failure_reason: string | null;
  note: string | null;
  verified_at: string;
}

export interface LeaveRequestsRow {
  id: string;
  intern_id: string;
  internship_id: string | null;
  request_type: RequestType;
  start_date: string;
  end_date: string;
  reason: string;
  attachment_path: string | null;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkFromHomeRequestsRow {
  id: string;
  intern_id: string;
  internship_id: string | null;
  work_date: string;
  reason: string;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface LateRequestsRow {
  id: string;
  intern_id: string;
  internship_id: string | null;
  request_type: RequestType;
  request_date: string;
  minutes_late: number | null;
  reason: string;
  attachment_path: string | null;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestsRow {
  id: string;
  request_code: string;
  user_id: string;
  intern_id: string | null;
  internship_id: string | null;
  request_type: RequestType;
  title: string;
  description: string | null;
  reason: string;
  start_date: string | null;
  end_date: string | null;
  requested_start_time: string | null;
  requested_end_time: string | null;
  payload: Json;
  status: RequestStatus;
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  rejection_reason: string | null;
  revision_note: string | null;
  submitted_at: string;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestTypesRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  requires_attachment: boolean;
  approval_policy: "mentor_or_hr" | "hr_only";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RequestAttachmentsRow {
  id: string;
  request_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface RequestApprovalLogsRow {
  id: string;
  request_id: string;
  actor_id: string | null;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  comment: string | null;
  created_at: string;
}

export interface DailyReportsRow {
  id: string;
  intern_id: string;
  internship_id: string | null;
  report_date: string;
  tasks_done: string | null;
  results: string | null;
  difficulties: string | null;
  next_plan: string | null;
  status: ReportStatus;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  feedback: string | null;
  score: number | null;
  attachments: Json;
  created_at: string;
  updated_at: string;
}

export interface WeeklyReportsRow {
  id: string;
  intern_id: string;
  internship_id: string | null;
  week_start: string;
  week_end: string;
  work_summary: string | null;
  results: string | null;
  skills_learned: string | null;
  difficulties: string | null;
  next_week_plan: string | null;
  status: ReportStatus;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  feedback: string | null;
  score: number | null;
  attachments: Json;
  created_at: string;
  updated_at: string;
}

export interface ReportsRow {
  id: string;
  report_code: string;
  internship_id: string | null;
  intern_id: string;
  user_id: string;
  mentor_id: string | null;
  report_type: ReportType;
  title: string;
  period_start: string;
  period_end: string;
  content: Json;
  links: Json;
  status: ReportStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_comment: string | null;
  rejection_reason: string | null;
  revision_note: string | null;
  due_date: string | null;
  is_late: boolean;
  cancelled_at: string | null;
  payload: Json;
  created_at: string;
  updated_at: string;
}

export interface ReportAttachmentsRow {
  id: string;
  report_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface ReportTaskLinksRow {
  id: string;
  report_id: string;
  task_id: string;
  created_at: string;
}

export interface ReportReviewsRow {
  id: string;
  report_id: string;
  actor_id: string | null;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  comment: string | null;
  created_at: string;
}

export interface ReportVersionsRow {
  id: string;
  report_id: string;
  version_number: number;
  title: string;
  content: Json;
  links: Json;
  submitted_by: string | null;
  submitted_at: string;
  created_at: string;
}

export interface ReportTemplatesRow {
  id: string;
  name: string;
  report_type: ReportType;
  description: string | null;
  template_content: Json;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportSchedulesRow {
  id: string;
  batch_id: string;
  report_type: ReportType;
  frequency: "daily" | "weekly" | "monthly" | "once";
  due_date: string | null;
  due_time: string;
  is_required: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EvaluationCriteriaRow {
  id: string;
  name: string;
  category: string;
  description: string | null;
  weight: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EvaluationsRow {
  id: string;
  internship_id: string;
  reviewer_id: string;
  type: EvaluationType;
  period_label: string;
  due_date: string | null;
  submitted_at: string | null;
  final_score: number | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvaluationScoresRow {
  id: string;
  evaluation_id: string;
  criterion_id: string;
  score: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface CertificatesRow {
  id: string;
  internship_id: string;
  intern_id: string;
  certificate_code: string;
  full_name: string;
  department_name: string | null;
  batch_name: string | null;
  position: string | null;
  start_date: string | null;
  end_date: string | null;
  file_path: string | null;
  status: CertificateStatus;
  issued_at: string | null;
  signed_by: string | null;
  signed_title: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationsRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Json | null;
  dedupe_key: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationDevicesRow {
  id: string;
  user_id: string;
  device_token: string;
  platform: DevicePlatform;
  last_active_at: string;
  created_at: string;
}

export interface AuditLogsRow {
  id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  old_data: Json | null;
  new_data: Json | null;
  ip_address: string | null;
  created_at: string;
}

export interface SystemSettingsRow {
  key: string;
  value: Json;
  description: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// ==========================================================================
type RecordShape = Record<string, unknown>;

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Ident<T, R extends Rel[] = []> = {
  Row: T & RecordShape;
  Insert: (Partial<Omit<T, "id">> & RecordShape) & { id?: string };
  Update: Partial<Omit<T, "id">> & RecordShape;
  Relationships: R;
};

type rel<Name extends string, Col extends string, RelTable extends string> = {
  foreignKeyName: Name;
  columns: [Col];
  isOneToOne?: boolean;
  referencedRelation: RelTable;
  referencedColumns: ["id"];
};


export interface Database {
  public: {
    Tables: {
      roles: Ident<RolesRow>;
      profiles: Ident<ProfilesRow, [rel<"profiles_role_fkey", "role_id", "roles">]>;
      departments: Ident<DepartmentsRow, [rel<"departments_head_fkey", "head_profile_id", "profiles">]>;
      internship_batches: Ident<InternshipBatchesRow, [rel<"batches_created_by_fkey", "created_by", "profiles">]>;
      interns: Ident<InternsRow, [rel<"interns_user_id_fkey", "user_id", "profiles">]>;
      mentors: Ident<
        MentorsRow,
        [
          rel<"mentors_user_id_fkey", "user_id", "profiles">,
          rel<"mentors_department_id_fkey", "department_id", "departments">,
        ]
      >;
      internships: Ident<
        InternshipsRow,
        [
          rel<"internships_intern_id_fkey", "intern_id", "interns">,
          rel<"internships_batch_id_fkey", "batch_id", "internship_batches">,
          rel<"internships_department_id_fkey", "department_id", "departments">,
          rel<"internships_mentor_id_fkey", "mentor_id", "mentors">,
          rel<"internships_created_by_fkey", "created_by", "profiles">,
        ]
      >;
      onboarding_document_types: Ident<
        OnboardingDocumentTypesRow,
        [rel<"onboarding_document_types_created_by_fkey", "created_by", "profiles">]
      >;
      documents: Ident<
        DocumentsRow,
        [
          {
            foreignKeyName: "documents_document_type_fkey";
            columns: ["document_type"];
            referencedRelation: "onboarding_document_types";
            referencedColumns: ["code"];
          },
          rel<"documents_batch_id_fkey", "batch_id", "internship_batches">,
          rel<"documents_department_id_fkey", "department_id", "departments">,
          rel<"documents_created_by_fkey", "created_by", "profiles">,
        ]
      >;
      onboarding_checklist_templates: Ident<
        OnboardingChecklistTemplatesRow,
        [rel<"onboarding_checklist_templates_created_by_fkey", "created_by", "profiles">]
      >;
      onboarding_checklist_template_items: Ident<
        OnboardingChecklistTemplateItemsRow,
        [
          rel<
            "onboarding_checklist_template_items_template_id_fkey",
            "template_id",
            "onboarding_checklist_templates"
          >,
          rel<
            "onboarding_checklist_template_items_guide_document_id_fkey",
            "guide_document_id",
            "documents"
          >,
        ]
      >;
      onboarding_records: Ident<
        OnboardingRecordsRow,
        [
          {
            foreignKeyName: "onboarding_records_internship_id_fkey";
            columns: ["internship_id"];
            isOneToOne: true;
            referencedRelation: "internships";
            referencedColumns: ["id"];
          },
          rel<"onboarding_records_batch_id_fkey", "batch_id", "internship_batches">,
          rel<"onboarding_records_department_id_fkey", "department_id", "departments">,
          rel<"onboarding_records_mentor_id_fkey", "mentor_id", "mentors">,
          rel<"onboarding_records_assigned_hr_id_fkey", "assigned_hr_id", "profiles">,
          rel<"onboarding_records_completed_by_fkey", "completed_by", "profiles">,
          rel<"onboarding_records_cancelled_by_fkey", "cancelled_by", "profiles">,
          rel<"onboarding_records_created_by_fkey", "created_by", "profiles">,
        ]
      >;
      onboarding_checklist_items: Ident<
        OnboardingChecklistItemsRow,
        [
          rel<
            "onboarding_checklist_items_onboarding_id_fkey",
            "onboarding_id",
            "onboarding_records"
          >,
          rel<"onboarding_checklist_items_legacy_intern_id_fkey", "legacy_intern_id", "interns">,
          rel<
            "onboarding_checklist_items_template_item_id_fkey",
            "template_item_id",
            "onboarding_checklist_template_items"
          >,
          rel<"onboarding_checklist_items_guide_document_id_fkey", "guide_document_id", "documents">,
          rel<"onboarding_checklist_items_assigned_to_fkey", "assigned_to", "profiles">,
          rel<"onboarding_checklist_items_performer_id_fkey", "performer_id", "profiles">,
          rel<"onboarding_checklist_items_completed_by_fkey", "completed_by", "profiles">,
          rel<"onboarding_checklist_items_reviewed_by_fkey", "reviewed_by", "profiles">,
          rel<"checklists_created_by_fkey", "created_by", "profiles">,
        ]
      >;
      onboarding_documents: Ident<
        OnboardingDocumentsRow,
        [
          rel<"onboarding_documents_onboarding_id_fkey", "onboarding_id", "onboarding_records">,
          rel<"onboarding_documents_catalog_document_id_fkey", "catalog_document_id", "documents">,
          {
            foreignKeyName: "onboarding_documents_document_type_fkey";
            columns: ["document_type"];
            referencedRelation: "onboarding_document_types";
            referencedColumns: ["code"];
          },
          rel<"onboarding_documents_submitted_by_fkey", "submitted_by", "profiles">,
          rel<"onboarding_documents_reviewed_by_fkey", "reviewed_by", "profiles">,
          rel<"onboarding_documents_created_by_fkey", "created_by", "profiles">,
          rel<
            "onboarding_documents_current_version_fkey",
            "current_version_id",
            "onboarding_document_versions"
          >,
          rel<
            "onboarding_documents_reviewed_version_fkey",
            "reviewed_version_id",
            "onboarding_document_versions"
          >,
        ]
      >;
      onboarding_document_versions: Ident<
        OnboardingDocumentVersionsRow,
        [
          rel<
            "onboarding_document_versions_document_id_fkey",
            "document_id",
            "onboarding_documents"
          >,
          rel<"onboarding_document_versions_uploaded_by_fkey", "uploaded_by", "profiles">,
        ]
      >;
      onboarding_activity_logs: Ident<
        OnboardingActivityLogsRow,
        [
          rel<"onboarding_activity_logs_onboarding_id_fkey", "onboarding_id", "onboarding_records">,
          rel<"onboarding_activity_logs_actor_id_fkey", "actor_id", "profiles">,
        ]
      >;
      task_templates: Ident<
        TaskTemplatesRow,
        [
          rel<"templates_department_id_fkey", "department_id", "departments">,
          rel<"templates_created_by_fkey", "created_by", "profiles">,
        ]
      >;
      tasks: Ident<
        TasksRow,
        [
          rel<"tasks_internship_id_fkey", "internship_id", "internships">,
          rel<"tasks_template_id_fkey", "template_id", "task_templates">,
          rel<"tasks_created_by_fkey", "created_by", "profiles">,
        ]
      >;
      task_comments: Ident<
        TaskCommentsRow,
        [
          rel<"comments_task_id_fkey", "task_id", "tasks">,
          rel<"comments_user_id_fkey", "user_id", "profiles">,
        ]
      >;
      task_attachments: Ident<
        TaskAttachmentsRow,
        [
          rel<"attachments_task_id_fkey", "task_id", "tasks">,
          rel<"attachments_uploaded_by_fkey", "uploaded_by", "profiles">,
        ]
      >;
      task_assignees: Ident<
        TaskAssigneesRow,
        [
          rel<"task_assignees_task_id_fkey", "task_id", "tasks">,
          rel<"task_assignees_intern_id_fkey", "intern_id", "interns">,
          rel<"task_assignees_assigned_by_fkey", "assigned_by", "profiles">,
        ]
      >;
      task_subtasks: Ident<
        TaskSubtasksRow,
        [
          rel<"task_subtasks_task_id_fkey", "task_id", "tasks">,
          rel<"task_subtasks_assignee_id_fkey", "assignee_id", "interns">,
          rel<"task_subtasks_created_by_fkey", "created_by", "profiles">,
        ]
      >;
      task_submissions: Ident<
        TaskSubmissionsRow,
        [
          rel<"task_submissions_task_id_fkey", "task_id", "tasks">,
          rel<"task_submissions_subtask_id_fkey", "subtask_id", "task_subtasks">,
          rel<"task_submissions_submitted_by_fkey", "submitted_by", "profiles">,
        ]
      >;
      task_submission_files: Ident<
        TaskSubmissionFilesRow,
        [
          rel<"submission_files_submission_id_fkey", "submission_id", "task_submissions">,
        ]
      >;
      task_submission_links: Ident<
        TaskSubmissionLinksRow,
        [
          rel<"submission_links_submission_id_fkey", "submission_id", "task_submissions">,
        ]
      >;
      task_reviews: Ident<
        TaskReviewsRow,
        [
          rel<"task_reviews_task_id_fkey", "task_id", "tasks">,
          rel<"task_reviews_subtask_id_fkey", "subtask_id", "task_subtasks">,
          rel<"task_reviews_submission_id_fkey", "submission_id", "task_submissions">,
          rel<"task_reviews_reviewer_id_fkey", "reviewer_id", "profiles">,
        ]
      >;
      attendance_locations: Ident<AttendanceLocationsRow, [rel<"locations_created_by_fkey", "created_by", "profiles">]>;
      attendance: Ident<
        AttendanceRow,
        [
          rel<"attendance_intern_id_fkey", "intern_id", "interns">,
          rel<"attendance_internship_id_fkey", "internship_id", "internships">,
          rel<"attendance_location_id_fkey", "location_id", "attendance_locations">,
        ]
      >;
      attendance_verification_logs: Ident<
        AttendanceVerificationLogsRow,
        [
          rel<"verification_logs_user_fkey", "user_id", "profiles">,
          rel<"verification_logs_attendance_fkey", "attendance_id", "attendance">,
          rel<"verification_logs_location_fkey", "work_location_id", "attendance_locations">,
        ]
      >;
      leave_requests: Ident<
        LeaveRequestsRow,
        [
          rel<"leave_intern_id_fkey", "intern_id", "interns">,
          rel<"leave_internship_id_fkey", "internship_id", "internships">,
          rel<"leave_reviewed_by_fkey", "reviewed_by", "profiles">,
        ]
      >;
      work_from_home_requests: Ident<
        WorkFromHomeRequestsRow,
        [
          rel<"wfh_intern_id_fkey", "intern_id", "interns">,
          rel<"wfh_internship_id_fkey", "internship_id", "internships">,
          rel<"wfh_reviewed_by_fkey", "reviewed_by", "profiles">,
        ]
      >;
      late_requests: Ident<
        LateRequestsRow,
        [
          rel<"late_intern_id_fkey", "intern_id", "interns">,
          rel<"late_internship_id_fkey", "internship_id", "internships">,
          rel<"late_reviewed_by_fkey", "reviewed_by", "profiles">,
        ]
      >;
      requests: Ident<
        RequestsRow,
        [
          rel<"requests_user_id_fkey", "user_id", "profiles">,
          rel<"requests_intern_id_fkey", "intern_id", "interns">,
          rel<"requests_internship_id_fkey", "internship_id", "internships">,
          rel<"requests_reviewer_id_fkey", "reviewer_id", "profiles">,
        ]
      >;
      request_types: Ident<RequestTypesRow>;
      request_attachments: Ident<
        RequestAttachmentsRow,
        [
          rel<"request_attachments_request_id_fkey", "request_id", "requests">,
          rel<"request_attachments_uploaded_by_fkey", "uploaded_by", "profiles">,
        ]
      >;
      request_approval_logs: Ident<
        RequestApprovalLogsRow,
        [
          rel<"request_logs_request_id_fkey", "request_id", "requests">,
          rel<"request_logs_actor_id_fkey", "actor_id", "profiles">,
        ]
      >;
      daily_reports: Ident<
        DailyReportsRow,
        [
          rel<"daily_intern_id_fkey", "intern_id", "interns">,
          rel<"daily_internship_id_fkey", "internship_id", "internships">,
          rel<"daily_reviewed_by_fkey", "reviewed_by", "profiles">,
        ]
      >;
      weekly_reports: Ident<
        WeeklyReportsRow,
        [
          rel<"weekly_intern_id_fkey", "intern_id", "interns">,
          rel<"weekly_internship_id_fkey", "internship_id", "internships">,
          rel<"weekly_reviewed_by_fkey", "reviewed_by", "profiles">,
        ]
      >;
      reports: Ident<
        ReportsRow,
        [
          rel<"reports_intern_id_fkey", "intern_id", "interns">,
          rel<"reports_internship_id_fkey", "internship_id", "internships">,
          rel<"reports_user_id_fkey", "user_id", "profiles">,
          rel<"reports_mentor_id_fkey", "mentor_id", "mentors">,
          rel<"reports_reviewed_by_fkey", "reviewed_by", "profiles">,
        ]
      >;
      report_attachments: Ident<
        ReportAttachmentsRow,
        [
          rel<"report_attachments_report_id_fkey", "report_id", "reports">,
          rel<"report_attachments_uploaded_by_fkey", "uploaded_by", "profiles">,
        ]
      >;
      report_task_links: Ident<
        ReportTaskLinksRow,
        [
          rel<"report_task_links_report_id_fkey", "report_id", "reports">,
          rel<"report_task_links_task_id_fkey", "task_id", "tasks">,
        ]
      >;
      report_reviews: Ident<
        ReportReviewsRow,
        [
          rel<"report_reviews_report_id_fkey", "report_id", "reports">,
          rel<"report_reviews_actor_id_fkey", "actor_id", "profiles">,
        ]
      >;
      report_versions: Ident<
        ReportVersionsRow,
        [
          rel<"report_versions_report_id_fkey", "report_id", "reports">,
          rel<"report_versions_submitted_by_fkey", "submitted_by", "profiles">,
        ]
      >;
      report_templates: Ident<
        ReportTemplatesRow,
        [rel<"report_templates_created_by_fkey", "created_by", "profiles">]
      >;
      report_schedules: Ident<
        ReportSchedulesRow,
        [rel<"report_schedules_batch_id_fkey", "batch_id", "internship_batches">]
      >;
      evaluation_criteria: Ident<EvaluationCriteriaRow>;
      evaluations: Ident<
        EvaluationsRow,
        [
          rel<"evaluations_internship_id_fkey", "internship_id", "internships">,
          rel<"evaluations_reviewer_id_fkey", "reviewer_id", "profiles">,
        ]
      >;
      evaluation_scores: Ident<
        EvaluationScoresRow,
        [
          rel<"scores_evaluation_id_fkey", "evaluation_id", "evaluations">,
          rel<"scores_criterion_id_fkey", "criterion_id", "evaluation_criteria">,
        ]
      >;
      certificates: Ident<
        CertificatesRow,
        [
          rel<"certificates_internship_id_fkey", "internship_id", "internships">,
          rel<"certificates_intern_id_fkey", "intern_id", "interns">,
          rel<"certificates_created_by_fkey", "created_by", "profiles">,
        ]
      >;
      notifications: Ident<NotificationsRow, [rel<"notifications_user_id_fkey", "user_id", "profiles">]>;
      notification_devices: Ident<NotificationDevicesRow, [rel<"devices_user_id_fkey", "user_id", "profiles">]>;
      audit_logs: Ident<AuditLogsRow, [rel<"audit_user_id_fkey", "user_id", "profiles">]>;
      system_settings: Ident<SystemSettingsRow, [rel<"settings_updated_by_fkey", "updated_by", "profiles">]>;
    };
    Views: Record<string, never>;
    Functions: {
      get_my_role: {
        Args: Record<PropertyKey, never>;
        Returns: UserRole;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_hr_or_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_my_intern_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      get_my_internship_ids: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      get_my_task_ids: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      is_task_participant: {
        Args: { p_task_id: string };
        Returns: boolean;
      };
      is_staff_of_task: {
        Args: { p_task_id: string };
        Returns: boolean;
      };
      can_attach_task_file: {
        Args: { p_task_id: string };
        Returns: boolean;
      };
      get_dashboard_stats: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_mentor_stats: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      calculate_evaluation_score: {
        Args: { p_evaluation_id: string };
        Returns: number;
      };
      attendance_rate: {
        Args: { p_internship_id: string };
        Returns: number;
      };
      adjust_attendance: {
        Args: {
          p_attendance_id: string;
          p_status: AttendanceStatus;
          p_note: string | null;
          p_reason: string;
        };
        Returns: Json;
      };
      attendance_check: {
        Args: {
          p_user_id: string;
          p_action: string;
          p_latitude: number;
          p_longitude: number;
          p_accuracy: number;
          p_note?: string | null;
        };
        Returns: Json;
      };
      create_request: {
        Args: {
          p_request_type: string;
          p_title: string;
          p_reason: string;
          p_start_date: string | null;
          p_end_date: string | null;
          p_start_time: string | null;
          p_end_time: string | null;
          p_payload?: Json;
          p_description?: string | null;
          p_attachment_paths?: Json;
        };
        Returns: Json;
      };
      review_request: {
        Args: {
          p_request_id: string;
          p_action: string;
          p_comment?: string | null;
        };
        Returns: Json;
      };
      get_request_stats: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      create_report: {
        Args: {
          p_report_type: string;
          p_title: string;
          p_period_start: string;
          p_period_end: string;
          p_content?: Json;
          p_links?: Json;
          p_task_ids?: Json;
          p_due_date?: string | null;
          p_attachment_paths?: Json;
          p_submit?: boolean;
        };
        Returns: Json;
      };
      update_report: {
        Args: {
          p_report_id: string;
          p_title: string;
          p_period_start: string;
          p_period_end: string;
          p_content?: Json;
          p_links?: Json;
          p_task_ids?: Json;
          p_due_date?: string | null;
          p_attachment_paths?: Json;
          p_submit?: boolean;
        };
        Returns: Json;
      };
      submit_report: {
        Args: { p_report_id: string };
        Returns: Json;
      };
      review_report: {
        Args: {
          p_report_id: string;
          p_action: string;
          p_comment?: string | null;
        };
        Returns: Json;
      };
      get_report_stats: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      task_completion_rate: {
        Args: { p_internship_id: string };
        Returns: number;
      };
      report_submission_rate: {
        Args: { p_internship_id: string };
        Returns: number;
      };
      is_mentor_of_intern: {
        Args: { p_intern_id: string };
        Returns: boolean;
      };
      is_mentor_of: {
        Args: { target_user_id: string };
        Returns: boolean;
      };
      is_mentor_of_internship: {
        Args: { p_internship_id: string };
        Returns: boolean;
      };
      existing_profile_role_id: {
        Args: { p_id: string };
        Returns: string;
      };
      existing_profile_is_active: {
        Args: { p_id: string };
        Returns: boolean;
      };
      existing_intern_status: {
        Args: { p_id: string };
        Returns: InternStatus;
      };
      existing_intern_deleted_at: {
        Args: { p_id: string };
        Returns: string;
      };
      can_manage_onboarding: {
        Args: { p_onboarding_id: string };
        Returns: boolean;
      };
      can_read_onboarding: {
        Args: { p_onboarding_id: string };
        Returns: boolean;
      };
      can_review_onboarding_item: {
        Args: { p_item_id: string };
        Returns: boolean;
      };
      can_read_onboarding_document: {
        Args: { p_document_id: string };
        Returns: boolean;
      };
      can_submit_onboarding_document: {
        Args: { p_document_id: string };
        Returns: boolean;
      };
      can_read_document_catalog: {
        Args: { p_document_id: string };
        Returns: boolean;
      };
      can_read_onboarding_storage_path: {
        Args: { p_object_name: string };
        Returns: boolean;
      };
      can_write_onboarding_storage_path: {
        Args: { p_object_name: string };
        Returns: boolean;
      };
      create_onboarding_record: {
        Args: {
          p_internship_id: string;
          p_onboarding_start_date: string;
          p_due_date: string;
          p_assigned_hr_id?: string | null;
          p_template_id?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      update_onboarding_record: {
        Args: {
          p_onboarding_id: string;
          p_assigned_hr_id: string;
          p_start_date: string | null;
          p_end_date: string | null;
          p_onboarding_start_date: string;
          p_due_date: string;
          p_department_id: string | null;
          p_mentor_id: string | null;
          p_notes: string | null;
        };
        Returns: void;
      };
      submit_onboarding_checklist_item: {
        Args: {
          p_item_id: string;
          p_status: OnboardingChecklistStatus;
        };
        Returns: void;
      };
      review_onboarding_checklist_item: {
        Args: {
          p_item_id: string;
          p_decision: string;
          p_feedback?: string | null;
        };
        Returns: void;
      };
      submit_onboarding_document_version: {
        Args: {
          p_document_id: string;
          p_file_path: string;
          p_file_name: string;
          p_file_size: number;
          p_mime_type: string;
        };
        Returns: string;
      };
      review_onboarding_document: {
        Args: {
          p_document_id: string;
          p_version_id: string;
          p_approved: boolean;
          p_feedback?: string | null;
        };
        Returns: void;
      };
      complete_onboarding: {
        Args: { p_onboarding_id: string };
        Returns: void;
      };
      cancel_onboarding: {
        Args: {
          p_onboarding_id: string;
          p_reason: string;
        };
        Returns: void;
      };
      reopen_onboarding: {
        Args: {
          p_onboarding_id: string;
          p_reason: string;
        };
        Returns: void;
      };
      activate_internship: {
        Args: { p_internship_id: string };
        Returns: void;
      };
      update_my_onboarding_profile: {
        Args: {
          p_full_name: string;
          p_phone: string | null;
          p_address: string | null;
          p_emergency_contact_name: string | null;
          p_emergency_contact_phone: string | null;
          p_emergency_contact_email: string | null;
        };
        Returns: void;
      };
      get_onboarding_progress: {
        Args: { p_onboarding_id: string };
        Returns: Json;
      };
      get_onboarding_dashboard_stats: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      list_onboarding_internship_ids_for_hr: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
    };
    Enums: {
      user_role: UserRole;
      intern_status: InternStatus;
      internship_status: InternshipStatus;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      task_assignment_type: TaskAssignmentType;
      review_decision: ReviewDecision;
      review_completion: ReviewCompletion;
      request_type: RequestType;
      request_status: RequestStatus;
      report_status: ReportStatus;
      report_type: ReportType;
      evaluation_type: EvaluationType;
      attendance_status: AttendanceStatus;
      day_status: DayStatus;
      notification_type: NotificationType;
      onboarding_status: OnboardingStatus;
      onboarding_record_status: OnboardingRecordStatus;
      onboarding_checklist_status: OnboardingChecklistStatus;
      onboarding_document_status: OnboardingDocumentStatus;
      certificate_status: CertificateStatus;
      device_platform: DevicePlatform;
    };
    CompositeTypes: Record<string, never>;
  };
}