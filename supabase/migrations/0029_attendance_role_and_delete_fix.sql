-- ==========================================================================
-- IMS – 0029_attendance_role_and_delete_fix.sql
--
-- Sửa 3 lỗi đã xác nhận bằng test trên remote (docs/20, 2026-11-06):
--
--  BUG-ATT-001 (Critical) — `adjust_attendance` (0016) và `create_attendance`
--    (0026/0027) tham chiếu cột `profiles.role_code` NHƯNG cột này KHÔNG tồn
--    tại (role được lưu ở `profiles.role_id` → `roles.code`).
--    Mọi lời gọi của HR/Admin/Mentor đều lỗi `42703` → chức năng điều
--    chỉnh/tạo thủ công điểm danh và phân quyền của 3 RPC hoàn toàn không
--    hoạt động trên production. Sửa bằng `public.get_my_role()` (đã có sẵn
--    từ 0014, trả `public.user_role`) và helper `is_hr_or_admin()`.
--
--  BUG-ATT-002 (High) — Policy `attendance_delete_hr_admin` cho phép HR/Admin
--    DELETE attendance trực tiếp từ client, trái thiết kế đã ghi ở 0005
--    ("client KHÔNG được ghi trực tiếp") và trái kỳ vọng của
--    `supabase/scripts/test_rls.sql` (chỉ EF/service mới được thay đổi
--    dữ liệu chấm công). Bỏ policy này: ghi trực tiếp bị chặn, service role
--    (API route / Edge Function / Server Actions) vẫn bypass như trước.
--
--  BUG-ATT-004 (Critical) — Nhánh INSERT của `sync_request_attendance` dùng
--    CASE trả `text` cho cột `status` enum → lỗi `42804` khi duyệt đơn điều
--    chỉnh cho ngày chưa có bản ghi (AT-039). Sửa bằng cast rõ ràng
--    `::public.attendance_status`. Giữ nguyên toàn bộ logic của 0028
--    (đã sửa tên múi giờ 'Asia/Ho_Chi_Minh') — migration này supersede 0028
--    cho hàm này khi chỉ áp 0029.
--
-- Lưu ý áp dụng: 0028 (múi giờ) và 0026/0027 (create_attendance) chưa được
-- áp lên remote tại thời điểm kiểm thử; 0029 được viết idempotent
-- (create or replace) để có thể áp trực tiếp sau các migration đó.
--
-- KHÔNG thay đổi schema, không đổi chữ ký hàm, không đổi business logic
-- ngoài 3 lỗi trên. Rollback: áp lại file 0016/0017/0026/0027 gốc.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. BUG-ATT-001 — sửa adjust_attendance (0016)
-- --------------------------------------------------------------------------
create or replace function public.adjust_attendance(
  p_attendance_id uuid,
  p_status public.attendance_status,
  p_note text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rec public.attendance%rowtype;
begin
  -- Sửa 0029: dùng helper is_hr_or_admin() thay cho cột profiles.role_code
  -- (cột không tồn tại) — helper đọc roles.code qua profiles.role_id.
  if v_uid is null or not public.is_hr_or_admin() then
    return jsonb_build_object('success', false, 'code', 'PERMISSION_DENIED',
      'message', 'Bạn không có quyền điều chỉnh điểm danh.');
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 then
    return jsonb_build_object('success', false, 'code', 'REASON_REQUIRED',
      'message', 'Vui lòng nhập lý do điều chỉnh (tối thiểu 5 ký tự).');
  end if;

  select * into v_rec from public.attendance where id = p_attendance_id for update;
  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND',
      'message', 'Không tìm thấy bản ghi điểm danh.');
  end if;

  update public.attendance
  set status = p_status, note = coalesce(p_note, note)
  where id = p_attendance_id;

  insert into public.attendance_verification_logs
    (user_id, attendance_id, work_location_id, action, latitude, longitude,
     is_valid, failure_reason, note)
  values (v_uid, p_attendance_id, v_rec.location_id, 'ADJUST',
          coalesce(v_rec.check_in_latitude, 0), coalesce(v_rec.check_in_longitude, 0),
          true, p_reason, p_note);

  return jsonb_build_object('success', true, 'message', 'Đã điều chỉnh điểm danh.');
end;
$$;

revoke all on function public.adjust_attendance(uuid, public.attendance_status, text, text)
  from public, anon, authenticated;
grant execute on function public.adjust_attendance(uuid, public.attendance_status, text, text)
  to authenticated;

-- --------------------------------------------------------------------------
-- 2. BUG-ATT-001 — tạo mới create_attendance (0026 + 0027, đã sửa role_code).
--    Lưu ý: RPC này KHÔNG có trên remote tại thời điểm kiểm thử (0026/0027
--    chưa áp); migration này tạo bản cuối cùng (có mentor) với sửa lỗi.
-- --------------------------------------------------------------------------
create or replace function public.create_attendance(
  p_internship_id uuid,
  p_work_date date,
  p_status public.attendance_status,
  p_check_in_time time default null,
  p_check_out_time time default null,
  p_note text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_internship public.internships%rowtype;
  v_intern public.interns%rowtype;
  v_in_ts timestamptz;
  v_out_ts timestamptz;
  v_record_id uuid;
  v_local_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  -- 1. Xác định vai trò (backend không tin client).
  -- Sửa 0029: dùng get_my_role() thay cho cột profiles.role_code (không tồn tại).
  select public.get_my_role() into v_role;

  if v_role is null or v_role not in ('hr', 'admin', 'mentor') then
    return jsonb_build_object('success', false, 'code', 'PERMISSION_DENIED',
      'message', 'Bạn không có quyền tạo bản ghi điểm danh.');
  end if;

  -- 2. Lý do tạo (bắt buộc — audit).
  if p_reason is null or length(trim(p_reason)) < 5 then
    return jsonb_build_object('success', false, 'code', 'REASON_REQUIRED',
      'message', 'Vui lòng nhập lý do tạo bản ghi (tối thiểu 5 ký tự).');
  end if;

  if p_work_date is null then
    return jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'message', 'Vui lòng chọn ngày điểm danh.');
  end if;

  if p_work_date > v_local_date then
    return jsonb_build_object('success', false, 'code', 'FUTURE_DATE',
      'message', 'Không thể tạo điểm danh cho ngày trong tương lai.');
  end if;

  -- 3. Đợt thực tập hợp lệ (intern lấy từ internship).
  select * into v_internship
  from public.internships
  where id = p_internship_id and deleted_at is null;

  if not found then
    return jsonb_build_object('success', false, 'code', 'INTERNSHIP_NOT_FOUND',
      'message', 'Không tìm thấy đợt thực tập đã chọn.');
  end if;

  if v_internship.status = 'cancelled' then
    return jsonb_build_object('success', false, 'code', 'INTERNSHIP_CANCELLED',
      'message', 'Đợt thực tập đã bị hủy, không thể tạo điểm danh.');
  end if;

  -- 3b. Mentor: chỉ được tạo cho internship mình phụ trách (0027).
  if v_role = 'mentor' and not public.is_mentor_of_internship(p_internship_id) then
    return jsonb_build_object('success', false, 'code', 'PERMISSION_DENIED',
      'message', 'Bạn chỉ có thể tạo điểm danh cho thực tập sinh mình phụ trách.');
  end if;

  select * into v_intern
  from public.interns
  where id = v_internship.intern_id and deleted_at is null;

  if not found then
    return jsonb_build_object('success', false, 'code', 'INTERN_NOT_FOUND',
      'message', 'Không tìm thấy hồ sơ thực tập sinh của đợt này.');
  end if;

  -- 4. Onboarding phải hoàn thành cho trạng thái có mặt
  --    (đồng bộ với trigger trg_attendance_requires_onboarding).
  if p_status in ('present', 'late', 'wfh', 'early_leave')
     and exists (
       select 1 from public.onboarding_records r
       where r.internship_id = v_internship.id and r.status <> 'completed'
     ) then
    return jsonb_build_object('success', false, 'code', 'ONBOARDING_NOT_COMPLETED',
      'message', 'Onboarding của thực tập sinh chưa hoàn thành, không thể tạo điểm danh có mặt.');
  end if;

  -- 5. Trạng thái vắng / nghỉ phép không kèm giờ check-in/out.
  if p_status in ('absent', 'leave') then
    p_check_in_time := null;
    p_check_out_time := null;
  end if;

  if p_check_in_time is not null and p_check_out_time is not null
     and p_check_out_time < p_check_in_time then
    return jsonb_build_object('success', false, 'code', 'INVALID_TIME_RANGE',
      'message', 'Giờ check-out phải lớn hơn hoặc bằng giờ check-in.');
  end if;

  -- 6. Ngày + giờ theo múi giờ hệ thống (Asia/Ho_Chi_Minh).
  if p_check_in_time is not null then
    v_in_ts := (p_work_date + p_check_in_time) at time zone 'Asia/Ho_Chi_Minh';
  end if;
  if p_check_out_time is not null then
    v_out_ts := (p_work_date + p_check_out_time) at time zone 'Asia/Ho_Chi_Minh';
  end if;

  -- 7. Chống trùng intern_id + work_date (check trước + bắt race).
  if exists (
    select 1 from public.attendance a
    where a.intern_id = v_intern.id and a.work_date = p_work_date
  ) then
    return jsonb_build_object('success', false, 'code', 'DUPLICATE',
      'message', 'Thực tập sinh đã có bản ghi điểm danh trong ngày này. Vui lòng kiểm tra dữ liệu hoặc sử dụng chức năng điều chỉnh điểm danh.');
  end if;

  begin
    insert into public.attendance
      (intern_id, internship_id, work_date, check_in_at, check_out_at,
       status, note, is_geo_validated, total_working_minutes)
    values
      (v_intern.id, v_internship.id, p_work_date, v_in_ts, v_out_ts,
       p_status, nullif(trim(coalesce(p_note, '')), ''), false,
       case when v_in_ts is not null and v_out_ts is not null
            then greatest(0, (extract(epoch from (v_out_ts - v_in_ts)) / 60)::integer)
       end)
    returning id into v_record_id;
  exception when unique_violation then
    return jsonb_build_object('success', false, 'code', 'DUPLICATE',
      'message', 'Thực tập sinh đã có bản ghi điểm danh trong ngày này. Vui lòng kiểm tra dữ liệu hoặc sử dụng chức năng điều chỉnh điểm danh.');
  end;

  -- 8. Audit log — creator (HR/Admin/Mentor) được ghi nhận.
  insert into public.attendance_verification_logs
    (user_id, attendance_id, work_location_id, action, latitude, longitude,
     is_valid, failure_reason, note)
  values (v_uid, v_record_id, null, 'ADJUST', 0, 0, true,
          trim(p_reason), nullif(trim(coalesce(p_note, '')), ''));

  return jsonb_build_object('success', true, 'code', 'OK',
    'message', 'Đã tạo bản ghi điểm danh.', 'attendance_id', v_record_id);
end;
$$;

revoke all on function public.create_attendance(uuid, date, public.attendance_status, time, time, text, text)
  from public, anon;
grant execute on function public.create_attendance(uuid, date, public.attendance_status, time, time, text, text)
  to authenticated;

-- --------------------------------------------------------------------------
-- 3. BUG-ATT-004 — sync_request_attendance: cast enum cho status (nhánh
--    INSERT) + giữ nguyên múi giờ đúng 'Asia/Ho_Chi_Minh' của 0028.
-- --------------------------------------------------------------------------
create or replace function public.sync_request_attendance(p_request public.requests)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date;
  v_att public.attendance%rowtype;
  v_old_in timestamptz;
  v_old_out timestamptz;
begin
  if p_request.intern_id is null or p_request.start_date is null then
    return;
  end if;

  if p_request.request_type = 'leave' then
    for v_date in
      select generate_series(
        p_request.start_date,
        coalesce(p_request.end_date, p_request.start_date),
        interval '1 day'
      )::date
    loop
      insert into public.attendance (intern_id, internship_id, work_date, status, note)
      values (p_request.intern_id, p_request.internship_id, v_date, 'leave',
              'Nghỉ phép ' || p_request.request_code)
      on conflict (intern_id, work_date) do update
        set status = 'leave',
            note = excluded.note
        where attendance.status in ('absent', 'leave');
    end loop;

  elsif p_request.request_type = 'wfh' then
    for v_date in
      select generate_series(
        p_request.start_date,
        coalesce(p_request.end_date, p_request.start_date),
        interval '1 day'
      )::date
    loop
      insert into public.attendance (intern_id, internship_id, work_date, status, note)
      values (p_request.intern_id, p_request.internship_id, v_date, 'wfh',
              'Làm việc từ xa ' || p_request.request_code)
      on conflict (intern_id, work_date) do update
        set status = 'wfh',
            note = excluded.note
        where attendance.status in ('absent', 'wfh');
    end loop;

  elsif p_request.request_type in ('late', 'early_leave') then
    update public.attendance
    set note = coalesce(note || ' · ', '')
        || case when p_request.request_type = 'late'
                then 'Đã duyệt đi muộn ' || p_request.request_code
                else 'Đã duyệt về sớm ' || p_request.request_code end
    where intern_id = p_request.intern_id
      and work_date = p_request.start_date;

  elsif p_request.request_type = 'attendance_adjustment' then
    select * into v_att
    from public.attendance
    where intern_id = p_request.intern_id
      and work_date = p_request.start_date
    for update;

    if not found then
      insert into public.attendance (
        intern_id, internship_id, work_date,
        check_in_at, check_out_at, status, is_geo_validated, note
      ) values (
        p_request.intern_id, p_request.internship_id, p_request.start_date,
        nullif(p_request.payload->>'proposed_check_in', '')::timestamptz,
        nullif(p_request.payload->>'proposed_check_out', '')::timestamptz,
        -- Sửa 0029: cast rõ ràng (CASE trả text → lỗi 42804 trên enum).
        (case
          when nullif(p_request.payload->>'proposed_check_in', '')::timestamptz is null
            then 'absent' else 'present'
        end)::public.attendance_status,
        false,
        'Điều chỉnh theo đơn ' || p_request.request_code
      );
    else
      v_old_in := v_att.check_in_at;
      v_old_out := v_att.check_out_at;

      update public.attendance set
        check_in_at = coalesce(
          nullif(p_request.payload->>'proposed_check_in', '')::timestamptz, check_in_at),
        check_out_at = coalesce(
          nullif(p_request.payload->>'proposed_check_out', '')::timestamptz, check_out_at),
        note = 'Điều chỉnh theo đơn ' || p_request.request_code
        || coalesce(' (trước: vào ' || to_char(v_old_in at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI')
                      || ')', '')
      where id = v_att.id;

      insert into public.attendance_verification_logs (
        user_id, attendance_id, work_location_id, action,
        latitude, longitude, is_valid, failure_reason, note
      ) values (
        p_request.reviewer_id, v_att.id, v_att.location_id, 'ADJUST',
        coalesce(v_att.check_in_latitude, 0), coalesce(v_att.check_out_longitude,
          coalesce(v_att.check_in_longitude, 0)),
        true, 'Đơn ' || p_request.request_code,
        'Điều chỉnh: vào ' || coalesce(to_char(v_old_in at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI'), '—')
          || ' → ' || coalesce(to_char(nullif(p_request.payload->>'proposed_check_in', '')::timestamptz at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI'), '—')
          || '; ra ' || coalesce(to_char(v_old_out at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI'), '—')
          || ' → ' || coalesce(to_char(nullif(p_request.payload->>'proposed_check_out', '')::timestamptz at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI'), '—')
      );
    end if;
  end if;
end;
$$;

comment on function public.sync_request_attendance(public.requests) is
  'Đồng bộ attendance khi duyệt đơn (0028: múi giờ Asia/Ho_Chi_Minh; 0029: cast enum status).';

-- --------------------------------------------------------------------------
-- 4. BUG-ATT-002 — bỏ policy cho phép HR/Admin DELETE attendance từ client.
--    Không thay bằng policy nào mới: client bị chặn DELETE; service role
--    (API route / EF / Server Action) vẫn bypass như thiết kế.
-- --------------------------------------------------------------------------
drop policy if exists attendance_delete_hr_admin on public.attendance;
