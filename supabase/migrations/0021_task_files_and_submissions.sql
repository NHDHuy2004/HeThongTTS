-- ==========================================================================
-- IMS – 0021_task_files_and_submissions.sql
-- File giao việc + Video + Bài nộp (file/video) + Submission workflow + Review
--   * task_attachments: file_type, updated_at, index
--   * task_submissions: status lifecycle, reviewed_at
--   * task_submission_files: file_type, uploaded_by
--   * task_reviews: tiêu chí chấm điểm mở rộng (testing, problem solving,
--     communication, teamwork)
--   * Bucket riêng task-submissions (private) + storage policies
--   * Whitelist MIME / dung lượng phía server
--   * Notification: file giao việc mới, bài nộp mới
--   * Audit log cho attachments / submissions / reviews / submission files
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. tasks_attachments (file giao việc)
-- --------------------------------------------------------------------------
alter table public.task_attachments add column if not exists file_type text not null default 'other';
alter table public.task_attachments add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'task_attachments_file_type_check') then
    alter table public.task_attachments
      add constraint task_attachments_file_type_check
      check (file_type in ('document', 'image', 'video', 'other'));
  end if;
end $$;

create index if not exists idx_task_attachments_task on public.task_attachments (task_id);
create index if not exists idx_task_attachments_type on public.task_attachments (file_type);

-- --------------------------------------------------------------------------
-- 2. task_submissions: vòng đời bài nộp
-- --------------------------------------------------------------------------
alter table public.task_submissions add column if not exists status text not null default 'submitted';
alter table public.task_submissions add column if not exists reviewed_at timestamptz;
alter table public.task_submissions add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'task_submissions_status_check') then
    alter table public.task_submissions
      add constraint task_submissions_status_check
      check (status in ('draft', 'submitted', 'in_review', 'changes_requested', 'approved', 'rejected'));
  end if;
end $$;

create index if not exists idx_task_submissions_task on public.task_submissions (task_id);
create index if not exists idx_task_submissions_by on public.task_submissions (submitted_by);
create index if not exists idx_task_submissions_status on public.task_submissions (status);

-- --------------------------------------------------------------------------
-- 3. task_submission_files
-- --------------------------------------------------------------------------
alter table public.task_submission_files add column if not exists file_type text not null default 'other';
alter table public.task_submission_files add column if not exists uploaded_by uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'task_submission_files_file_type_check') then
    alter table public.task_submission_files
      add constraint task_submission_files_file_type_check
      check (file_type in ('document', 'image', 'video', 'other'));
  end if;
end $$;

create index if not exists idx_task_submission_files_submission on public.task_submission_files (submission_id);

-- --------------------------------------------------------------------------
-- 4. task_reviews: mở rộng tiêu chí
-- --------------------------------------------------------------------------
alter table public.task_reviews add column if not exists testing_score numeric(3,1) check (testing_score between 1 and 5);
alter table public.task_reviews add column if not exists problem_solving_score numeric(3,1) check (problem_solving_score between 1 and 5);
alter table public.task_reviews add column if not exists communication_score numeric(3,1) check (communication_score between 1 and 5);
alter table public.task_reviews add column if not exists teamwork_score numeric(3,1) check (teamwork_score between 1 and 5);

create index if not exists idx_task_reviews_task on public.task_reviews (task_id);
create index if not exists idx_task_reviews_submission on public.task_reviews (submission_id);

-- Công thức điểm: bổ sung các tiêu chí mới (trọng số trong system_settings 'task_score')
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
  v_testing numeric;
  v_problem numeric;
  v_comm numeric;
  v_team numeric;
begin
  select value into v_w from public.system_settings where key = 'task_score';
  if v_w is null then
    v_w := '{"completion":0.25,"quality":0.25,"technical":0.20,"deadline":0.05,"documentation":0.05,"testing":0.15,"problem_solving":0.05}'::jsonb;
  end if;

  v_completion := coalesce(NEW.completion_pct,
    case NEW.completion when 'complete' then 100 when 'partial' then 50 else 0 end);
  v_completion := v_completion / 100.0 * 10.0;

  v_quality   := coalesce(NEW.quality_score, 0) * 2.0;
  v_technical := coalesce(NEW.technical_score, 0) * 2.0;
  v_doc       := coalesce(NEW.documentation_score, 0) * 2.0;
  v_deadline  := case coalesce(NEW.deadline_bucket, 'late') when 'on_time' then 10.0 else 5.0 end;
  v_testing   := coalesce(NEW.testing_score, 0) * 2.0;
  v_problem   := coalesce(NEW.problem_solving_score, 0) * 2.0;
  v_comm      := coalesce(NEW.communication_score, 0) * 2.0;
  v_team      := coalesce(NEW.teamwork_score, 0) * 2.0;

  NEW.final_score := round(
      v_completion * coalesce((v_w->>'completion')::numeric, 0.25)
    + v_quality    * coalesce((v_w->>'quality')::numeric,    0.25)
    + v_technical  * coalesce((v_w->>'technical')::numeric,  0.20)
    + v_testing    * coalesce((v_w->>'testing')::numeric,    0.15)
    + v_deadline   * coalesce((v_w->>'deadline')::numeric,   0.05)
    + v_doc        * coalesce((v_w->>'documentation')::numeric, 0.05)
    + v_problem    * coalesce((v_w->>'problem_solving')::numeric, 0.05)
    + v_comm       * coalesce((v_w->>'communication')::numeric, 0)
    + v_team       * coalesce((v_w->>'teamwork')::numeric, 0)
  , 2);
  return NEW;
end;
$$;

-- Áp kết quả review lên submission
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

  if NEW.submission_id is not null then
    update public.task_submissions
       set status = case NEW.decision
                      when 'approved' then 'approved'
                      when 'changes_requested' then 'changes_requested'
                      else 'rejected'
                    end,
           reviewed_at = now(),
           updated_at = now()
     where id = NEW.submission_id;
  end if;
  return NEW;
end;
$$;

-- --------------------------------------------------------------------------
-- 5. Whitelist MIME + dung lượng (server-side)
-- --------------------------------------------------------------------------
create or replace function public.tg_validate_task_file()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mime text := lower(coalesce(NEW.mime_type, ''));
  v_max bigint;
begin
  if v_mime like 'application/pdf%'
     or v_mime like 'application/msword%'
     or v_mime like 'application/vnd.openxmlformats-officedocument%'
     or v_mime = 'application/vnd.ms-excel'
     or v_mime = 'application/vnd.ms-powerpoint'
     or v_mime = 'text/plain'
     or v_mime like 'image/jpeg%'
     or v_mime like 'image/png%'
     or v_mime like 'image/webp%'
     or v_mime like 'video/mp4%'
     or v_mime like 'video/quicktime%'
     or v_mime like 'video/webm%' then
    null;
  else
    raise exception 'Loại file không được hỗ trợ: %', coalesce(NEW.mime_type, '(trống)');
  end if;

  v_max := case when left(v_mime, 5) = 'video' then 500 * 1024 * 1024 else 50 * 1024 * 1024 end;
  if coalesce(NEW.file_size, 0) > v_max then
    raise exception 'File vượt quá dung lượng cho phép (video ≤ 500MB, loại khác ≤ 50MB)';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_validate_task_attachment on public.task_attachments;
create trigger trg_validate_task_attachment
before insert or update on public.task_attachments
for each row execute function public.tg_validate_task_file();

drop trigger if exists trg_validate_submission_file on public.task_submission_files;
create trigger trg_validate_submission_file
before insert or update on public.task_submission_files
for each row execute function public.tg_validate_task_file();

-- --------------------------------------------------------------------------
-- 6. Storage bucket riêng cho bài nộp
-- --------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('task-submissions', 'task-submissions', false)
on conflict (id) do nothing;

update storage.buckets
   set file_size_limit = 500 * 1024 * 1024,
       allowed_mime_types = array[
         'application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-powerpoint',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'text/plain',
         'image/jpeg', 'image/png', 'image/webp',
         'video/mp4', 'video/quicktime', 'video/webm'
       ]
 where id in ('task-attachments', 'task-submissions');

drop policy if exists subatts_read_participant on storage.objects;
create policy subatts_read_participant on storage.objects
  for select to authenticated
  using (bucket_id = 'task-submissions' and public.is_task_participant((storage.foldername(name))[1]::uuid));

drop policy if exists subatts_insert_owner on storage.objects;
create policy subatts_insert_owner on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-submissions'
    and (storage.foldername(name))[2] in (
      select s.id::text from public.task_submissions s where s.submitted_by = auth.uid()
    )
    and public.is_task_participant((storage.foldername(name))[1]::uuid)
  );

drop policy if exists subatts_delete_owner on storage.objects;
create policy subatts_delete_owner on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-submissions'
    and (
      (storage.foldername(name))[2] in (
        select s.id::text from public.task_submissions s where s.submitted_by = auth.uid()
      )
      or public.is_staff_of_task((storage.foldername(name))[1]::uuid)
    )
  );

-- --------------------------------------------------------------------------
-- 7. Notification: file giao việc mới + bài nộp mới
-- --------------------------------------------------------------------------
create or replace function public.tg_notify_task_attachment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uids uuid[];
begin
  v_uids := array(
    select distinct i.user_id
    from public.task_assignees ta
    join public.interns i on i.id = ta.intern_id
    where ta.task_id = NEW.task_id and i.user_id is not null
  );
  if NEW.file_type = 'video' then
    insert into public.notifications (user_id, type, title, body, data)
    select u, 'task_updated'::public.notification_type, 'Tài liệu task mới',
           format('Task "%s" có video hướng dẫn mới.', (select title from public.tasks where id = NEW.task_id)),
           jsonb_build_object('table', 'tasks', 'id', NEW.task_id, 'attachment_id', NEW.id)
    from unnest(coalesce(v_uids, '{}'::uuid[])) as u;
  else
    insert into public.notifications (user_id, type, title, body, data)
    select u, 'task_updated'::public.notification_type, 'Tài liệu task mới',
           format('Task "%s" có tài liệu mới: %s.', (select title from public.tasks where id = NEW.task_id), NEW.file_name),
           jsonb_build_object('table', 'tasks', 'id', NEW.task_id, 'attachment_id', NEW.id)
    from unnest(coalesce(v_uids, '{}'::uuid[])) as u;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notif_task_attachment on public.task_attachments;
create trigger trg_notif_task_attachment
after insert on public.task_attachments
for each row execute function public.tg_notify_task_attachment();

create or replace function public.tg_notify_task_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uids uuid[];
begin
  select array_agg(distinct u) into v_uids
  from (
    select t.created_by as u from public.tasks t where t.id = NEW.task_id and t.created_by is not null
    union
    select m.user_id as u
    from public.tasks t
    join public.internships ip on ip.id = t.internship_id
    join public.mentors m on m.id = ip.mentor_id
    where t.id = NEW.task_id and m.user_id is not null
  ) x;

  -- chỉ giữ user hợp lệ (profiles)
  insert into public.notifications (user_id, type, title, body, data)
  select u, 'task_updated'::public.notification_type, 'Bài nộp mới',
         format('%s đã nộp bài cho task "%s".',
                (select full_name from public.profiles where id = NEW.submitted_by),
                (select title from public.tasks where id = NEW.task_id)),
         jsonb_build_object('table', 'tasks', 'id', NEW.task_id, 'submission_id', NEW.id)
  from unnest(coalesce(v_uids, '{}'::uuid[])) as u
  join public.profiles p on p.id = u;
  return NEW;
end;
$$;

drop trigger if exists trg_notif_task_submission on public.task_submissions;
create trigger trg_notif_task_submission
after insert on public.task_submissions
for each row execute function public.tg_notify_task_submission();

-- --------------------------------------------------------------------------
-- 8. Audit log
-- --------------------------------------------------------------------------
drop trigger if exists trg_audit_task_attachments on public.task_attachments;
create trigger trg_audit_task_attachments
after insert or update or delete on public.task_attachments
for each row execute function public.log_audit();

drop trigger if exists trg_audit_task_submissions on public.task_submissions;
create trigger trg_audit_task_submissions
after insert or update or delete on public.task_submissions
for each row execute function public.log_audit();

drop trigger if exists trg_audit_task_reviews on public.task_reviews;
create trigger trg_audit_task_reviews
after insert or update or delete on public.task_reviews
for each row execute function public.log_audit();

drop trigger if exists trg_audit_task_submission_files on public.task_submission_files;
create trigger trg_audit_task_submission_files
after insert or update or delete on public.task_submission_files
for each row execute function public.log_audit();
