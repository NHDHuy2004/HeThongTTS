-- ==========================================================================
-- IMS – 0020_task_hierarchy.sql
-- Chia Task chung thành nhiều Task con (Parent Task → Child Tasks → Subtasks)
--   * tasks: thêm progress / weight / parent_task_id / root_task_id
--   * task_subtasks: mở rộng thành thực thể "Task con" đầy đủ
--     (parent_subtask_id lồng cấp, progress, weight, estimated_hours,
--      objective/requirements/acceptance_criteria/deliverables, is_required)
--   * Chặn vòng lặp parent↔child, giới hạn độ sâu
--   * Tự động tổng hợp tiến độ Task cha (trung bình theo trọng số)
--   * Task cha chỉ hoàn thành khi mọi Task con bắt buộc đã hoàn thành/hủy
--   * Intern không tự set completed/cancelled, không sửa assignee/deadline/weight/…
--   * Notification (giao việc, review) + Audit log cho task_subtasks
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Mở rộng bảng tasks
-- --------------------------------------------------------------------------
alter table public.tasks add column if not exists progress numeric(5,2) not null default 0;
alter table public.tasks add column if not exists weight numeric(6,2) not null default 0;
alter table public.tasks add column if not exists parent_task_id uuid references public.tasks(id) on delete set null;
alter table public.tasks add column if not exists root_task_id uuid references public.tasks(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_progress_check') then
    alter table public.tasks add constraint tasks_progress_check check (progress between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_weight_check') then
    alter table public.tasks add constraint tasks_weight_check check (weight >= 0);
  end if;
end $$;

create index if not exists idx_tasks_parent on public.tasks (parent_task_id);
create index if not exists idx_tasks_root   on public.tasks (root_task_id);

-- Chặn vòng lặp khi tasks lồng nhau
create or replace function public.tg_task_parent_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_depth int := 0;
begin
  if NEW.parent_task_id is null then
    return NEW;
  end if;
  if NEW.parent_task_id = NEW.id then
    raise exception 'Task không thể là cha của chính nó';
  end if;
  v_pid := NEW.parent_task_id;
  while v_pid is not null loop
    v_depth := v_depth + 1;
    if v_pid = NEW.id then
      raise exception 'Phát hiện vòng lặp parent/child trong tasks';
    end if;
    if v_depth > 8 then
      raise exception 'Cấu trúc task quá sâu';
    end if;
    select parent_task_id into v_pid from public.tasks where id = v_pid;
  end loop;
  return NEW;
end;
$$;

drop trigger if exists trg_task_parent_guard on public.tasks;
create trigger trg_task_parent_guard
before insert or update on public.tasks
for each row execute function public.tg_task_parent_guard();

-- --------------------------------------------------------------------------
-- 2. Mở rộng task_subtasks → thực thể Task con
-- --------------------------------------------------------------------------
alter table public.task_subtasks add column if not exists parent_subtask_id uuid references public.task_subtasks(id) on delete cascade;
alter table public.task_subtasks add column if not exists progress int not null default 0;
alter table public.task_subtasks add column if not exists weight numeric(6,2) not null default 0;
alter table public.task_subtasks add column if not exists estimated_hours numeric(6,2);
alter table public.task_subtasks add column if not exists objective text;
alter table public.task_subtasks add column if not exists requirements text;
alter table public.task_subtasks add column if not exists acceptance_criteria text;
alter table public.task_subtasks add column if not exists deliverables jsonb not null default '[]'::jsonb;
alter table public.task_subtasks add column if not exists is_required boolean not null default true;
alter table public.task_subtasks add column if not exists completed_at timestamptz;
alter table public.task_subtasks add column if not exists sort_order int not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'task_subtasks_progress_check') then
    alter table public.task_subtasks add constraint task_subtasks_progress_check check (progress between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'task_subtasks_weight_check') then
    alter table public.task_subtasks add constraint task_subtasks_weight_check check (weight >= 0);
  end if;
end $$;

create index if not exists idx_task_subtasks_parent on public.task_subtasks (parent_subtask_id);

-- --------------------------------------------------------------------------
-- 3. Chặn vòng lặp & giới hạn độ sâu task_subtasks
--    Cây tối đa: Task cha → Task con (level 1) → Subtask (level 2) → Sub-subtask (level 3)
-- --------------------------------------------------------------------------
create or replace function public.tg_subtask_parent_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_depth int := 1; -- chính nó là level 1
  v_task uuid;
begin
  if NEW.parent_subtask_id is null then
    return NEW;
  end if;
  if NEW.parent_subtask_id = NEW.id then
    raise exception 'Task con không thể là cha của chính nó';
  end if;

  select task_id into v_task from public.task_subtasks where id = NEW.parent_subtask_id;
  if v_task is distinct from NEW.task_id then
    raise exception 'Task con cha phải thuộc cùng Task cha';
  end if;

  v_pid := NEW.parent_subtask_id;
  while v_pid is not null loop
    if v_pid = NEW.id then
      raise exception 'Phát hiện vòng lặp parent/child trong task con';
    end if;
    select parent_subtask_id into v_pid from public.task_subtasks where id = v_pid;
    v_depth := v_depth + 1;
    if v_depth > 3 then
      raise exception 'Độ sâu Task con vượt quá giới hạn (tối đa 3 cấp)';
    end if;
  end loop;
  return NEW;
end;
$$;

drop trigger if exists trg_subtask_parent_guard on public.task_subtasks;
create trigger trg_subtask_parent_guard
before insert or update on public.task_subtasks
for each row execute function public.tg_subtask_parent_guard();

-- --------------------------------------------------------------------------
-- 4. Tiến độ hiệu quả của một Task con (đệ quy: con của nó quyết định tiến độ)
-- --------------------------------------------------------------------------
create or replace function public.subtask_effective_progress(p_subtask_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_self numeric;
  v_total_w numeric;
begin
  select progress into v_self from public.task_subtasks where id = p_subtask_id;
  if v_self is null then return 0; end if;

  select coalesce(sum(weight), 0) into v_total_w
  from public.task_subtasks
  where parent_subtask_id = p_subtask_id and status <> 'cancelled';

  if v_total_w > 0 then
    select coalesce(
             sum(public.subtask_effective_progress(s.id) * s.weight) / nullif(sum(s.weight), 0),
             0)
    into v_self
    from public.task_subtasks s
    where s.parent_subtask_id = p_subtask_id and s.status <> 'cancelled';
    return coalesce(v_self, 0);
  end if;

  -- không có trọng số → trung bình đơn giản của các con chưa huỷ
  select coalesce(avg(public.subtask_effective_progress(s.id)), v_self)
  into v_self
  from public.task_subtasks s
  where s.parent_subtask_id = p_subtask_id and s.status <> 'cancelled';

  return coalesce(v_self, 0);
end;
$$;

-- Tiến độ Task cha = bình quân có trọng số của các Task con cấp 1 (chưa huỷ)
create or replace function public.recompute_task_progress(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_progress numeric;
  v_total_w numeric;
  v_has_children boolean;
begin
  select exists(
    select 1 from public.task_subtasks
    where task_id = p_task_id and parent_subtask_id is null and status <> 'cancelled'
  ) into v_has_children;

  if not v_has_children then
    -- Task đơn (không chia nhỏ): giữ nguyên tiến độ thủ công
    return;
  end if;

  select coalesce(sum(weight), 0) into v_total_w
  from public.task_subtasks
  where task_id = p_task_id and parent_subtask_id is null and status <> 'cancelled';

  if v_total_w > 0 then
    select coalesce(sum(public.subtask_effective_progress(s.id) * s.weight) / nullif(sum(s.weight), 0), 0)
    into v_progress
    from public.task_subtasks s
    where s.task_id = p_task_id and s.parent_subtask_id is null and s.status <> 'cancelled';
  else
    select coalesce(avg(public.subtask_effective_progress(s.id)), 0)
    into v_progress
    from public.task_subtasks s
    where s.task_id = p_task_id and s.parent_subtask_id is null and s.status <> 'cancelled';
  end if;

  update public.tasks
     set progress = round(coalesce(v_progress, 0), 2),
         updated_at = now()
   where id = p_task_id;
end;
$$;

create or replace function public.tg_subtask_progress_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_task_progress(OLD.task_id);
    return OLD;
  end if;
  perform public.recompute_task_progress(NEW.task_id);
  if tg_op = 'UPDATE' and OLD.task_id is distinct from NEW.task_id then
    perform public.recompute_task_progress(OLD.task_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_subtask_progress_sync on public.task_subtasks;
create trigger trg_subtask_progress_sync
after insert or update or delete on public.task_subtasks
for each row execute function public.tg_subtask_progress_sync();

-- --------------------------------------------------------------------------
-- 5. Ràng buộc hoàn thành Task cha
-- --------------------------------------------------------------------------
create or replace function public.tg_parent_complete_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'completed' and OLD.status is distinct from 'completed' then
    if exists (
      select 1 from public.task_subtasks s
      where s.task_id = NEW.id
        and s.is_required
        and s.status not in ('completed', 'cancelled')
    ) then
      raise exception 'Không thể hoàn thành Task cha khi còn Task con bắt buộc chưa hoàn thành';
    end if;
  end if;
  -- Đồng bộ completed_at
  if NEW.status = 'completed' and OLD.status is distinct from 'completed' then
    NEW.completed_at := now();
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_parent_complete_guard on public.tasks;
create trigger trg_parent_complete_guard
before update on public.tasks
for each row execute function public.tg_parent_complete_guard();

-- Task con: set completed_at
create or replace function public.tg_subtask_completed_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'completed' and OLD.status is distinct from 'completed' then
    NEW.completed_at := now();
  elsif NEW.status is distinct from 'completed' then
    NEW.completed_at := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_subtask_completed_at on public.task_subtasks;
create trigger trg_subtask_completed_at
before update on public.task_subtasks
for each row execute function public.tg_subtask_completed_at();

-- --------------------------------------------------------------------------
-- 6. Giới hạn quyền Intern trên Task con
-- --------------------------------------------------------------------------
create or replace function public.tg_subtask_restrict_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status is distinct from OLD.status
     and public.get_my_role() = 'intern'
     and NEW.status in ('completed', 'cancelled') then
    raise exception 'Intern không được tự đánh dấu hoàn thành hoặc hủy Task con';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_subtask_restrict_status on public.task_subtasks;
create trigger trg_subtask_restrict_status
before update on public.task_subtasks
for each row execute function public.tg_subtask_restrict_status();

-- Intern chỉ được sửa progress / status(workflow) / result_summary
create or replace function public.tg_subtask_member_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.get_my_role() <> 'intern' then
    return NEW;
  end if;

  if NEW.assignee_id is distinct from OLD.assignee_id
     or NEW.title is distinct from OLD.title
     or NEW.due_date is distinct from OLD.due_date
     or NEW.start_date is distinct from OLD.start_date
     or NEW.weight is distinct from OLD.weight
     or NEW.priority is distinct from OLD.priority
     or NEW.task_id is distinct from OLD.task_id
     or NEW.parent_subtask_id is distinct from OLD.parent_subtask_id
     or NEW.objective is distinct from OLD.objective
     or NEW.requirements is distinct from OLD.requirements
     or NEW.acceptance_criteria is distinct from OLD.acceptance_criteria
     or NEW.deliverables is distinct from OLD.deliverables
     or NEW.is_required is distinct from OLD.is_required
     or NEW.estimated_hours is distinct from OLD.estimated_hours then
    raise exception 'Intern không được sửa thông tin Task con (assignee, deadline, weight, yêu cầu...)';
  end if;

  if NEW.status is distinct from OLD.status then
    if NEW.status not in ('not_started', 'in_progress', 'in_review', 'changes_requested') then
      raise exception 'Intern chỉ được chuyển sang not_started/in_progress/in_review/changes_requested';
    end if;
  end if;

  if NEW.progress < 0 or NEW.progress > 100 then
    raise exception 'Tiến độ phải trong khoảng 0–100';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_subtask_member_update_guard on public.task_subtasks;
create trigger trg_subtask_member_update_guard
before update on public.task_subtasks
for each row execute function public.tg_subtask_member_update_guard();

-- --------------------------------------------------------------------------
-- 7. Notification
-- --------------------------------------------------------------------------
create or replace function public.tg_notify_subtask_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if NEW.assignee_id is null then
    return NEW;
  end if;
  select i.user_id into v_user
  from public.interns i
  where i.id = NEW.assignee_id and i.deleted_at is null;

  if v_user is not null then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_user,
      'task_assigned'::public.notification_type,
      'Công việc mới',
      format('Bạn được giao phần việc "%s" thuộc task "%s".',
             NEW.title,
             (select t.title from public.tasks t where t.id = NEW.task_id)),
      jsonb_build_object('table', 'tasks', 'id', NEW.task_id, 'subtask_id', NEW.id, 'assignee_id', NEW.assignee_id)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notif_subtask_assigned on public.task_subtasks;
create trigger trg_notif_subtask_assigned
after insert on public.task_subtasks
for each row execute function public.tg_notify_subtask_assigned();

-- Khi phân lại task con → thông báo người mới
create or replace function public.tg_notify_subtask_reassigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if NEW.assignee_id is null or NEW.assignee_id is not distinct from OLD.assignee_id then
    return NEW;
  end if;
  select i.user_id into v_user
  from public.interns i
  where i.id = NEW.assignee_id and i.deleted_at is null;

  if v_user is not null then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_user,
      'task_assigned'::public.notification_type,
      'Được chuyển giao phần việc',
      format('Bạn vừa được giao phần việc "%s" thuộc task "%s".',
             NEW.title,
             (select t.title from public.tasks t where t.id = NEW.task_id)),
      jsonb_build_object('table', 'tasks', 'id', NEW.task_id, 'subtask_id', NEW.id, 'assignee_id', NEW.assignee_id)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notif_subtask_reassigned on public.task_subtasks;
create trigger trg_notif_subtask_reassigned
after update of assignee_id on public.task_subtasks
for each row execute function public.tg_notify_subtask_reassigned();

-- Review: thông báo thêm cho người được chấm qua subtask
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
  v_subtask_user uuid;
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

  if NEW.subtask_id is not null then
    select i.user_id into v_subtask_user
    from public.task_subtasks s
    join public.interns i on i.id = s.assignee_id
    where s.id = NEW.subtask_id and i.user_id is not null;

    if v_subtask_user is not null and not (v_subtask_user = any(coalesce(v_uids, '{}'::uuid[]))) then
      v_uids := array_append(coalesce(v_uids, '{}'::uuid[]), v_subtask_user);
    end if;
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  select u,
         v_type,
         'Kết quả công việc',
         format('Công việc "%s" %s.', (select t.title from public.tasks t where t.id = NEW.task_id), v_verb),
         jsonb_build_object('table', 'tasks', 'id', NEW.task_id, 'review_id', NEW.id, 'subtask_id', NEW.subtask_id)
  from unnest(v_uids) as u;
  return NEW;
end;
$$;

drop trigger if exists trg_notif_task_review on public.task_reviews;
create trigger trg_notif_task_review
after insert on public.task_reviews
for each row execute function public.tg_notify_task_review();

-- --------------------------------------------------------------------------
-- 8. Audit log cho task_subtasks
-- --------------------------------------------------------------------------
drop trigger if exists trg_audit_task_subtasks on public.task_subtasks;
create trigger trg_audit_task_subtasks
after insert or update or delete on public.task_subtasks
for each row execute function public.log_audit();

-- --------------------------------------------------------------------------
-- 9. Thống kê theo thành viên (dùng cho Dashboard Mentor / Reports)
-- --------------------------------------------------------------------------
create or replace function public.get_member_task_stats(p_internship_id uuid)
returns table (
  intern_id uuid,
  full_name text,
  total bigint,
  completed bigint,
  in_progress bigint,
  in_review bigint,
  changes_requested bigint,
  overdue bigint,
  completion_rate numeric,
  on_time_rate numeric,
  avg_score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with per_subtask as (
    select
      s.assignee_id,
      s.status,
      s.due_date,
      s.completed_at,
      r.final_score
    from public.task_subtasks s
    join public.tasks t on t.id = s.task_id
    left join lateral (
      select tr.final_score
      from public.task_reviews tr
      where tr.subtask_id = s.id
      order by tr.reviewed_at desc
      limit 1
    ) r on true
    where t.internship_id = p_internship_id
      and s.status <> 'cancelled'
      and s.assignee_id is not null
  )
  select
    i.id,
    i.full_name,
    count(*) as total,
    count(*) filter (where ps.status = 'completed') as completed,
    count(*) filter (where ps.status = 'in_progress') as in_progress,
    count(*) filter (where ps.status = 'in_review') as in_review,
    count(*) filter (where ps.status = 'changes_requested') as changes_requested,
    count(*) filter (where ps.status not in ('completed','cancelled') and ps.due_date is not null and ps.due_date < now()) as overdue,
    round(100.0 * count(*) filter (where ps.status = 'completed') / nullif(count(*), 0), 2) as completion_rate,
    round(100.0 * count(*) filter (where ps.status = 'completed' and (ps.due_date is null or ps.completed_at <= ps.due_date))
          / nullif(count(*) filter (where ps.status = 'completed'), 0), 2) as on_time_rate,
    round(avg(ps.final_score), 2) as avg_score
  from per_subtask ps
  join public.interns i on i.id = ps.assignee_id
  group by i.id, i.full_name
  order by i.full_name;
$$;

grant execute on function public.get_member_task_stats(uuid) to anon, authenticated, service_role;
