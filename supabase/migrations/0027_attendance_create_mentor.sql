-- ==========================================================================
-- IMS – 0027_attendance_create_mentor.sql
-- Mở rộng create_attendance: mentor được tạo điểm danh thủ công
-- cho thực tập sinh mình phụ trách (is_mentor_of_internship).
--   * HR/Admin: toàn bộ (giữ nguyên).
--   * Mentor: chỉ internship mà mentor_id = hồ sơ mentor của mình —
--     check bằng helper is_mentor_of_internship (security definer).
--   * Intern: vẫn bị từ chối.
--   * Luồng GPS check-in của Intern không đổi.
-- ==========================================================================

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
  v_role text;
  v_internship public.internships%rowtype;
  v_intern public.interns%rowtype;
  v_in_ts timestamptz;
  v_out_ts timestamptz;
  v_record_id uuid;
  v_local_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  -- 1. Xác định vai trò (backend không tin client).
  select p.role_code into v_role
  from public.profiles p
  where p.id = v_uid;

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

  -- 3b. Mentor: chỉ được tạo cho internship mình phụ trách.
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

-- Grant giữ nguyên (authenticated) — quyền đã kiểm tra trong hàm.
