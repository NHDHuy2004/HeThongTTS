-- =============================================================================
-- 0028 — Sửa lỗi tên múi giờ trong sync_request_attendance
--
-- Vấn đề (phát hiện khi rà soát module điểm danh):
--   Hàm tạo trong 0017_requests_management.sql dùng tên múi giờ SAI
--   'Asia/Ho_Chi_Minn' (thừa chữ 'n') tại 5 chỗ (to_char ... at time zone).
--   PostgreSQL báo lỗi "time zone ... not recognized" → toàn bộ
--   review_request(..., 'approve') thất bại với đơn attendance_adjustment
--   đã có bản ghi điểm danh tương ứng (nhánh UPDATE + ghi audit log).
--
-- Cách sửa:
--   Tạo lại ĐẦY ĐỦ hàm sync_request_attendance với tên múi giờ đúng
--   'Asia/Ho_Chi_Minh'. Giữ nguyên 100% logic nghiệp vụ, security definer,
--   search_path của phiên bản 0017 — chỉ đổi tên múi giờ.
--
-- Ảnh hưởng: tương thích ngược — không đổi schema, không đổi hành vi khác.
-- =============================================================================

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
    -- Ghi trạng thái nghỉ phép cho toàn bộ ngày trong khoảng (không đè
    -- ngày đã check-in thật — chỉ absent/leave mới bị đổi).
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
    -- KHÔNG thay đổi giờ GPS/chấm công thực tế — chỉ ghi nhận đã duyệt.
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
        case
          when nullif(p_request.payload->>'proposed_check_in', '')::timestamptz is null then 'absent'
          else 'present'
        end,
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

    -- 'schedule_change' / 'other': không có module đích — lưu trong requests.
  end if;
end;
$$;

comment on function public.sync_request_attendance(public.requests) is
  'Đồng bộ attendance khi duyệt đơn (0028: sửa tên múi giờ Asia/Ho_Chi_Minh).';
