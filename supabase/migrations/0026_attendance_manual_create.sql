-- ==========================================================================
-- IMS – 0026_attendance_manual_create.sql
-- Tạo bản ghi điểm danh THỦ CÔNG cho HR/Admin (Trường hợp A).
--
--   * Điểm danh GPS của Intern (Trường hợp B) vẫn đi qua Edge Function
--     `attendance-check` → RPC attendance_check — KHÔNG đổi.
--   * Không mở RLS INSERT trên public.attendance: ghi chỉ thực hiện qua
--     RPC security definer này, quyền được kiểm tra trong hàm.
--   * Chống trùng theo unique (intern_id, work_date) sẵn có của schema,
--     bắt cả unique_violation để xử lý request đồng thời.
--   * Audit: ghi vào attendance_verification_logs (action = 'ADJUST').
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
  v_internship public.internships%rowtype;
  v_intern public.interns%rowtype;
  v_in_ts timestamptz;
  v_out_ts timestamptz;
  v_record_id uuid;
  v_local_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  -- 1. Quyền: chỉ HR/Admin (không mở RLS, backend tự xác minh).
  if v_uid is null or not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role_code in ('hr', 'admin')
  ) then
    return jsonb_build_object('success', false, 'code', 'PERMISSION_DENIED',
      'message', 'Bạn không có quyền tạo bản ghi điểm danh.');
  end if;

  -- 2. Lý do tạo (bắt buộc — đối chiếu với yêu cầu audit của điều chỉnh).
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

  -- 3. Đợt thực tập hợp lệ (intern lấy từ internship — form chỉ chọn 1 lần).
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

  -- 6. Ngày + giờ theo múi giờ hệ thống (Asia/Ho_Chi_Minh — đồng bộ
  --    với attendance_check), KHÔNG tin timestamp do client gửi.
  if p_check_in_time is not null then
    v_in_ts := (p_work_date + p_check_in_time) at time zone 'Asia/Ho_Chi_Minh';
  end if;
  if p_check_out_time is not null then
    v_out_ts := (p_work_date + p_check_out_time) at time zone 'Asia/Ho_Chi_Minh';
  end if;

  -- 7. Chống trùng intern_id + work_date (check trước + bắt race condition).
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

  -- 8. Audit log — tạo thủ công được ghi nhận như một thao tác điều chỉnh.
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
