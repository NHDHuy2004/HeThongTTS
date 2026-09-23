// ==========================================================================
// IMS – Web Admin Database Types
// Đồng bộ schema với supabase/migrations/0001..0007 (28 bảng + enum + RPC).
// Khi có project real: chạy `npx supabase gen types typescript --local -o types/database.ts`
// để tái sinh bản đầy đủ chuẩn hơn.
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
  | "on_hold"
  | "completed"
  | "converted"
  | "terminated";
export type InternshipStatus =
  | "upcoming"
  | "active"
  | "completed"
  | "cancelled";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type RequestType =
  | "leave"
  | "wfh"
  | "late"
  | "early_leave"
  | "other";
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type ReportStatus = "draft" | "submitted" | "approved" | "rejected";
export type ReportType = "daily" | "weekly";
export type EvaluationType =
  | "weekly"
  | "midterm"
  | "final"
  | "feedback_360";
export type AttendanceStatus =
  | "present"
  | "late"
  | "absent"
  | "leave"
  | "wfh"
  | "early_leave"
  | "weekend";
export type CertificateStatus = "draft" | "issued" | "revoked";
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
export type DevicePlatform = "android" | "ios";

// -- row/insert/update helper ------------------------------------------------
type Ident = {
  Insert: Record<string, unknown>;
  Update: Partial<Ident["Insert"]>;
  Relationships: never[];
};

type Row<T> = T extends { Insert: infer I }
  ? I extends { [K in keyof I]: unknown }
    ? { [K in keyof I]: I[K] }
    : never
  : never;

// -- bảng chính ---------------------------------------------------------------
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          department_id: string | null;
          role: UserRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          department_id?: string | null;
          role?: UserRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      departments: {
        Row: {
          id: string;
          name: string;
          code: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["departments"]["Insert"]>;
        Relationships: [];
      };
      internship_batches: {
        Row: {
          id: string;
          name: string;
          code: string;
          description: string | null;
          start_date: string | null;
          end_date: string | null;
          status: InternshipStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          description?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: InternshipStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["internship_batches"]["Insert"]>;
        Relationships: [];
      };
      interns: {
        Row: {
          id: string;
          user_id: string | null;
          intern_code: string;
          full_name: string;
          email: string;
          phone: string | null;
          university: string | null;
          major: string | null;
          status: InternStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          intern_code: string;
          full_name: string;
          email: string;
          phone?: string | null;
          university?: string | null;
          major?: string | null;
          status?: InternStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["interns"]["Insert"]>;
        Relationships: [];
      };
      mentors: {
        Row: {
          id: string;
          user_id: string | null;
          mentor_code: string;
          full_name: string;
          email: string;
          department_id: string | null;
          max_interns: number;
          status: "active" | "inactive";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          mentor_code: string;
          full_name: string;
          email: string;
          department_id?: string | null;
          max_interns?: number;
          status?: "active" | "inactive";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["mentors"]["Insert"]>;
        Relationships: [];
      };
      internships: {
        Row: {
          id: string;
          intern_id: string;
          batch_id: string;
          department_id: string | null;
          mentor_id: string | null;
          status: InternshipStatus;
          start_date: string | null;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          intern_id: string;
          batch_id: string;
          department_id?: string | null;
          mentor_id?: string | null;
          status?: InternshipStatus;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["internships"]["Insert"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          internship_id: string;
          template_id: string | null;
          title: string;
          description: string | null;
          priority: TaskPriority;
          status: TaskStatus;
          deadline: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          internship_id: string;
          template_id?: string | null;
          title: string;
          description?: string | null;
          priority?: TaskPriority;
          status?: TaskStatus;
          deadline?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [];
      };
      attendance: {
        Row: {
          id: string;
          intern_id: string;
          internship_id: string | null;
          work_date: string;
          check_in_at: string | null;
          check_out_at: string | null;
          status: AttendanceStatus;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          intern_id: string;
          internship_id?: string | null;
          work_date: string;
          check_in_at?: string | null;
          check_out_at?: string | null;
          status?: AttendanceStatus;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attendance"]["Insert"]>;
        Relationships: [];
      };
      leave_requests: {
        Row: {
          id: string;
          intern_id: string;
          internship_id: string | null;
          start_date: string;
          end_date: string;
          reason: string;
          status: RequestStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          intern_id: string;
          internship_id?: string | null;
          start_date: string;
          end_date: string;
          reason: string;
          status?: RequestStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leave_requests"]["Insert"]>;
        Relationships: [];
      };
      daily_reports: {
        Row: {
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
          feedback: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          intern_id: string;
          internship_id?: string | null;
          report_date: string;
          tasks_done?: string | null;
          results?: string | null;
          difficulties?: string | null;
          next_plan?: string | null;
          status?: ReportStatus;
          submitted_at?: string | null;
          reviewed_by?: string | null;
          feedback?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["daily_reports"]["Insert"]>;
        Relationships: [];
      };
      weekly_reports: {
        Row: {
          id: string;
          intern_id: string;
          internship_id: string | null;
          week_start: string;
          week_end: string;
          summary: string | null;
          status: ReportStatus;
          submitted_at: string | null;
          reviewed_by: string | null;
          feedback: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          intern_id: string;
          internship_id?: string | null;
          week_start: string;
          week_end: string;
          summary?: string | null;
          status?: ReportStatus;
          submitted_at?: string | null;
          reviewed_by?: string | null;
          feedback?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["weekly_reports"]["Insert"]>;
        Relationships: [];
      };
      evaluations: {
        Row: {
          id: string;
          internship_id: string;
          reviewer_id: string;
          type: EvaluationType;
          overall_score: number | null;
          summary: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          internship_id: string;
          reviewer_id: string;
          type: EvaluationType;
          overall_score?: number | null;
          summary?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["evaluations"]["Insert"]>;
        Relationships: [];
      };
      certificates: {
        Row: {
          id: string;
          internship_id: string;
          certificate_code: string;
          status: CertificateStatus;
          issued_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          internship_id: string;
          certificate_code: string;
          status?: CertificateStatus;
          issued_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["certificates"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type?: NotificationType;
          title: string;
          body?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_dashboard_stats: {
        Args: Record<string, never>;
        Returns: {
          total_interns: number;
          active_interns: number;
          total_mentors: number;
          total_tasks: number;
          completed_tasks: number;
          pending_requests: number;
          pending_reports: number;
          avg_score: number | null;
        };
      };
      get_mentor_stats: {
        Args: Record<string, never>;
        Returns: {
          my_interns: number;
          pending_reports: number;
          pending_requests: number;
        };
      };
      attendance_rate: {
        Args: { intern_id: string };
        Returns: number;
      };
      task_completion_rate: {
        Args: { intern_id: string };
        Returns: number;
      };
      report_submission_rate: {
        Args: { intern_id: string };
        Returns: number;
      };
      calculate_evaluation_score: {
        Args: { p_evaluation_id: string };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
