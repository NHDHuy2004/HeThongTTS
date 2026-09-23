-- ==========================================================================
-- IMS – 0003_indexes.sql
-- Index cho FK + query thường dùng (tìm nhanh theo danh sách/filter).
-- ==========================================================================

-- profiles
create index idx_profiles_role_id      on public.profiles (role_id);
create index idx_profiles_email        on public.profiles (email);

-- departments
create index idx_departments_head      on public.departments (head_profile_id);
create index idx_departments_active    on public.departments (is_active) where deleted_at is null;

-- internship_batches
create index idx_batches_status        on public.internship_batches (status);
create index idx_batches_dates         on public.internship_batches (start_date, end_date);

-- interns
create index idx_interns_user_id       on public.interns (user_id);
create index idx_interns_status        on public.interns (status);
create index idx_interns_school        on public.interns (school);

-- mentors
create index idx_mentors_user_id       on public.mentors (user_id);
create index idx_mentors_department_id on public.mentors (department_id);
create index idx_mentors_active        on public.mentors (is_active) where deleted_at is null;

-- internships
create index idx_internships_intern    on public.internships (intern_id);
create index idx_internships_batch     on public.internships (batch_id);
create index idx_internships_department on public.internships (department_id);
create index idx_internships_mentor    on public.internships (mentor_id);
create index idx_internships_status    on public.internships (status);
create index idx_internships_mentor_status on public.internships (mentor_id, status);
create index idx_internships_batch_status on public.internships (batch_id, status);

-- documents
create index idx_documents_batch       on public.documents (batch_id);
create index idx_documents_department  on public.documents (department_id);

-- onboarding_checklists
create index idx_checklists_intern     on public.onboarding_checklists (intern_id);
create index idx_checklists_status     on public.onboarding_checklists (status);

-- task_templates
create index idx_task_templates_dept   on public.task_templates (department_id);

-- tasks
create index idx_tasks_internship      on public.tasks (internship_id);
create index idx_tasks_internship_status on public.tasks (internship_id, status);
create index idx_tasks_status_priority on public.tasks (status, priority);
create index idx_tasks_deadline        on public.tasks (deadline) where deadline is not null;
create index idx_tasks_created_by      on public.tasks (created_by);

-- task_comments
create index idx_task_comments_task    on public.task_comments (task_id);

-- task_attachments
create index idx_task_attachments_task on public.task_attachments (task_id);

-- attendance
create index idx_attendance_intern_date on public.attendance (intern_id, work_date);
create index idx_attendance_status     on public.attendance (status);
create index idx_attendance_location   on public.attendance (location_id);
create index idx_attendance_internship on public.attendance (internship_id);
create index idx_attendance_work_date  on public.attendance (work_date);

-- requests
create index idx_leave_intern          on public.leave_requests (intern_id);
create index idx_leave_status          on public.leave_requests (status);
create index idx_leave_intern_status   on public.leave_requests (intern_id, status);
create index idx_wfh_intern            on public.work_from_home_requests (intern_id);
create index idx_wfh_status            on public.work_from_home_requests (status);
create index idx_late_intern           on public.late_requests (intern_id);
create index idx_late_status           on public.late_requests (status);

-- reports
create index idx_daily_intern_date     on public.daily_reports (intern_id, report_date);
create index idx_daily_status          on public.daily_reports (status);
create index idx_weekly_intern_week    on public.weekly_reports (intern_id, week_start);
create index idx_weekly_status         on public.weekly_reports (status);

-- evaluations
create index idx_evaluations_internship on public.evaluations (internship_id);
create index idx_evaluations_reviewer   on public.evaluations (reviewer_id);
create index idx_evaluations_type       on public.evaluations (type);

-- evaluation_scores
create index idx_escores_evaluation    on public.evaluation_scores (evaluation_id);
create index idx_escores_criterion     on public.evaluation_scores (criterion_id);

-- certificates
create index idx_certificates_intern   on public.certificates (intern_id);
create index idx_certificates_status   on public.certificates (status);

-- notifications
create index idx_notifications_user    on public.notifications (user_id, created_at desc);
create index idx_notifications_user_read on public.notifications (user_id) where read_at is null;

-- notification_devices
create index idx_devices_user          on public.notification_devices (user_id);

-- audit_logs
create index idx_audit_user            on public.audit_logs (user_id, created_at desc);
create index idx_audit_entity          on public.audit_logs (entity, entity_id);