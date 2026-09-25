-- ==========================================================================
-- IMS – 0011_task_management.sql
-- Hoàn thiện Task Management theo spec:
--   * Task cá nhân / Task nhóm (task_assignees)
--   * Sub-task (task_subtasks)
--   * Deliverable + attachment (tasks.deliverables jsonb, storage task-attachments)
--   * Submission history (task_submissions + task_submission_files/links)
--   * Review history + score cấu hình trọng số (task_reviews + system_settings 'task_score')
-- Mô hình trạng thái:
--   not_started → in_progress → in_review → [completed | changes_requested] → (có thể resubmit)
--
-- Idempotent: tạo enum nếu thiếu; policy/trigger/table được reset theo thiết kế migration gốc.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 0. Enums
-- --------------------------------------------------------------------------
-- Enum task_status: tạo nếu chưa có, hoặc nâng cấp enum cũ.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'task_status'
  ) then
    create type public.task_status as enum (
      'not_started',
      'in_progress',
      'in_review',
      'changes_requested',
      'completed',
      'cancelled'
    );
  else
    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'task_status'
        and e.enumlabel = 'not_started'
    ) and exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'task_status'
        and e.enumlabel = 'todo'
    ) then
      alter type public.task_status rename value 'todo' to 'not_started';
    end if;

    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'task_status'
        and e.enumlabel = 'in_review'
    ) and exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'task_status'
        and e.enumlabel = 'review'
    ) then
      alter type public.task_status rename value 'review' to 'in_review';
    end if;

    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'task_status'
        and e.enumlabel = 'completed'
    ) and exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'task_status'
        and e.enumlabel = 'done'
    ) then
      alter type public.task_status rename value 'done' to 'completed';
    end if;

    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'task_status'
        and e.enumlabel = 'changes_requested'
    ) then
      alter type public.task_status add value 'changes_requested';
    end if;

    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'task_status'
        and e.enumlabel = 'cancelled'
    ) then
      alter type public.task_status add value 'cancelled';
    end if;
  end if;
end $$;

-- task_assignment_type / review_decision / review_completion: idempotent
do $$
begin
  if not exists (
        select 1 from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typname = 'task_assignment_type'
      ) then
    create type public.task_assignment_type as enum ('individual', 'team');
  end if;
end $$;

do $$
begin
  if not exists (
        select 1 from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typname = 'review_decision'
      ) then
    create type public.review_decision as enum ('approved', 'changes_requested', 'rejected');
  end if;
end $$;

do $$
begin
  if not exists (
        select 1 from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typname = 'review_completion'
      ) then
    create type public.review_completion as enum ('none', 'partial', 'complete');
  end if;
end $$;

-- notification_type: tạo nếu chưa có, hoặc bổ sung loại thông báo task review.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'notification_type'
  ) then
    create type public.notification_type as enum (
      'task_assigned',
      'task_review_approved',
      'task_review_changes'
    );
  else
    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'notification_type'
        and e.enumlabel = 'task_assigned'
    ) then
      alter type public.notification_type add value 'task_assigned';
    end if;

    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'notification_type'
        and e.enumlabel = 'task_review_approved'
    ) then
      alter type public.notification_type add value 'task_review_approved';
    end if;

    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'notification_type'
        and e.enumlabel = 'task_review_changes'
    ) then
      alter type public.notification_type add value 'task_review_changes';
    end if;
  end if;
end $$;

-- task_priority: tạo nếu database chưa có enum này.
-- Migration gốc sử dụng public.task_priority cho task_subtasks.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'task_priority'
  ) then
    create type public.task_priority as enum ('low', 'medium', 'high');
  end if;
end $$;

-- --------------------------------------------------------------------------
-- 1. Nâng cấp bảng tasks
-- --------------------------------------------------------------------------
alter table public.tasks add column if not exists assignment_type public.task_assignment_type not null default 'individual';
alter table public.tasks add column if not exists project text;
alter table public.tasks add column if not exists module text;
alter table public.tasks add column if not exists task_type text;
alter table public.tasks add column if not exists start_date timestamptz;
alter table public.tasks add column if not exists objective text;
alter table public.tasks add column if not exists requirements text;
alter table public.tasks add column if not exists acceptance_criteria text;
alter table public.tasks add column if not exists deliverables jsonb not null default '[]'::jsonb;

-- --------------------------------------------------------------------------
-- 2. Các bảng con của task
-- --------------------------------------------------------------------------

-- 2.1 task_assignees: danh sách thành viên được giao (1..n cho group task)
drop table if exists public.task_assignees;
create table public.task_assignees (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  intern_id   uuid not null references public.interns(id) on delete cascade,
  role        text not null default 'assignee'
              check (role in ('assignee', 'lead', 'reviewer')),
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint task_assignees_unique unique (task_id, intern_id)
);

-- 2.2 task_subtasks: chia nhỏ task nhóm, mỗi sub-task gán cho một thành viên
drop table if exists public.task_subtasks;
create table public.task_subtasks (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null references public.tasks(id) on delete cascade,
  title          text not null,
  description    text,
  assignee_id    uuid references public.interns(id) on delete set null,
  start_date     timestamptz,
  due_date       timestamptz,
  priority       public.task_priority not null default 'medium',
  status         public.task_status not null default 'not_started',
  deliverable    text,
  result_summary text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 2.3 task_submissions: lịch sử nộp bài (mỗi lần nộp là một dòng)
drop table if exists public.task_submissions;
create table public.task_submissions (
  id                     uuid primary key default gen_random_uuid(),
  task_id                uuid not null references public.tasks(id) on delete cascade,
  subtask_id             uuid references public.task_subtasks(id) on delete set null,
  submitted_by           uuid not null references public.profiles(id) on delete cascade,
  work_summary           text,
  implementation_details text,
  problems               text,
  solutions              text,
  notes                  text,
  submission_no          int  not null default 1,
  submitted_at           timestamptz not null default now()
);

-- 2.4 task_submission_files
drop table if exists public.task_submission_files;
create table public.task_submission_files (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.task_submissions(id) on delete cascade,
  file_path     text not null,
  file_name     text not null,
  mime_type     text,
  file_size     bigint,
  created_at    timestamptz not null default now()
);

-- 2.5 task_submission_links
drop table if exists public.task_submission_links;
create table public.task_submission_links (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.task_submissions(id) on delete cascade,
  title         text,
  url           text not null,
  created_at    timestamptz not null default now()
);

-- 2.6 task_reviews: lịch sử đánh giá (approve / request changes / reject)
drop table if exists public.task_reviews;
create table public.task_reviews (
  id                 uuid primary key default gen_random_uuid(),
  task_id            uuid not null references public.tasks(id) on delete cascade,
  subtask_id         uuid references public.task_subtasks(id) on delete set null,
  submission_id      uuid references public.task_submissions(id) on delete set null,
  reviewer_id        uuid not null references public.profiles(id) on delete cascade,
  decision           public.review_decision not null,
  completion         public.review_completion not null default 'complete',
  completion_pct     numeric(5,2) check (completion_pct between 0 and 100),
  quality_score      numeric(3,1) check (quality_score between 1 and 5),
  technical_score    numeric(3,1) check (technical_score between 1 and 5),
  documentation_score numeric(3,1) check (documentation_score between 1 and 5),
  soft_score         numeric(3,1) check (soft_score between 1 and 5),
  deadline_bucket    text check (deadline_bucket in ('on_time', 'late')),
  feedback           text,
  strengths          text,
  weaknesses         text,
  improvements       text,
  final_score        numeric(5,2) check (final_score between 0 and 10),
  reviewed_at        timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

-- Indexes
create index if not exists idx_task_assignees_task   on public.task_assignees (task_id);
create index if not exists idx_task_assignees_intern on public.task_assignees (intern_id);
create index if not exists idx_task_subtasks_task    on public.task_subtasks (task_id);
create index if not exists idx_task_subtasks_assignee on public.task_subtasks (assignee_id);
create index if not exists idx_task_submissions_task on public.task_submissions (task_id);
create index if not exists idx_task_submissions_subtask on public.task_submissions (subtask_id);
create index if not exists idx_task_submission_files_sub on public.task_submission_files (submission_id);
create index if not exists idx_task_submission_links_sub on public.task_submission_links (submission_id);
create index if not exists idx_task_reviews_task on public.task_reviews (task_id);
create index if not exists idx_task_reviews_submission on public.task_reviews (submission_id);

-- --------------------------------------------------------------------------
-- 3. Helper functions (security definer, bỏ qua RLS — dùng trong policy)
-- --------------------------------------------------------------------------

-- Tất cả task mà intern hiện tại được giao hoặc thuộc internship của mình.
create or replace function public.get_my_task_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select array_agg(distinct t.id)
  from public.tasks t
  where t.internship_id = any (public.get_my_internship_ids())
     or t.id in (
          select ta.task_id
          from public.task_assignees ta
          join public.interns i on i.id = ta.intern_id
          where i.user_id = auth.uid() and i.deleted_at is null
        );
$$;

-- Người dùng hiện tại có tham gia / được ủy quyền trên task?
create or replace function public.is_task_participant(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and (
        t.created_by = auth.uid()
        or t.internship_id = any (public.get_my_internship_ids())
        or public.is_mentor_of_internship(t.internship_id)
        or public.is_hr_or_admin()
      )
  ) or exists (
    select 1 from public.tasks t2
    join public.task_assignees ta on ta.task_id = t2.id
    join public.interns i on i.id = ta.intern_id
    where t2.id = p_task_id and i.user_id = auth.uid() and i.deleted_at is null
  );
$$;

-- Staff (mentor phụ trách / tác giả / hr / admin) của task?
create or replace function public.is_staff_of_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and (
        public.is_hr_or_admin()
        or public.is_mentor_of_internship(t.internship_id)
        or t.created_by = auth.uid()
      )
  );
$$;

-- Ai được ghi file (attachments cho staff; submissions cho member)?
create or replace function public.can_attach_task_file(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff_of_task(p_task_id) or public.is_task_participant(p_task_id);
$$;

-- --------------------------------------------------------------------------
-- 4. RLS cho bảng task mới (+ bổ sung policy trên tasks)
-- --------------------------------------------------------------------------
grant execute on function public.get_my_task_ids() to anon, authenticated, service_role;
grant execute on function public.is_task_participant(uuid) to anon, authenticated, service_role;
grant execute on function public.is_staff_of_task(uuid) to anon, authenticated, service_role;
grant execute on function public.can_attach_task_file(uuid) to anon, authenticated, service_role;

-- 4.0 tasks: intern thấy task mình được gán (kể cả group task)
drop policy if exists tasks_select_member on public.tasks;
create policy tasks_select_member on public.tasks
  for select to authenticated
  using (id = any (public.get_my_task_ids()));

-- 4.1 task_assignees
alter table public.task_assignees enable row level security;

drop policy if exists assignees_select on public.task_assignees;
create policy assignees_select on public.task_assignees
  for select to authenticated
  using (
    intern_id = public.get_my_intern_id()
    or task_id = any (public.get_my_task_ids())
    or public.is_staff_of_task(task_id)
  );

drop policy if exists assignees_write_staff on public.task_assignees;
create policy assignees_write_staff on public.task_assignees
  for all to authenticated
  using (public.is_staff_of_task(task_id))
  with check (public.is_staff_of_task(task_id));

-- 4.2 task_subtasks
alter table public.task_subtasks enable row level security;

drop policy if exists subtasks_select on public.task_subtasks;
create policy subtasks_select on public.task_subtasks
  for select to authenticated
  using (
    task_id = any (public.get_my_task_ids())
    or assignee_id = public.get_my_intern_id()
    or public.is_staff_of_task(task_id)
  );

drop policy if exists subtasks_write_staff on public.task_subtasks;
create policy subtasks_write_staff on public.task_subtasks
  for all to authenticated
  using (public.is_staff_of_task(task_id))
  with check (public.is_staff_of_task(task_id));

drop policy if exists subtasks_update_member on public.task_subtasks;
create policy subtasks_update_member on public.task_subtasks
  for update to authenticated
  using (assignee_id = public.get_my_intern_id())
  with check (assignee_id = public.get_my_intern_id());

-- 4.3 task_submissions
alter table public.task_submissions enable row level security;

drop policy if exists submissions_select on public.task_submissions;
create policy submissions_select on public.task_submissions
  for select to authenticated
  using (
    task_id = any (public.get_my_task_ids())
    or public.is_staff_of_task(task_id)
  );

drop policy if exists submissions_insert_member on public.task_submissions;
create policy submissions_insert_member on public.task_submissions
  for insert to authenticated
  with check (
    task_id = any (public.get_my_task_ids())
    and submitted_by = auth.uid()
  );

-- 4.4 task_submission_files
alter table public.task_submission_files enable row level security;

drop policy if exists submission_files_select on public.task_submission_files;
create policy submission_files_select on public.task_submission_files
  for select to authenticated
  using (
    submission_id in (
      select s.id from public.task_submissions s
      where s.task_id = any (public.get_my_task_ids())
         or public.is_staff_of_task(s.task_id)
    )
  );

drop policy if exists submission_files_insert_owner on public.task_submission_files;
create policy submission_files_insert_owner on public.task_submission_files
  for insert to authenticated
  with check (
    submission_id in (
      select s.id from public.task_submissions s
      where s.submitted_by = auth.uid()
    )
  );

drop policy if exists submission_files_delete_owner on public.task_submission_files;
create policy submission_files_delete_owner on public.task_submission_files
  for delete to authenticated
  using (
    submission_id in (
      select s.id from public.task_submissions s
      where s.submitted_by = auth.uid()
    )
  );

-- 4.5 task_submission_links
alter table public.task_submission_links enable row level security;

drop policy if exists submission_links_select on public.task_submission_links;
create policy submission_links_select on public.task_submission_links
  for select to authenticated
  using (
    submission_id in (
      select s.id from public.task_submissions s
      where s.task_id = any (public.get_my_task_ids())
         or public.is_staff_of_task(s.task_id)
    )
  );

drop policy if exists submission_links_insert_owner on public.task_submission_links;
create policy submission_links_insert_owner on public.task_submission_links
  for insert to authenticated
  with check (
    submission_id in (
      select s.id from public.task_submissions s
      where s.submitted_by = auth.uid()
    )
  );

drop policy if exists submission_links_delete_owner on public.task_submission_links;
create policy submission_links_delete_owner on public.task_submission_links
  for delete to authenticated
  using (
    submission_id in (
      select s.id from public.task_submissions s
      where s.submitted_by = auth.uid()
    )
  );

-- 4.6 task_reviews
alter table public.task_reviews enable row level security;

drop policy if exists reviews_select on public.task_reviews;
create policy reviews_select on public.task_reviews
  for select to authenticated
  using (
    task_id = any (public.get_my_task_ids())
    or public.is_staff_of_task(task_id)
  );

drop policy if exists reviews_write_staff on public.task_reviews;
create policy reviews_write_staff on public.task_reviews
  for all to authenticated
  using (public.is_staff_of_task(task_id))
  with check (public.is_staff_of_task(task_id));

-- --------------------------------------------------------------------------
-- 5. Storage: cho phép participants đọc/gửi file task-attachments
--    Path chuẩn mới:  task-attachments/<task_id>/attachments/<file>   (staff)
--                     task-attachments/<task_id>/submissions/.../     (intern)
--    (giữ nguyên policy cũ dùng thư mục <user_id>/... cho tương thích)
-- --------------------------------------------------------------------------
drop policy if exists taskatts_read_participant on storage.objects;
create policy taskatts_read_participant on storage.objects
  for select to authenticated
  using (bucket_id = 'task-attachments' and public.is_task_participant((storage.foldername(name))[1]::uuid));

drop policy if exists taskatts_insert_participant on storage.objects;
create policy taskatts_insert_participant on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-attachments'
    and public.can_attach_task_file((storage.foldername(name))[1]::uuid)
    and (
      (storage.foldername(name))[2] = 'submissions'
      or public.is_staff_of_task((storage.foldername(name))[1]::uuid)
    )
  );

drop policy if exists taskatts_delete_participant on storage.objects;
create policy taskatts_delete_participant on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-attachments'
    and (public.is_staff_of_task((storage.foldername(name))[1]::uuid)
         or owner = auth.uid())
  );

-- --------------------------------------------------------------------------
-- 6. Triggers
-- --------------------------------------------------------------------------

-- 6.1 Intern không tự đánh dấu completed/cancelled (phiên bản server-side)
create or replace function public.tg_task_restrict_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status is distinct from OLD.status
     and public.get_my_role() = 'intern'
     and NEW.status in ('completed', 'cancelled') then
    raise exception 'Intern không được tự đánh dấu task hoàn thành hoặc hủy';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_task_restrict_status on public.tasks;
create trigger trg_task_restrict_status
before update on public.tasks
for each row execute function public.tg_task_restrict_status();

-- 6.2 Nộp bài → task chuyển in_review
create or replace function public.tg_task_submission_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tasks
     set status = 'in_review', updated_at = now()
   where id = NEW.task_id
     and status not in ('completed', 'cancelled');
  if NEW.subtask_id is not null then
    update public.task_subtasks
       set status = 'in_review', updated_at = now()
     where id = NEW.subtask_id
       and status not in ('completed', 'cancelled');
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_task_submission_status on public.task_submissions;
create trigger trg_task_submission_status
after insert on public.task_submissions
for each row execute function public.tg_task_submission_status();

-- 6.3 Tính final_score theo trọng số (system_settings 'task_score')
create or replace function public.tg_task_review_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_w jsonb;
  v_completion numeric;
  v_quality numeric;
  v_technical numeric;
  v_doc numeric;
  v_deadline numeric;
begin
  select value into v_w from public.system_settings where key = 'task_score';
  if v_w is null then
    v_w := '{"completion":0.30,"quality":0.30,"technical":0.20,"deadline":0.10,"documentation":0.10}'::jsonb;
  end if;

  v_completion := coalesce(NEW.completion_pct,
    case NEW.completion when 'complete' then 100 when 'partial' then 50 else 0 end);
  v_completion := v_completion / 100.0 * 10.0;

  v_quality   := coalesce(NEW.quality_score, 0) * 2.0;
  v_technical := coalesce(NEW.technical_score, 0) * 2.0;
  v_doc       := coalesce(NEW.documentation_score, 0) * 2.0;
  v_deadline  := case coalesce(NEW.deadline_bucket, 'late') when 'on_time' then 10.0 else 5.0 end;

  NEW.final_score := round(
      v_completion * coalesce((v_w->>'completion')::numeric, 0.30)
    + v_quality    * coalesce((v_w->>'quality')::numeric,    0.30)
    + v_technical  * coalesce((v_w->>'technical')::numeric,  0.20)
    + v_deadline   * coalesce((v_w->>'deadline')::numeric,   0.10)
    + v_doc        * coalesce((v_w->>'documentation')::numeric, 0.10)
  , 2);
  return NEW;
end;
$$;

drop trigger if exists trg_task_review_score on public.task_reviews;
create trigger trg_task_review_score
before insert or update on public.task_reviews
for each row execute function public.tg_task_review_score();

-- 6.4 Áp trạng thái khi review
create or replace function public.tg_task_review_apply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.decision = 'approved' then
    update public.tasks
       set status = 'completed', completed_at = now(), updated_at = now()
     where id = NEW.task_id;
    if NEW.subtask_id is not null then
      update public.task_subtasks set status = 'completed', updated_at = now()
       where id = NEW.subtask_id;
    end if;
  else
    update public.tasks
       set status = 'changes_requested', updated_at = now()
     where id = NEW.task_id and status <> 'completed';
    if NEW.subtask_id is not null then
      update public.task_subtasks set status = 'changes_requested', updated_at = now()
       where id = NEW.subtask_id and status <> 'completed';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_task_review_apply on public.task_reviews;
create trigger trg_task_review_apply
after insert or update on public.task_reviews
for each row execute function public.tg_task_review_apply();

-- --------------------------------------------------------------------------
-- 7. Notification triggers (giao việc / review)
-- --------------------------------------------------------------------------

-- 7.1 Giao việc / gán thành viên mới
create or replace function public.tg_notify_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uids uuid[];
begin
  v_uids := array(
    select i.user_id
    from public.task_assignees ta
    join public.interns i on i.id = ta.intern_id
    where ta.task_id = NEW.task_id and i.user_id is not null
    limit 50
  );
  insert into public.notifications (user_id, type, title, body, data)
  select u,
         'task_assigned'::public.notification_type,
         'Công việc mới',
         format('Bạn được giao công việc: %s.', (select t.title from public.tasks t where t.id = NEW.task_id)),
         jsonb_build_object('table', 'tasks', 'id', NEW.task_id, 'assignee_id', NEW.intern_id)
  from unnest(v_uids) as u;
  return NEW;
end;
$$;

drop trigger if exists trg_notif_task_assigned on public.task_assignees;
create trigger trg_notif_task_assigned
after insert on public.task_assignees
for each row execute function public.tg_notify_task_assignment();

-- 7.2 Review task → thông báo cho member được review
create or replace function public.tg_notify_task_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uids uuid[];
  v_type public.notification_type;
  v_verb text;
begin
  v_type := case NEW.decision
    when 'approved' then 'task_review_approved'::public.notification_type
    else 'task_review_changes'::public.notification_type
  end;
  v_verb := case NEW.decision
    when 'approved' then 'đã được duyệt'
    when 'changes_requested' then 'cần chỉnh sửa'
    else 'không đạt'
  end;

  v_uids := array(
    select i.user_id
    from public.task_assignees ta
    join public.interns i on i.id = ta.intern_id
    where ta.task_id = NEW.task_id and i.user_id is not null
    limit 50
  );
  insert into public.notifications (user_id, type, title, body, data)
  select u,
         v_type,
         'Kết quả công việc',
         format('Công việc "%s" %s.', (select t.title from public.tasks t where t.id = NEW.task_id), v_verb),
         jsonb_build_object('table', 'tasks', 'id', NEW.task_id, 'review_id', NEW.id)
  from unnest(v_uids) as u;
  return NEW;
end;
$$;

drop trigger if exists trg_notif_task_review on public.task_reviews;
create trigger trg_notif_task_review
after insert on public.task_reviews
for each row execute function public.tg_notify_task_review();