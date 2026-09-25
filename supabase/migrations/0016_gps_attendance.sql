-- ==========================================================================
-- IMS – 0016_gps_attendance.sql
-- Điểm danh GPS tại địa điểm cố định:
--   * Mở rộng attendance_locations (mã, khung giờ, ngưỡng accuracy, gán
--     phòng ban / đợt thực tập).
--   * Mở rộng attendance (lưu tọa độ, độ chính xác, khoảng cách, tổng phút).
--   * Bảng attendance_verification_logs (lịch sử xác minh — thành công/lỗi).
--   * RPC attendance_check(): toàn bộ xác minh ở backend (service role gọi
--     từ Edge Function `attendance-check`). Client KHÔNG được tự quyết định
--     kết quả điểm danh.
--   * RLS: intern chỉ xem dữ liệu của mình; ghi chỉ thực hiện qua backend.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Helpers địa lý (idempotent — thay thế bản 0009 nếu cùng chữ ký)
-- --------------------------------------------------------------------------
create or replace function public.distance_m(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
)
returns double precision
language sql
immutable
as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  ));
$$;

-- --------------------------------------------------------------------------
-- 2. Mở rộng attendance_locations
-- --------------------------------------------------------------------------
alter table public.attendance_locations
  add column if not exists code text,
  add column if not exists check_in_start_time time,
  add column if not exists check_in_end_time time,
  add column if not exists check_out_start_time time,
  add column if not exists check_out_end_time time,
  add column if not exists min_accuracy_meters double precision not null default 100,
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists internship_batch_id uuid references public.internship_batches(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'attendance_locations_code_key'
      and conrelid = 'public.attendance_locations'::regclass
  ) then
    alter table public.attendance_locations
      add constraint attendance_locations_code_key unique (code);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'attendance_locations_coords_check'
      and conrelid = 'public.attendance_locations'::regclass
  ) then
    alter table public.attendance_locations
      add constraint attendance_locations_coords_check
      check (latitude between -90 and 90 and longitude between -180 and 180);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'attendance_locations_accuracy_check'
      and conrelid = 'public.attendance_locations'::regclass
  ) then
    alter table public.attendance_locations
      add constraint attendance_locations_accuracy_check
      check (min_accuracy_meters > 0);
  end if;
end $$;

-- --------------------------------------------------------------------------
-- 3. Mở rộng attendance (GPS)
-- --------------------------------------------------------------------------
alter table public.attendance
  add column if not exists check_in_latitude double precision,
  add column if not exists check_in_longitude double precision,
  add column if not exists check_in_accuracy double precision,
  add column if not exists check_in_distance_meters double precision,
  add column if not exists check_out_latitude double precision,
  add column if not exists check_out_longitude double precision,
  add column if not exists check_out_accuracy double precision,
  add column if not exists check_out_distance_meters double precision,
  add column if not exists total_working_minutes integer;

-- Tự tính tổng phút làm việc khi đủ check-in + check-out (server time).
create or replace function public.calc_attendance_totals()
returns trigger
language plpgsql
as $$
begin
  if new.check_in_at is not null and new.check_out_at is not null then
    new.total_working_minutes :=
      greatest(0, (extract(epoch from (new.check_out_at - new.check_in_at)) / 60)::integer);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_attendance_totals on public.attendance;
create trigger trg_attendance_totals
before update on public.attendance
for each row execute function public.calc_attendance_totals();

-- --------------------------------------------------------------------------
-- 4. attendance_verification_logs
-- --------------------------------------------------------------------------
create table if not exists public.attendance_verification_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  attendance_id    uuid references public.attendance(id) on delete set null,
  work_location_id uuid references public.attendance_locations(id) on delete set null,
  action           text not null check (action in ('CHECK_IN', 'CHECK_OUT', 'ADJUST')),
  latitude         double precision not null,
  longitude        double precision not null,
  accuracy         double precision,
  distance_meters  double precision,
  is_valid         boolean not null,
  failure_reason   text,
  note             text,
  verified_at      timestamptz not null default now()
);

create index if not exists idx_verification_logs_user
  on public.attendance_verification_logs (user_id, verified_at desc);
create index if not exists idx_verification_logs_attendance
  on public.attendance_verification_logs (attendance_id);
create index if not exists idx_verification_logs_invalid
  on public.attendance_verification_logs (is_valid, verified_at desc);

alter table public.attendance_verification_logs enable row level security;

drop policy if exists verification_logs_select_self on public.attendance_verification_logs;
create policy verification_logs_select_self on public.attendance_verification_logs
  for select to authenticated using (user_id = auth.uid());

drop policy if exists verification_logs_select_mentor on public.attendance_verification_logs;
create policy verification_logs_select_mentor on public.attendance_verification_logs
  for select to authenticated
  using (
    exists (
      select 1 from public.attendance a
      where a.id = attendance_id
        and public.is_mentor_of_intern(a.intern_id)
    )
  );

drop policy if exists verification_logs_select_hr_admin on public.attendance_verification_logs;
create policy verification_logs_select_hr_admin on public.attendance_verification_logs
  for select to authenticated using (public.is_hr_or_admin());
-- INSERT/UPDATE/DELETE: chỉ backend (service role) — client không có policy ghi.

-- --------------------------------------------------------------------------
-- 5. RLS locations: HR/Admin quản lý (trước đây chỉ Admin)
-- --------------------------------------------------------------------------
drop policy if exists locations_write_admin on public.attendance_locations;
create policy locations_write_admin on public.attendance_locations
  for all to authenticated
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- --------------------------------------------------------------------------
-- 6. RPC attendance_check — backend xác minh điểm danh
--    Chỉ service_role được execute (Edge Function gọi qua admin client).
-- --------------------------------------------------------------------------
create or replace function public.attendance_check(
  p_user_id uuid,
  p_action text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intern public.interns%rowtype;
  v_internship public.internships%rowtype;
  v_record public.attendance%rowtype;
  v_loc_id uuid;
  v_loc record;
  v_distance double precision := null;
  v_matched_distance double precision := null;
  v_has_location boolean := false;
  v_now timestamptz := now();
  v_local_time time;
  v_work_date date;
  v_settings jsonb;
  v_status public.attendance_status;
  v_in_start time;
  v_in_end time;
  v_out_start time;
  v_out_end time;
  v_late_at time;
  v_check_out boolean;
  v_record_id uuid;
begin
  -- 6.0. Validate input cơ bản
  if p_action not in ('CHECK_IN', 'CHECK_OUT') then
    return jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'message', 'Thao tác điểm danh không hợp lệ.');
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90
     or p_longitude not between -180 and 180 then
    return jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'message', 'Không thể xác định vị trí hiện tại. Vui lòng thử lại.');
  end if;

  -- 6.1. Người dùng phải là thực tập sinh
  select * into v_intern
  from public.interns
  where user_id = p_user_id and deleted_at is null;

  if not found then
    return jsonb_build_object('success', false, 'code', 'PERMISSION_DENIED',
      'message', 'Không tìm thấy hồ sơ thực tập sinh.');
  end if;

  -- 6.2. Đợt thực tập đang hoạt động
  select * into v_internship
  from public.internships
  where intern_id = v_intern.id
    and status = 'active'
    and deleted_at is null
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'code', 'NO_ACTIVE_INTERNSHIP',
      'message', 'Bạn chưa có đợt thực tập đang hoạt động.');
  end if;

  -- 6.3. Onboarding phải hoàn thành (đồng bộ với trigger DB)
  if exists (
    select 1 from public.onboarding_records r
    where r.internship_id = v_internship.id
      and r.status <> 'completed'
  ) then
    return jsonb_build_object('success', false, 'code', 'ONBOARDING_NOT_COMPLETED',
      'message', 'Onboarding chưa hoàn thành. Vui lòng hoàn tất trước khi điểm danh.');
  end if;

  -- 6.4. Địa điểm làm việc được gán (khớp phòng ban / đợt, không gán = áp dụng chung)
  select coalesce(value, '{}'::jsonb) into v_settings
  from public.system_settings where key = 'attendance';

  v_local_time := (v_now at time zone 'Asia/Ho_Chi_Minh')::time;
  v_work_date := (v_now at time zone 'Asia/Ho_Chi_Minh')::date;

  for v_loc in
    select id, latitude, longitude, radius_m, min_accuracy_meters,
           check_in_start_time, check_in_end_time,
           check_out_start_time, check_out_end_time
    from public.attendance_locations
    where is_active
      and (department_id is null or department_id = v_internship.department_id)
      and (internship_batch_id is null or internship_batch_id = v_internship.batch_id)
  loop
    v_has_location := true;
    v_distance := public.distance_m(p_latitude, p_longitude, v_loc.latitude, v_loc.longitude);
    if v_distance <= v_loc.radius_m
      and (v_matched_distance is null or v_distance < v_matched_distance) then
      v_matched_distance := v_distance;
      v_loc_id := v_loc.id;
    end if;
  end loop;

  if not v_has_location then
    insert into public.attendance_verification_logs
      (user_id, work_location_id, action, latitude, longitude, accuracy, is_valid, failure_reason)
    values (p_user_id, null, p_action, p_latitude, p_longitude, p_accuracy, false,
            'NO_ASSIGNED_LOCATION');
    return jsonb_build_object('success', false, 'code', 'NO_ASSIGNED_LOCATION',
      'message', 'Bạn chưa được gán địa điểm làm việc.');
  end if;

  if v_loc_id is null then
    insert into public.attendance_verification_logs
      (user_id, work_location_id, action, latitude, longitude, accuracy, is_valid, failure_reason)
    values (p_user_id, null, p_action, p_latitude, p_longitude, p_accuracy, false,
            'LOCATION_OUT_OF_RANGE');
    return jsonb_build_object('success', false, 'code', 'LOCATION_OUT_OF_RANGE',
      'message', 'Bạn đang ở ngoài khu vực điểm danh cho phép.');
  end if;

  -- 6.5. Địa điểm đang hoạt động đã kiểm ở WHERE; đọc cấu hình khung giờ
  select * into v_loc
  from public.attendance_locations where id = v_loc_id;

  if v_loc.is_active is not true then
    insert into public.attendance_verification_logs
      (user_id, work_location_id, action, latitude, longitude, accuracy, is_valid, failure_reason)
    values (p_user_id, v_loc_id, p_action, p_latitude, p_longitude, p_accuracy, false,
            'LOCATION_INACTIVE');
    return jsonb_build_object('success', false, 'code', 'LOCATION_INACTIVE',
      'message', 'Địa điểm làm việc hiện không hoạt động.');
  end if;

  -- 6.6. Độ chính xác GPS
  if p_accuracy is null or p_accuracy <= 0 or p_accuracy > v_loc.min_accuracy_meters then
    insert into public.attendance_verification_logs
      (user_id, work_location_id, action, latitude, longitude, accuracy, distance_meters,
       is_valid, failure_reason)
    values (p_user_id, v_loc_id, p_action, p_latitude, p_longitude, p_accuracy,
            v_matched_distance, false, 'ACCURACY_NOT_MET');
    return jsonb_build_object('success', false, 'code', 'ACCURACY_NOT_MET',
      'message', 'Độ chính xác GPS chưa đạt yêu cầu.');
  end if;

  -- 6.7. Khung giờ điểm danh (ưu tiên cấu hình của địa điểm, fallback system_settings)
  v_in_start := coalesce(v_loc.check_in_start_time,
    nullif(v_settings->>'check_in_start', '')::time);
  v_in_end := coalesce(v_loc.check_in_end_time, null);
  v_out_start := coalesce(v_loc.check_out_start_time,
    nullif(v_settings->>'check_out_start', '')::time);
  v_out_end := coalesce(v_loc.check_out_end_time, null);
  v_late_at := nullif(v_settings->>'check_in_late', '')::time;

  if p_action = 'CHECK_IN' then
    if v_in_start is not null and v_local_time < v_in_start then
      insert into public.attendance_verification_logs
        (user_id, work_location_id, action, latitude, longitude, accuracy, distance_meters,
         is_valid, failure_reason)
      values (p_user_id, v_loc_id, p_action, p_latitude, p_longitude, p_accuracy,
              v_matched_distance, false, 'CHECK_IN_TOO_EARLY');
      return jsonb_build_object('success', false, 'code', 'CHECK_IN_TOO_EARLY',
        'message', 'Chưa đến giờ check-in.');
    end if;
    if v_in_end is not null and v_local_time > v_in_end then
      insert into public.attendance_verification_logs
        (user_id, work_location_id, action, latitude, longitude, accuracy, distance_meters,
         is_valid, failure_reason)
      values (p_user_id, v_loc_id, p_action, p_latitude, p_longitude, p_accuracy,
              v_matched_distance, false, 'CHECK_IN_WINDOW_CLOSED');
      return jsonb_build_object('success', false, 'code', 'CHECK_IN_WINDOW_CLOSED',
        'message', 'Đã hết thời gian check-in.');
    end if;
  else
    if v_out_end is not null and v_local_time > v_out_end then
      insert into public.attendance_verification_logs
        (user_id, work_location_id, action, latitude, longitude, accuracy, distance_meters,
         is_valid, failure_reason)
      values (p_user_id, v_loc_id, p_action, p_latitude, p_longitude, p_accuracy,
              v_matched_distance, false, 'CHECK_OUT_WINDOW_CLOSED');
      return jsonb_build_object('success', false, 'code', 'CHECK_OUT_WINDOW_CLOSED',
        'message', 'Đã hết thời gian check-out.');
    end if;
  end if;

  -- 6.8. Trạng thái điểm danh hiện tại (khóa dòng — chống race 2 yêu cầu đồng thời)
  select * into v_record
  from public.attendance
  where intern_id = v_intern.id and work_date = v_work_date
  for update;

  if p_action = 'CHECK_IN' then
    if found and v_record.check_in_at is not null then
      insert into public.attendance_verification_logs
        (user_id, attendance_id, work_location_id, action, latitude, longitude, accuracy,
         distance_meters, is_valid, failure_reason)
      values (p_user_id, v_record.id, v_loc_id, p_action, p_latitude, p_longitude, p_accuracy,
              v_matched_distance, false, 'ALREADY_CHECKED_IN');
      return jsonb_build_object('success', false, 'code', 'ALREADY_CHECKED_IN',
        'message', 'Bạn đã check-in trong ca làm việc này.');
    end if;

    -- Trạng thái: vượt khung giờ check_in_late của hệ thống → late
    if v_late_at is not null and v_local_time > v_late_at then
      v_status := 'late';
    else
      v_status := 'present';
    end if;

    begin
      if found then
        update public.attendance set
          check_in_at = v_now,
          check_in_latitude = p_latitude,
          check_in_longitude = p_longitude,
          check_in_accuracy = p_accuracy,
          check_in_distance_meters = round(v_matched_distance::numeric, 1),
          location_id = v_loc_id,
          internship_id = v_internship.id,
          status = v_status,
          is_geo_validated = true,
          note = coalesce(p_note, note)
        where id = v_record.id
        returning id into v_record_id;
      else
        insert into public.attendance (
          intern_id, internship_id, location_id, work_date,
          check_in_at, check_in_latitude, check_in_longitude,
          check_in_accuracy, check_in_distance_meters,
          status, is_geo_validated, note
        ) values (
          v_intern.id, v_internship.id, v_loc_id, v_work_date,
          v_now, p_latitude, p_longitude,
          p_accuracy, round(v_matched_distance::numeric, 1),
          v_status, true, p_note
        )
        returning id into v_record_id;
      end if;
    exception when unique_violation then
      insert into public.attendance_verification_logs
        (user_id, work_location_id, action, latitude, longitude, accuracy, distance_meters,
         is_valid, failure_reason)
      values (p_user_id, v_loc_id, p_action, p_latitude, p_longitude, p_accuracy,
              v_matched_distance, false, 'ALREADY_CHECKED_IN');
      return jsonb_build_object('success', false, 'code', 'ALREADY_CHECKED_IN',
        'message', 'Bạn đã check-in trong ca làm việc này.');
    when others then
      insert into public.attendance_verification_logs
        (user_id, work_location_id, action, latitude, longitude, accuracy, distance_meters,
         is_valid, failure_reason)
      values (p_user_id, v_loc_id, p_action, p_latitude, p_longitude, p_accuracy,
              v_matched_distance, false, 'WRITE_FAILED');
      return jsonb_build_object('success', false, 'code', 'WRITE_FAILED',
        'message', 'Không thể xác minh vị trí. Vui lòng thử lại.');
    end;

    insert into public.attendance_verification_logs
      (user_id, attendance_id, work_location_id, action, latitude, longitude, accuracy,
       distance_meters, is_valid)
    values (p_user_id, v_record_id, v_loc_id, p_action, p_latitude, p_longitude, p_accuracy,
            v_matched_distance, true);

    return jsonb_build_object(
      'success', true,
      'action', 'CHECK_IN',
      'status', v_status,
      'message', 'Check-in thành công.',
      'attendance_id', v_record_id,
      'distance_meters', round(v_matched_distance::numeric, 1)
    );
  end if;

  -- CHECK_OUT
  if not found or v_record.check_in_at is null then
    insert into public.attendance_verification_logs
      (user_id, work_location_id, action, latitude, longitude, accuracy, distance_meters,
       is_valid, failure_reason)
    values (p_user_id, v_loc_id, p_action, p_latitude, p_longitude, p_accuracy,
            v_matched_distance, false, 'NEED_CHECK_IN');
    return jsonb_build_object('success', false, 'code', 'NEED_CHECK_IN',
      'message', 'Bạn cần check-in trước khi check-out.');
  end if;

  if v_record.check_out_at is not null then
    insert into public.attendance_verification_logs
      (user_id, attendance_id, work_location_id, action, latitude, longitude, accuracy,
       distance_meters, is_valid, failure_reason)
    values (p_user_id, v_record.id, v_loc_id, p_action, p_latitude, p_longitude, p_accuracy,
            v_matched_distance, false, 'ALREADY_CHECKED_OUT');
    return jsonb_build_object('success', false, 'code', 'ALREADY_CHECKED_OUT',
      'message', 'Bạn đã check-out trong ca làm việc này.');
  end if;

  if v_record.status = 'leave' or v_record.status = 'wfh' then
    v_status := v_record.status;
  elsif v_out_start is not null and v_local_time < v_out_start then
    v_status := 'early_leave';
  else
    v_status := v_record.status;
  end if;

  begin
    update public.attendance set
      check_out_at = v_now,
      check_out_latitude = p_latitude,
      check_out_longitude = p_longitude,
      check_out_accuracy = p_accuracy,
      check_out_distance_meters = round(v_matched_distance::numeric, 1),
      location_id = v_loc_id,
      status = v_status,
      is_geo_validated = true,
      note = coalesce(p_note, note)
    where id = v_record.id
    returning id into v_record_id;
  exception when others then
    insert into public.attendance_verification_logs
      (user_id, attendance_id, work_location_id, action, latitude, longitude, accuracy,
       distance_meters, is_valid, failure_reason)
    values (p_user_id, v_record.id, v_loc_id, p_action, p_latitude, p_longitude, p_accuracy,
            v_matched_distance, false, 'WRITE_FAILED');
    return jsonb_build_object('success', false, 'code', 'WRITE_FAILED',
      'message', 'Không thể xác minh vị trí. Vui lòng thử lại.');
  end;

  insert into public.attendance_verification_logs
    (user_id, attendance_id, work_location_id, action, latitude, longitude, accuracy,
     distance_meters, is_valid)
  values (p_user_id, v_record_id, v_loc_id, p_action, p_latitude, p_longitude, p_accuracy,
          v_matched_distance, true);

  return jsonb_build_object(
    'success', true,
    'action', 'CHECK_OUT',
    'status', v_status,
    'message', 'Check-out thành công.',
    'attendance_id', v_record_id,
    'distance_meters', round(v_matched_distance::numeric, 1)
  );
end;
$$;

revoke all on function public.attendance_check(uuid, text, double precision, double precision, double precision, text)
  from public, anon, authenticated;
grant execute on function public.attendance_check(uuid, text, double precision, double precision, double precision, text)
  to service_role;

-- --------------------------------------------------------------------------
-- 7. Điều chỉnh công (HR/Admin) — ghi log audit
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
  if v_uid is null or not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role_code in ('hr', 'admin')
  ) then
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
-- 8. Đảm bảo attendance_locations có dữ liệu minh họa cho môi trường dev
--    (không ép — chỉ insert khi bảng trống)
-- --------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.attendance_locations) then
    insert into public.attendance_locations
      (name, address, latitude, longitude, radius_m, code)
    values
      ('Văn phòng công ty', 'Địa chỉ văn phòng thực tế', 11.9404, 108.4583, 100, 'HQ-01');
  end if;
end $$;
