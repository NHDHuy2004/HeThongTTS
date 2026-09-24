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

export type TaskStatus = "todo" | "in_progress" | "review" | "done";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type RequestType = "leave" | "wfh" | "late" | "early_leave" | "other";

export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type ReportStatus = "draft" | "submitted" | "approved" | "rejected";

export type ReportType = "daily" | "weekly";

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
  | "report_approved"
  | "report_rejected"
  | "request_approved"
  | "request_rejected"
  | "evaluation"
  | "certificate"
  | "system"
  | "message";

export type OnboardingStatus = "not_started" | "in_progress" | "completed";

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

export interface DocumentsRow {
  id: string;
  title: string;
  description: string | null;
  bucket: string;
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
  priority: TaskPriority;
  status: TaskStatus;
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
  uploaded_by: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface AttendanceLocationsRow {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_m: number;
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
  check_out_at: string | null;
  status: AttendanceStatus;
  note: string | null;
  is_geo_validated: boolean;
  created_at: string;
  updated_at: string;
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
      documents: Ident<
        DocumentsRow,
        [
          rel<"documents_batch_id_fkey", "batch_id", "internship_batches">,
          rel<"documents_department_id_fkey", "department_id", "departments">,
          rel<"documents_created_by_fkey", "created_by", "profiles">,
        ]
      >;
      onboarding_checklists: Ident<
        OnboardingChecklistsRow,
        [
          rel<"checklists_intern_id_fkey", "intern_id", "interns">,
          rel<"checklists_created_by_fkey", "created_by", "profiles">,
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
      attendance_locations: Ident<AttendanceLocationsRow, [rel<"locations_created_by_fkey", "created_by", "profiles">]>;
      attendance: Ident<
        AttendanceRow,
        [
          rel<"attendance_intern_id_fkey", "intern_id", "interns">,
          rel<"attendance_internship_id_fkey", "internship_id", "internships">,
          rel<"attendance_location_id_fkey", "location_id", "attendance_locations">,
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
      task_completion_rate: {
        Args: { p_internship_id: string };
        Returns: number;
      };
      report_submission_rate: {
        Args: { p_internship_id: string };
        Returns: number;
      };
    };
    Enums: {
      user_role: UserRole;
      intern_status: InternStatus;
      internship_status: InternshipStatus;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      request_type: RequestType;
      request_status: RequestStatus;
      report_status: ReportStatus;
      report_type: ReportType;
      evaluation_type: EvaluationType;
      attendance_status: AttendanceStatus;
      day_status: DayStatus;
      notification_type: NotificationType;
      onboarding_status: OnboardingStatus;
      certificate_status: CertificateStatus;
      device_platform: DevicePlatform;
    };
    CompositeTypes: Record<string, never>;
  };
}