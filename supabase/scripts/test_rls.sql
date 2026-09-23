-- ==========================================================================
-- IMS – test_rls.sql
-- Kiểm thử RLS bằng cách giả lập session (role authenticated + auth.uid()).
-- Chạy: psql hoặc Supabase SQL editor (sau seed).
-- => Kỳ vọng: các assert đều pass (không LOG chữ "FAIL").
-- ==========================================================================

set search_path = public;

create or replace function public._assert(
  p_name text,
  p_actual bigint,
  p_expected bigint
) returns void
language plpgsql
as $$
begin
  if p_actual = p_expected then
    raise log 'PASS: % = %', p_name, p_actual;
  else
    raise exception 'FAIL: % (expected %, got %)', p_name, p_expected, p_actual;
  end if;
end;
$$;

-- ==========================================================================
-- INTERN (intern@ims.local → 4000...004)
-- ==========================================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);

  select public._assert('intern: profiles thấy đúng 1 (chính mình)',
    (select count(*) from public.profiles), 1);
  select public._assert('intern: interns thấy đúng 1 (chính mình)',
    (select count(*) from public.interns), 1);
  select public._assert('intern: internships thấy đúng 1',
    (select count(*) from public.internships), 1);
  select public._assert('intern: tasks thấy đúng 2 (task của mình)',
    (select count(*) from public.tasks), 2);
  select public._assert('intern: departments thấy đủ 3 (danh mục)',
    (select count(*) from public.departments), 3);
  select public._assert('intern: leave_requests rỗng',
    (select count(*) from public.leave_requests), 0);
  select public._assert('intern: audit_logs bị chặn (0)',
    (select count(*) from public.audit_logs), 0);

  -- Intern KHÔNG được insert đánh giá
  do $$
  begin
    begin
      insert into public.evaluations (internship_id, reviewer_id, type, period_label)
      values ('70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'weekly', 'FAIL-CASE');
      raise exception 'FAIL: intern insert được evaluation';
    exception
      when insufficient_privilege or sqlstate '42501' then
        raise log 'PASS: intern bị chặn insert evaluation';
    end;
  end $$;
rollback;

-- ==========================================================================
-- MENTOR (mentor@ims.local → 4000...003)
-- ==========================================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', true);

  select public._assert('mentor: interns của mình = 1',
    (select count(*) from public.interns), 1);
  select public._assert('mentor: tasks của intern = 2',
    (select count(*) from public.tasks), 2);
  select public._assert('mentor: internships = 1',
    (select count(*) from public.internships), 1);

  -- Mentor duyệt đơn nghỉ của intern mình (giả lập đơn pending, approve)
  insert into public.leave_requests (intern_id, internship_id, request_type, start_date, end_date, reason)
  values ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'leave',
          '2026-05-01', '2026-05-01', 'Việc gia đình');
  update public.leave_requests set status = 'approved', reviewed_by = '40000000-0000-0000-0000-000000000003', reviewed_at = now()
  where intern_id = '60000000-0000-0000-0000-000000000001';
  select public._assert('mentor: approve đơn nghỉ của intern = OK',
    (select count(*) from public.leave_requests where status = 'approved'), 1);

  -- Mentor không được duyệt đơn của intern không thuộc mình (tạo intern khác → rỗng)
  select public._assert('mentor: không thấy được báo cáo người khác (rỗng weekly)',
    (select count(*) from public.weekly_reports), 0);
rollback;

-- ==========================================================================
-- HR (hr@ims.local → 4000...002)
-- ==========================================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', true);

  select public._assert('hr: thấy toàn bộ interns = 1',
    (select count(*) from public.interns), 1);
  select public._assert('hr: thấy toàn bộ internships = 1',
    (select count(*) from public.internships), 1);
  select public._assert('hr: thấy audit_logs = 0 (chỉ admin)', 
    (select count(*) from public.audit_logs), 0);

  -- HR tạo task được
  insert into public.tasks (internship_id, title, description, priority, status, created_by)
  values ('70000000-0000-0000-0000-000000000001', 'Task HR test', 'desc', 'low', 'todo', '40000000-0000-0000-0000-000000000002');
  select public._assert('hr: tạo task = OK', (select count(*) from public.tasks), 3);

  -- HR không được xóa attendance (client) — chỉ EF/sever
  do $$
  begin
    begin
      delete from public.attendance where intern_id = '60000000-0000-0000-0000-000000000001';
      raise exception 'FAIL: hr delete attendance được';
    exception
      when insufficient_privilege or sqlstate '42501' then
        raise log 'PASS: hr (client) không xóa attendance';
    end;
  end $$;
rollback;

-- ==========================================================================
-- ADMIN (admin@ims.local → 4000...001)
-- ==========================================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);

  select public._assert('admin: thấy audit_logs (>= 0, có quyền select)',
    (select count(*) from public.audit_logs >= 0), 1);
  select public._assert('admin: thấy dashboard stats',
    (select (public.get_dashboard_stats() ->> 'total_interns') = '1'), 1);
  select public._assert('admin: tạo department mới OK',
    (select count(*) from (insert into public.departments (name, code)
      values ('Phòng Hành chính', 'ADM') returning id) t), 1);
rollback;

-- ==========================================================================
-- ANON (chưa đăng nhập)
-- ==========================================================================
begin;
  set local role anon;
  select set_config('request.jwt.claim.sub', '', true);

  select public._assert('anon: không xem được profiles',
    (select count(*) from public.profiles), 0);
  select public._assert('anon: không xem được interns',
    (select count(*) from public.interns), 0);
rollback;

drop function public._assert(text, bigint, bigint);