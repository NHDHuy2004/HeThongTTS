-- ==========================================================================
-- IMS – 0004_functions_triggers.sql
-- Triggers duy trì dữ liệu + helper security + hàm KPI.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 4.1. set_updated_at: cập nhật cột updated_at của bảng có cột đó
-- --------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_departments_updated on public.departments;
create trigger trg_departments_updated before update on public.departments
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_batches_updated on public.internship_batches;
create trigger trg_batches_updated before update on public.internship_batches
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_interns_updated on public.interns;
create trigger trg_interns_updated before update on public.interns
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_mentors_updated on public.mentors;
create trigger trg_mentors_updated before update on public.mentors
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_internships_updated on public.internships;
create trigger trg_internships_updated before update on public.internships
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_documents_updated on public.documents;
create trigger trg_documents_updated before update on public.documents
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_checklists_updated on public.onboarding_checklists;
create trigger trg_checklists_updated before update on public.onboarding_checklists
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_templates_updated on public.task_templates;
create trigger trg_templates_updated before update on public.task_templates
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_tasks_updated on public.tasks;
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_attendance_updated on public.attendance;
create trigger trg_attendance_updated before update on public.attendance
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_leave_updated on public.leave_requests;
create trigger trg_leave_updated before update on public.leave_requests
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_wfh_updated on public.work_from_home_requests;
create trigger trg_wfh_updated before update on public.work_from_home_requests
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_late_updated on public.late_requests;
create trigger trg_late_updated before update on public.late_requests
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_daily_updated on public.daily_reports;
create trigger trg_daily_updated before update on public.daily_reports
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_weekly_updated on public.weekly_reports;
create trigger trg_weekly_updated before update on public.weekly_reports
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_criteria_updated on public.evaluation_criteria;
create trigger trg_criteria_updated before update on public.evaluation_criteria
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_evals_updated on public.evaluations;
create trigger trg_evals_updated before update on public.evaluations
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_escores_updated on public.evaluation_scores;
create trigger trg_escores_updated before update on public.evaluation_scores
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_certificates_updated on public.certificates;
create trigger trg_certificates_updated before update on public.certificates
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_settings_updated on public.system_settings;
create trigger trg_settings_updated before update on public.system_settings
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_locations_updated on public.attendance_locations;
create trigger trg_locations_updated before update on public.attendance_locations
  for each row execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 4.2. handle_new_user: tạo profile tự động khi user được tạo auth.users
--       (xử lý cả signup lẫn admin admin.createUser)
-- --------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_id uuid;
  v_full_name text;
begin
  select id into v_role_id from public.roles where code = 'intern';
  if not found then
    v_role_id := null;
  end if;

  v_full_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, full_name, role_id)
  values (new.id, new.email, v_full_name, v_role_id)
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------------------
-- 4.3. AUDIT LOG trigger: ghi INSERT/UPDATE/DELETE bảng trọng yếu
-- --------------------------------------------------------------------------
create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_entity text := tg_table_name;
  v_entity_id uuid;
  v_action text;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'INSERT';
    v_entity_id := NEW.id;
    v_new := to_jsonb(NEW);
  elsif tg_op = 'UPDATE' then
    v_action := 'UPDATE';
    v_entity_id := NEW.id;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    -- bỏ qua nếu không có gì đổi (vd chỉ updated_at)
    if v_old #>> '{}' = v_new #>> '{}' then
      return new;
    end if;
  else -- DELETE
    v_action := 'DELETE';
    v_entity_id := OLD.id;
    v_old := to_jsonb(OLD);
  end if;

  insert into public.audit_logs (user_id, action, entity, entity_id, old_data, new_data)
  values (v_user, v_action, v_entity, v_entity_id, v_old, v_new);

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_interns on public.interns;
create trigger trg_audit_interns after insert or update or delete on public.interns
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_mentors on public.mentors;
create trigger trg_audit_mentors after insert or update or delete on public.mentors
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_internships on public.internships;
create trigger trg_audit_internships after insert or update or delete on public.internships
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_tasks on public.tasks;
create trigger trg_audit_tasks after insert or update or delete on public.tasks
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_evaluations on public.evaluations;
create trigger trg_audit_evaluations after insert or update or delete on public.evaluations
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_certificates on public.certificates;
create trigger trg_audit_certificates after insert or update or delete on public.certificates
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_leave on public.leave_requests;
create trigger trg_audit_leave after insert or update or delete on public.leave_requests
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_wfh on public.work_from_home_requests;
create trigger trg_audit_wfh after insert or update or delete on public.work_from_home_requests
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_late on public.late_requests;
create trigger trg_audit_late after insert or update or delete on public.late_requests
  for each row execute function public.log_audit();

-- --------------------------------------------------------------------------
-- 4.4. Helper security cho RLS (SECURITY DEFINER, đọc từ DB, không tin client)
-- --------------------------------------------------------------------------

-- Role của người dùng hiện tại (null nếu chưa có hồ sơ)
create or replace function public.get_my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select r.code
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid();
$$;

-- Người dùng hiện tại có phải admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.roles r
    join public.profiles p on p.role_id = r.id
    where p.id = auth.uid() and r.code = 'admin'
  );
$$;

-- HR hoặc Admin (có quyền nghiệp vụ rộng)
create or replace function public.is_hr_or_admin()
returns boolean
language sql
stable
as $$
  select public.get_my_role() in ('hr', 'admin');
$$;

-- intern.id ứng với người dùng hiện tại (rỗng nếu không phải intern)
create or replace function public.get_my_intern_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.interns where user_id = auth.uid() and deleted_at is null limit 1;
$$;

-- các internship.id của intern hiện tại
create or replace function public.get_my_internship_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select array_agg(id)
  from public.internships
  where intern_id = public.get_my_intern_id()
    and deleted_at is null;
$$;

-- user_id có phải là mentor phụ trách intern (theo intern_id)?
create or replace function public.is_mentor_of_intern(p_intern_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.internships ip
    join public.mentors m on m.id = ip.mentor_id
    where ip.intern_id = p_intern_id
      and ip.deleted_at is null
      and m.user_id = auth.uid()
  );
$$;

-- user_id (auth id) có phải mentor phụ trách intern có user_id = target_user_id?
create or replace function public.is_mentor_of(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.interns i
    join public.internships ip on ip.intern_id = i.id
    join public.mentors m on m.id = ip.mentor_id
    where i.user_id = target_user_id
      and i.deleted_at is null
      and ip.deleted_at is null
      and m.user_id = auth.uid()
  );
$$;

-- intern có thuộc phòng ban mà mentor hiện tại quản lý không?
create or replace function public.is_mentor_of_internship(p_internship_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.internships ip
    join public.mentors m on m.id = ip.mentor_id
    where ip.id = p_internship_id
      and ip.deleted_at is null
      and m.user_id = auth.uid()
  );
$$;

-- --------------------------------------------------------------------------
-- 4.5. KPI / ANALYTICS functions
-- --------------------------------------------------------------------------

-- Attendance rate của internship (đã active)
create or replace function public.attendance_rate(p_internship_id uuid)
returns numeric
language sql
stable
as $$
  select case when count(*) = 0 then 0 else
      round(100.0 * count(*) filter (where status in ('present', 'late')) / count(*), 1)
    end
  from public.attendance
  where internship_id = p_internship_id;
$$;

-- Task completion rate
create or replace function public.task_completion_rate(p_internship_id uuid)
returns numeric
language sql
stable
as $$
  select case when count(*) = 0 then 0 else
      round(100.0 * count(*) filter (where status = 'done') / count(*), 1)
    end
  from public.tasks
  where internship_id = p_internship_id;
$$;

-- Report submission rate (số report đã nộp so với số ngày check-in đã có)
create or replace function public.report_submission_rate(p_internship_id uuid)
returns numeric
language sql
stable
as $$
  select case
    when (select count(*) from public.attendance where internship_id = p_internship_id) = 0 then 0
    else round(100.0 *
      (select count(*) from public.daily_reports where internship_id = p_internship_id and status in ('submitted', 'approved')) /
      (select count(*) from public.attendance where internship_id = p_internship_id), 1)
  end;
$$;

-- Dashboard tổng (chỉ admin/hr) — trả jsonb
create or replace function public.get_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_hr_or_admin() then
    raise exception 'PERMISSION_DENIED';
  end if;

  select jsonb_build_object(
    'total_interns',       (select count(*) from public.interns where deleted_at is null),
    'total_mentors',       (select count(*) from public.mentors where deleted_at is null),
    'total_batches',       (select count(*) from public.internship_batches where deleted_at is null),
    'interns_active',      (select count(*) from public.internships where status = 'active' and deleted_at is null),
    'interns_completed',   (select count(*) from public.internships where status = 'completed' and deleted_at is null),
    'converted',           (select count(*) from public.internships where converted_to_employee and deleted_at is null),
    'attendance_rate',     (select round(100.0 * count(*) filter (where status in ('present','late')) / nullif(count(*), 0), 1)
                            from public.attendance),
    'task_completion_rate',(select round(100.0 * count(*) filter (where status = 'done') / nullif(count(*), 0), 1)
                            from public.tasks),
    'avg_evaluation',      (select round(avg(final_score)::numeric, 1) from public.evaluations where final_score is not null),
    'attendance_trend',    (select coalesce(jsonb_agg(jsonb_build_object('date', work_date, 'present',
                            count(*))) filter (where status in ('present','late')), '[]')
                            from public.attendance group by work_date order by work_date desc limit 30),
    'tasks_by_status',     (select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb)
                            from (select status, count(*) as cnt from public.tasks group by status) t),
    'batches_by_status',   (select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb)
                            from (select status, count(*) as cnt from public.internship_batches where deleted_at is null group by status) t)
  ) into result;

  return result;
end;
$$;

-- Dashboard của mentor (chỉ mentor)
create or replace function public.get_mentor_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mentor_id uuid;
  result jsonb;
begin
  if public.get_my_role() <> 'mentor' then
    raise exception 'PERMISSION_DENIED';
  end if;

  select id into v_mentor_id from public.mentors where user_id = auth.uid() and deleted_at is null;
  if v_mentor_id is null then
    return '{}'::jsonb;
  end if;

  select jsonb_build_object(
    'interns',        (select count(distinct ip.intern_id)
                        from public.internships ip where ip.mentor_id = v_mentor_id and ip.deleted_at is null),
    'pending_reports',(select count(*) from public.daily_reports dr
                        join public.internships ip on ip.id = dr.internship_id
                        where ip.mentor_id = v_mentor_id and dr.status = 'submitted'),
    'pending_requests', (select
                          (select count(*) from public.leave_requests lr join public.internships ip on ip.id = lr.internship_id
                           where ip.mentor_id = v_mentor_id and lr.status = 'pending')
                          + (select count(*) from public.work_from_home_requests wf join public.internships ip on ip.id = wf.internship_id
                           where ip.mentor_id = v_mentor_id and wf.status = 'pending')
                          + (select count(*) from public.late_requests la join public.internships ip on ip.id = la.internship_id
                           where ip.mentor_id = v_mentor_id and la.status = 'pending')),
    'open_tasks',     (select count(*) from public.tasks t
                        join public.internships ip on ip.id = t.internship_id
                        where ip.mentor_id = v_mentor_id and t.status not in ('done'))
  ) into result;

  return result;
end;
$$;

-- Tổng hợp điểm evaluation (weighted theo tiêu chí)
create or replace function public.calculate_evaluation_score(p_evaluation_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round(sum(es.score * ec.weight)::numeric, 2)
  from public.evaluation_scores es
  join public.evaluation_criteria ec on ec.id = es.criterion_id
  where es.evaluation_id = p_evaluation_id and ec.is_active;
$$;