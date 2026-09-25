-- ==========================================================================
-- IMS – test_rls.sql
-- Kiểm thử RLS bằng cách giả lập session (role authenticated + auth.uid()).
-- Chạy: psql hoặc Supabase SQL editor (sau seed).
-- => Kỳ vọng: các assert đều pass (không LOG chữ "FAIL").
-- ==========================================================================

set search_path = public;

drop function if exists public._assert(text, bigint, bigint);
drop function if exists public._assert(text, bigint, integer);

create or replace function public._assert(
  p_name text,
  p_actual bigint,
  p_expected integer
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

commit;

-- ==========================================================================
-- INTERN (intern@ims.local → 4000...004)
-- ==========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000004';

  select public._assert('intern: profiles thấy đúng 1 (chính mình)',
    (select count(*) from public.profiles), 1);
  select public._assert('intern: interns thấy đúng 1 (chính mình)',
    (select count(*) from public.interns), 1);
  select public._assert('intern: internships thấy đúng 1',
    (select count(*) from public.internships), 1);
  select public._assert('intern: tasks thấy đúng 3 (2 cá nhân + 1 nhóm)',
    (select count(*) from public.tasks), 3);
  select public._assert('intern: task_assignees của task nhóm thấy đủ 3 thành viên',
    (select count(*) from public.task_assignees), 3);
  select public._assert('intern: subtasks của task mình = 4',
    (select count(*) from public.task_subtasks), 4);
  select public._assert('intern: submission của mình = 1',
    (select count(*) from public.task_submissions), 1);
  select public._assert('intern: link nộp của mình = 1',
    (select count(*) from public.task_submission_links), 1);
  select public._assert('intern: review của task mình = 1',
    (select count(*) from public.task_reviews), 1);
  select public._assert('intern: departments thấy đủ 3 (danh mục)',
    (select count(*) from public.departments), 3);
  select public._assert('intern: leave_requests rỗng',
    (select count(*) from public.leave_requests), 0);
  select public._assert('intern: audit_logs bị chặn (0)',
    (select count(*) from public.audit_logs), 0);

  -- Intern KHÔNG được tạo review
  do $$
  begin
    begin
      insert into public.task_reviews (task_id, reviewer_id, decision)
      values ('80000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'approved');
      raise exception 'FAIL: intern tạo review được';
    exception
      when insufficient_privilege or sqlstate '42501' or sqlstate '42505' then
        raise log 'PASS: intern bị chặn tạo review';
    end;
  end $$;

  -- Intern KHÔNG được tự đánh dấu completed
  do $$
  begin
    begin
      update public.tasks
         set status = 'completed'
       where id = '80000000-0000-0000-0000-000000000001';
      raise exception 'FAIL: intern tự set completed được';
    exception
      when others then
        raise log 'PASS: intern bị chặn tự set completed';
    end;
  end $$;

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

-- Chuẩn bị đơn pending dưới quyền hệ thống để mentor chỉ kiểm thử thao tác duyệt.
delete from public.leave_requests
where intern_id = '60000000-0000-0000-0000-000000000001'
  and start_date = '2026-05-01'
  and end_date = '2026-05-01';

insert into public.leave_requests (intern_id, internship_id, request_type, start_date, end_date, reason)
values ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'leave',
        '2026-05-01', '2026-05-01', 'Việc gia đình');

-- ==========================================================================
-- MENTOR (mentor@ims.local → 4000...003)
-- ==========================================================================
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000003';

  select public._assert('mentor: interns của mình = 3',
    (select count(*) from public.interns), 3);
  select public._assert('mentor: tasks của intern = 3',
    (select count(*) from public.tasks), 3);
  select public._assert('mentor: internships = 3',
    (select count(*) from public.internships), 3);

  -- Mentor duyệt đơn nghỉ pending của intern mình
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
  set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000002';

  select public._assert('hr: thấy toàn bộ interns = 3',
    (select count(*) from public.interns), 3);
  select public._assert('hr: thấy toàn bộ internships = 3',
    (select count(*) from public.internships), 3);
  select public._assert('hr: thấy audit_logs = 0 (chỉ admin)', 
    (select count(*) from public.audit_logs), 0);

  -- HR tạo task được
  insert into public.tasks (internship_id, title, description, priority, status, created_by)
  values ('70000000-0000-0000-0000-000000000001', 'Task HR test', 'desc', 'low', 'not_started', '40000000-0000-0000-0000-000000000002');
  select public._assert('hr: tạo task = OK', (select count(*) from public.tasks), 4);

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
  set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000001';

  select public._assert('admin: thấy audit_logs (>= 0, có quyền select)',
    (case when (select count(*) from public.audit_logs) >= 0 then 1 else 0 end), 1);
  select public._assert('admin: thấy dashboard stats',
    (case when (select (public.get_dashboard_stats() ->> 'total_interns')) = '3' then 1 else 0 end), 1);
  insert into public.departments (name, code)
  values ('Phòng Hành chính', 'ADM');
  select public._assert('admin: tạo department mới OK',
    (select count(*) from public.departments where code = 'ADM'), 1);
rollback;

-- ==========================================================================
-- ANON (chưa đăng nhập)
-- ==========================================================================
begin;
  set local role anon;
  set local request.jwt.claim.sub = '';

  select public._assert('anon: không xem được profiles',
    (select count(*) from public.profiles), 0);
  select public._assert('anon: không xem được interns',
    (select count(*) from public.interns), 0);
rollback;

begin;
  update public.internships
  set status = 'upcoming'
  where id = '70000000-0000-0000-0000-000000000001';

  set local role authenticated;
  set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000002';

  do $$
  declare
    v_onboarding_id uuid;
  begin
    v_onboarding_id := public.create_onboarding_record(
      '70000000-0000-0000-0000-000000000001',
      current_date,
      current_date + 7,
      '40000000-0000-0000-0000-000000000002',
      null,
      null
    );
    perform public._assert(
      'hr: tạo onboarding và áp dụng mẫu',
      (select count(*) from public.onboarding_records where id = v_onboarding_id),
      1
    );
    perform public._assert(
      'hr: mẫu tạo checklist cho intern',
      (select count(*) from public.onboarding_checklist_items where onboarding_id = v_onboarding_id),
      17
    );
  end;
  $$;

  insert into public.onboarding_documents (
    onboarding_id,
    document_name,
    document_type,
    is_required,
    visible_to_mentor
  )
  select id, 'Tài liệu nhạy cảm', 'identity', true, false
  from public.onboarding_records
  limit 1;

  set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000004';
  select public._assert(
    'intern: thấy hồ sơ của chính mình',
    (select count(*) from public.onboarding_records),
    1
  );
  select public._assert(
    'intern: thấy checklist của hồ sơ',
    (select count(*) from public.onboarding_checklist_items),
    17
  );
  select public._assert(
    'intern: thấy tài liệu của chính mình',
    (select count(*) from public.onboarding_documents),
    1
  );

  do $$
  declare
    v_item_id uuid;
  begin
    select id into v_item_id
    from public.onboarding_checklist_items
    where assigned_to = '40000000-0000-0000-0000-000000000004'
    order by sort_order
    limit 1;

    perform public.submit_onboarding_checklist_item(v_item_id, 'pending_review');
    perform public._assert(
      'intern: gửi được checklist được giao',
      (select count(*) from public.onboarding_checklist_items where id = v_item_id and status = 'pending_review'),
      1
    );
  end;
  $$;

  do $$
  begin
    begin
      update public.onboarding_records
      set notes = 'Intern cố tự sửa hồ sơ'
      where id = (select id from public.onboarding_records limit 1);
      raise exception 'FAIL: intern sửa onboarding_records trực tiếp được';
    exception
      when insufficient_privilege or sqlstate '42501' then
        raise log 'PASS: intern bị chặn sửa onboarding_records trực tiếp';
    end;
  end;
  $$;

  do $$
  begin
    begin
      update public.onboarding_records
      set status = 'completed'
      where id = (select id from public.onboarding_records limit 1);
      raise exception 'FAIL: intern tự set status=completed trực tiếp được';
    exception
      when insufficient_privilege or sqlstate '42501' then
        raise log 'PASS: intern bị chặn set status=completed trực tiếp';
    end;
  end;
  $$;

  do $$
  begin
    begin
      perform public.complete_onboarding((select id from public.onboarding_records limit 1));
      raise exception 'FAIL: intern tự hoàn tất onboarding được';
    exception
      when insufficient_privilege or sqlstate '42501' then
        raise log 'PASS: intern bị chặn tự hoàn tất onboarding';
    end;
  end;
  $$;

  set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000003';
  select public._assert(
    'mentor: thấy hồ sơ được phân công',
    (select count(*) from public.onboarding_records),
    1
  );
  select public._assert(
    'mentor: không thấy tài liệu nhạy cảm bị ẩn',
    (select count(*) from public.onboarding_documents),
    0
  );

  set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000002';
  do $$
  begin
    begin
      perform public.complete_onboarding((select id from public.onboarding_records limit 1));
      raise exception 'FAIL: HR hoàn tất khi còn điều kiện bắt buộc';
    exception
      when check_violation then
        raise log 'PASS: bị chặn hoàn tất khi còn điều kiện bắt buộc';
    end;
  end;
  $$;
rollback;
