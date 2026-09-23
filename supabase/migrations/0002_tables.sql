-- ==========================================================================
-- IMS – 0002_tables.sql
-- Toàn bộ bảng nghiệp vụ (29 bảng). PK uuid, có updated_at trigger ở 0004.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. roles
-- --------------------------------------------------------------------------
create table public.roles (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  code          public.user_role not null unique,
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 2. profiles (1:1 với auth.users, được tạo tự động bởi trigger handle_new_user)
-- --------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  full_name     text not null,
  avatar_path   text,
  phone         text,
  gender        text check (gender in ('male', 'female', 'other')),
  birth_date    date,
  address       text,
  role_id       uuid references public.roles(id),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 3. departments
-- --------------------------------------------------------------------------
create table public.departments (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  code          text not null unique,
  description   text,
  head_profile_id uuid references public.profiles(id) on delete set null,
  is_active     boolean not null default true,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 4. internship_batches
-- --------------------------------------------------------------------------
create table public.internship_batches (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  code          text not null unique,
  description   text,
  start_date    date not null,
  end_date      date not null,
  max_interns   int check (max_interns >= 1),
  status        public.internship_status not null default 'upcoming',
  location      text,
  created_by    uuid references public.profiles(id) on delete set null,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint batches_dates check (end_date >= start_date)
);

-- --------------------------------------------------------------------------
-- 5. interns
-- --------------------------------------------------------------------------
create table public.interns (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete set null,
  student_code  text not null unique,
  full_name     text not null,
  email         text not null unique,
  phone         text,
  gender        text check (gender in ('male', 'female', 'other')),
  birth_date    date,
  address       text,
  school        text,
  major         text,
  class_name    text,
  cv_file_path  text,
  status        public.intern_status not null default 'pending',
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 6. mentors
-- --------------------------------------------------------------------------
create table public.mentors (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete set null,
  employee_code text not null unique,
  full_name     text not null,
  email         text not null unique,
  phone         text,
  department_id uuid references public.departments(id) on delete set null,
  max_interns   int not null default 10 check (max_interns >= 1),
  is_active     boolean not null default true,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 7. internships (Intern trong 1 đợt + phòng ban + mentor)
-- --------------------------------------------------------------------------
create table public.internships (
  id            uuid primary key default gen_random_uuid(),
  intern_id     uuid not null references public.interns(id) on delete cascade,
  batch_id      uuid not null references public.internship_batches(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  mentor_id     uuid references public.mentors(id) on delete set null,
  status        public.internship_status not null default 'upcoming',
  start_date    date,
  end_date      date,
  final_score   numeric(5,2) check (final_score between 0 and 100),
  converted_to_employee boolean not null default false,
  created_by    uuid references public.profiles(id) on delete set null,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint internships_unique unique (intern_id, batch_id),
  constraint internships_dates check (end_date is null or start_date is null or end_date >= start_date)
);

-- --------------------------------------------------------------------------
-- 8. documents (tài liệu onboarding)
-- --------------------------------------------------------------------------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  bucket        text not null default 'onboarding',
  file_path     text,
  file_url      text,
  mime_type     text,
  file_size     bigint,
  batch_id      uuid references public.internship_batches(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  is_active     boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint documents_target check (not (file_path is null and file_url is null))
);

-- --------------------------------------------------------------------------
-- 9. onboarding_checklists
-- --------------------------------------------------------------------------
create table public.onboarding_checklists (
  id            uuid primary key default gen_random_uuid(),
  intern_id     uuid not null references public.interns(id) on delete cascade,
  title         text not null,
  description   text,
  status        public.onboarding_status not null default 'not_started',
  due_date      date,
  completed_at  timestamptz,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 10. task_templates
-- --------------------------------------------------------------------------
create table public.task_templates (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  department_id   uuid references public.departments(id) on delete set null,
  priority        public.task_priority not null default 'medium',
  estimated_hours numeric(6,2),
  is_active       boolean not null default true,
  created_by      uuid references public.profiles(id) on delete set null,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 11. tasks
-- --------------------------------------------------------------------------
create table public.tasks (
  id               uuid primary key default gen_random_uuid(),
  internship_id    uuid not null references public.internships(id) on delete cascade,
  template_id      uuid references public.task_templates(id) on delete set null,
  title            text not null,
  description      text,
  priority         public.task_priority not null default 'medium',
  status           public.task_status not null default 'todo',
  deadline         timestamptz,
  estimated_hours  numeric(6,2),
  result_summary   text,
  completed_at     timestamptz,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 12. task_comments
-- --------------------------------------------------------------------------
create table public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 13. task_attachments
-- --------------------------------------------------------------------------
create table public.task_attachments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  file_path   text not null,
  file_name   text not null,
  mime_type   text,
  file_size   bigint,
  created_at  timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 14. attendance_locations
-- --------------------------------------------------------------------------
create table public.attendance_locations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  address       text,
  latitude      double precision not null,
  longitude     double precision not null,
  radius_m      numeric(8,2) not null default 200 check (radius_m > 0),
  is_active     boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 15. attendance (1 bản ghi / intern / ngày)
-- --------------------------------------------------------------------------
create table public.attendance (
  id               uuid primary key default gen_random_uuid(),
  intern_id        uuid not null references public.interns(id) on delete cascade,
  internship_id    uuid references public.internships(id) on delete cascade,
  location_id      uuid references public.attendance_locations(id) on delete set null,
  work_date        date not null,
  check_in_at      timestamptz,
  check_out_at     timestamptz,
  status           public.attendance_status not null default 'absent',
  note             text,
  is_geo_validated boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint attendance_unique_day unique (intern_id, work_date),
  constraint attendance_check check (check_out_at is null or check_in_at is null or check_out_at >= check_in_at)
);

-- --------------------------------------------------------------------------
-- 16. leave_requests
-- --------------------------------------------------------------------------
create table public.leave_requests (
  id            uuid primary key default gen_random_uuid(),
  intern_id     uuid not null references public.interns(id) on delete cascade,
  internship_id uuid references public.internships(id) on delete cascade,
  request_type  public.request_type not null default 'leave',
  start_date    date not null,
  end_date      date not null,
  reason        text not null,
  attachment_path text,
  status        public.request_status not null default 'pending',
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint leave_dates check (end_date >= start_date)
);

-- --------------------------------------------------------------------------
-- 17. work_from_home_requests
-- --------------------------------------------------------------------------
create table public.work_from_home_requests (
  id            uuid primary key default gen_random_uuid(),
  intern_id     uuid not null references public.interns(id) on delete cascade,
  internship_id uuid references public.internships(id) on delete cascade,
  work_date     date not null,
  reason        text not null,
  status        public.request_status not null default 'pending',
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 18. late_requests (đi muộn / về sớm)
-- --------------------------------------------------------------------------
create table public.late_requests (
  id             uuid primary key default gen_random_uuid(),
  intern_id      uuid not null references public.interns(id) on delete cascade,
  internship_id  uuid references public.internships(id) on delete cascade,
  request_type   public.request_type not null default 'late',
  request_date   date not null,
  minutes_late   int check (minutes_late >= 0),
  reason         text not null,
  attachment_path text,
  status         public.request_status not null default 'pending',
  reviewed_by    uuid references public.profiles(id) on delete set null,
  reviewed_at    timestamptz,
  review_note    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 19. daily_reports
-- --------------------------------------------------------------------------
create table public.daily_reports (
  id            uuid primary key default gen_random_uuid(),
  intern_id     uuid not null references public.interns(id) on delete cascade,
  internship_id uuid references public.internships(id) on delete cascade,
  report_date   date not null,
  tasks_done    text,
  results       text,
  difficulties  text,
  next_plan     text,
  status        public.report_status not null default 'draft',
  submitted_at  timestamptz,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  feedback      text,
  score         int check (score between 0 and 100),
  attachments   jsonb default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint daily_report_unique_day unique (intern_id, report_date)
);

-- --------------------------------------------------------------------------
-- 20. weekly_reports
-- --------------------------------------------------------------------------
create table public.weekly_reports (
  id             uuid primary key default gen_random_uuid(),
  intern_id      uuid not null references public.interns(id) on delete cascade,
  internship_id  uuid references public.internships(id) on delete cascade,
  week_start     date not null,
  week_end       date not null,
  work_summary   text,
  results        text,
  skills_learned text,
  difficulties   text,
  next_week_plan text,
  status         public.report_status not null default 'draft',
  submitted_at   timestamptz,
  reviewed_by    uuid references public.profiles(id) on delete set null,
  reviewed_at    timestamptz,
  feedback       text,
  score          int check (score between 0 and 100),
  attachments    jsonb default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint weekly_report_unique unique (intern_id, week_start),
  constraint weekly_dates check (week_end >= week_start)
);

-- --------------------------------------------------------------------------
-- 21. evaluation_criteria
-- --------------------------------------------------------------------------
create table public.evaluation_criteria (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null default 'general',
  description  text,
  weight       numeric(4,3) not null default 0.100 check (weight >= 0 and weight <= 1),
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 22. evaluations
-- --------------------------------------------------------------------------
create table public.evaluations (
  id             uuid primary key default gen_random_uuid(),
  internship_id  uuid not null references public.internships(id) on delete cascade,
  reviewer_id    uuid not null references public.profiles(id) on delete cascade,
  type           public.evaluation_type not null default 'weekly',
  period_label   text not null,
  due_date       date,
  submitted_at   timestamptz,
  final_score    numeric(5,2) check (final_score between 0 and 100),
  summary        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint evaluations_unique unique (internship_id, reviewer_id, type, period_label)
);

-- --------------------------------------------------------------------------
-- 23. evaluation_scores
-- --------------------------------------------------------------------------
create table public.evaluation_scores (
  id            uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  criterion_id  uuid not null references public.evaluation_criteria(id) on delete cascade,
  score         int not null check (score between 0 and 100),
  comment       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint evaluation_scores_unique unique (evaluation_id, criterion_id)
);

-- --------------------------------------------------------------------------
-- 24. certificates
-- --------------------------------------------------------------------------
create table public.certificates (
  id               uuid primary key default gen_random_uuid(),
  internship_id    uuid not null references public.internships(id) on delete cascade,
  intern_id        uuid not null references public.interns(id) on delete cascade,
  certificate_code text not null unique,
  full_name        text not null,
  department_name  text,
  batch_name       text,
  position         text,
  start_date       date,
  end_date         date,
  file_path        text,
  status           public.certificate_status not null default 'draft',
  issued_at        timestamptz,
  signed_by        text,
  signed_title     text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint certificates_unique_internship unique (intern_id, internship_id)
);

-- --------------------------------------------------------------------------
-- 25. notifications
-- --------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       public.notification_type not null default 'system',
  title      text not null,
  body       text,
  data       jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 26. notification_devices
-- --------------------------------------------------------------------------
create table public.notification_devices (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  device_token   text not null unique,
  platform       public.device_platform not null default 'android',
  last_active_at timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 27. audit_logs (CHỈ ghi qua trigger – không ai xóa)
-- --------------------------------------------------------------------------
create table public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  old_data   jsonb,
  new_data   jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 28. system_settings
-- --------------------------------------------------------------------------
create table public.system_settings (
  key          text primary key,
  value        jsonb not null,
  description  text,
  updated_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);