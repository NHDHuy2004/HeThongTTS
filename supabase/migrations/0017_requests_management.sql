-- ==========================================================================
-- IMS – 0017_requests_management.sql
-- Quản lý đơn từ thống nhất:
--   * request_types      : cấu hình loại đơn (seed 7 loại).
--   * requests           : đơn thống nhất (code, payload, trạng thái đầy đủ).
--   * request_attachments: tài liệu đính kèm (Storage bucket có sẵn).
--   * request_approval_logs: lịch sử xử lý.
--   * RPC: create_request / review_request / get_request_stats.
--   * Đồng bộ Attendance khi duyệt (nghỉ phép, WFH, điều chỉnh chấm công).
--   * Thông báo qua bảng notifications.
--   * Migrate dữ liệu từ leave_requests / late_requests / work_from_home_requests.
--
-- LƯU Ý: các giá trị enum mới (in_review, needs_revision, attendance_adjustment,
-- schedule_change, request_submitted, ...) chỉ được ADD trong file này và được
-- sử dụng lúc runtime — an toàn khi chạy trong 1 transaction của SQL Editor.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Mở rộng enum
-- --------------------------------------------------------------------------
alter type public.request_type add value if not exists 'attendance_adjustment';
alter type public.request_type add value if not exists 'schedule_change';

alter type public.request_status add value if not exists 'in_review';
alter type public.request_status add value if not exists 'needs_revision';

alter type public.notification_type add value if not exists 'request_submitted';
alter type public.notification_type add value if not exists 'request_revision';
alter type public.notification_type add value if not exists 'request_taken';
alter type public.notification_type add value if not exists 'request_cancelled';

-- --------------------------------------------------------------------------
-- 2. request_types
-- --------------------------------------------------------------------------
create table if not exists public.request_types (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  name                text not null,
  description         text,
  requires_attachment boolean not null default false,
  approval_policy     text not null default 'mentor_or_hr'
                      check (approval_policy in ('mentor_or_hr', 'hr_only')),
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists trg_request_types_updated on public.request_types;
create trigger trg_request_types_updated before update on public.request_types
for each row execute function public.handle_updated_at();

insert into public.request_types (code, name, description, requires_attachment, approval_policy) values
  ('leave',                'Nghỉ phép',            'Xin nghỉ trong một khoảng thời gian', false, 'mentor_or_hr'),
  ('late',                 'Đi muộn',              'Xin đến muộn so với giờ làm việc quy định', false, 'mentor_or_hr'),
  ('early_leave',          'Về sớm',               'Xin rời nơi làm việc trước giờ kết thúc ca', false, 'mentor_or_hr'),
  ('wfh',                  'Làm việc từ xa',       'Xin làm việc từ xa trong ngày', false, 'mentor_or_hr'),
  ('attendance_adjustment','Điều chỉnh chấm công', 'Yêu cầu điều chỉnh dữ liệu chấm công (quên check-in/out)', false, 'hr_only'),
  ('schedule_change',      'Thay đổi lịch làm việc','Yêu cầu thay đổi lịch làm việc chính thức', false, 'mentor_or_hr'),
  ('other',                'Đơn khác',             'Các loại đơn do HR cấu hình', false, 'mentor_or_hr')
on conflict (code) do nothing;

-- --------------------------------------------------------------------------
-- 3. requests
-- --------------------------------------------------------------------------
create table if not exists public.requests (
  id                   uuid primary key default gen_random_uuid(),
  request_code         text not null unique,
  user_id              uuid not null references public.profiles(id) on delete cascade,
  intern_id            uuid references public.interns(id) on delete cascade,
  internship_id        uuid references public.internships(id) on delete set null,
  request_type         public.request_type not null,
  title                text not null,
  description          text,
  reason               text not null,
  start_date           date,
  end_date             date,
  requested_start_time time,
  requested_end_time   time,
  payload              jsonb not null default '{}'::jsonb,
  status               public.request_status not null default 'pending',
  reviewer_id          uuid references public.profiles(id) on delete set null,
  reviewed_at          timestamptz,
  review_comment       text,
  rejection_reason     text,
  revision_note        text,
  submitted_at         timestamptz not null default now(),
  cancelled_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint requests_dates_check
    check (end_date is null or start_date is null or end_date >= start_date)
);

create index if not exists idx_requests_user on public.requests (user_id, created_at desc);
create index if not exists idx_requests_internship on public.requests (internship_id);
create index if not exists idx_requests_status on public.requests (status, created_at desc);
create index if not exists idx_requests_type on public.requests (request_type, created_at desc);
create index if not exists idx_requests_reviewer on public.requests (reviewer_id);
create index if not exists idx_requests_dates on public.requests (start_date, end_date);

-- Mã đơn: REQ-YYYYMMDD-XXXXXX (sinh tự động khi insert)
create or replace function public.assign_request_code()
returns trigger
language plpgsql
as $$
begin
  if new.request_code is null or new.request_code = '' then
    new.request_code := 'REQ-'
      || to_char(now(), 'YYYYMMDD')
      || '-'
      || upper(substr(replace(new.id::text, '-', ''), 1, 6));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_request_code on public.requests;
create trigger trg_assign_request_code
before insert on public.requests
for each row execute function public.assign_request_code();

drop trigger if exists trg_requests_updated on public.requests;
create trigger trg_requests_updated before update on public.requests
for each row execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 4. request_attachments
-- --------------------------------------------------------------------------
create table if not exists public.request_attachments (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests(id) on delete cascade,
  file_name   text not null,
  file_path   text not null,
  file_size   bigint check (file_size is null or file_size >= 0),
  mime_type   text,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists idx_request_attachments_request
  on public.request_attachments (request_id);

-- --------------------------------------------------------------------------
-- 5. request_approval_logs
-- --------------------------------------------------------------------------
create table if not exists public.request_approval_logs (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.requests(id) on delete cascade,
  actor_id        uuid references public.profiles(id) on delete set null,
  action          text not null,
  previous_status text,
  new_status      text,
  comment         text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_request_logs_request
  on public.request_approval_logs (request_id, created_at);

-- --------------------------------------------------------------------------
-- 6. RLS
--    - Intern thấy/xử lý đơn của mình (qua RPC — không update trực tiếp).
--    - Mentor thấy đơn của thực tập sinh được phân công.
--    - HR/Admin thấy toàn bộ.
--    - INSERT/UPDATE: KHÔNG có policy client — mọi thao tác qua RPC
--      security definer (create_request / review_request).
-- --------------------------------------------------------------------------
alter table public.request_types enable row level security;
alter table public.requests enable row level security;
alter table public.request_attachments enable row level security;
alter table public.request_approval_logs enable row level security;

drop policy if exists request_types_select on public.request_types;
create policy request_types_select on public.request_types
  for select to authenticated using (is_active or public.is_hr_or_admin());

drop policy if exists request_types_write on public.request_types;
create policy request_types_write on public.request_types
  for all to authenticated
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

drop policy if exists requests_select_own on public.requests;
create policy requests_select_own on public.requests
  for select to authenticated using (user_id = auth.uid());

drop policy if exists requests_select_mentor on public.requests;
create policy requests_select_mentor on public.requests
  for select to authenticated using (public.is_mentor_of_internship(internship_id));

drop policy if exists requests_select_hr_admin on public.requests;
create policy requests_select_hr_admin on public.requests
  for select to authenticated using (public.is_hr_or_admin());

drop policy if exists request_attachments_select on public.request_attachments;
create policy request_attachments_select on public.request_attachments
  for select to authenticated
  using (
    uploaded_by = auth.uid()
    or public.is_hr_or_admin()
    or exists (
      select 1 from public.requests rq
      where rq.id = request_id
        and (rq.user_id = auth.uid() or public.is_mentor_of_internship(rq.internship_id))
    )
  );

drop policy if exists request_logs_select on public.request_approval_logs;
create policy request_logs_select on public.request_approval_logs
  for select to authenticated
  using (
    public.is_hr_or_admin()
    or exists (
      select 1 from public.requests rq
      where rq.id = request_id
        and (rq.user_id = auth.uid() or public.is_mentor_of_internship(rq.internship_id))
    )
  );

-- Mentor được đọc file đính kèm đơn từ (bucket request-attachments)
drop policy if exists "reqatts_select_mentor" on storage.objects;
create policy "reqatts_select_mentor" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'request-attachments'
    and exists (
      select 1
      from public.request_attachments ra
      join public.requests rq on rq.id = ra.request_id
      where ra.file_path = storage.objects.name
        and public.is_mentor_of_internship(rq.internship_id)
    )
  );

-- --------------------------------------------------------------------------
-- 7. Helpers
-- --------------------------------------------------------------------------
-- Người nhận thông báo: mentor của internship + HR/Admin đang hoạt động.
create or replace function public.request_notify_targets(p_internship_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct u), '{}'::uuid[])
  from (
    select m.user_id as u
    from public.internships ip
    join public.mentors m on m.id = ip.mentor_id
    where ip.id = p_internship_id and m.user_id is not null
    union
    select p.id
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where r.code in ('hr', 'admin') and p.is_active
  ) t;
$$;

create or replace function public.notify_request(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_request_id uuid,
  p_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, data)
  values (p_user_id, p_type, p_title, p_body,
          jsonb_build_object('request_id', p_request_id, 'path', p_path));
end;
$$;

-- --------------------------------------------------------------------------
-- 8. Đồng bộ Attendance khi đơn được duyệt
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
        || coalesce(' (trước: vào ' || to_char(v_old_in at time zone 'Asia/Ho_Chi_Minn', 'HH24:MI')
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
        'Điều chỉnh: vào ' || coalesce(to_char(v_old_in at time zone 'Asia/Ho_Chi_Minn', 'YYYY-MM-DD HH24:MI'), '—')
          || ' → ' || coalesce(to_char(nullif(p_request.payload->>'proposed_check_in', '')::timestamptz at time zone 'Asia/Ho_Chi_Minn', 'YYYY-MM-DD HH24:MI'), '—')
          || '; ra ' || coalesce(to_char(v_old_out at time zone 'Asia/Ho_Chi_Minn', 'YYYY-MM-DD HH24:MI'), '—')
          || ' → ' || coalesce(to_char(nullif(p_request.payload->>'proposed_check_out', '')::timestamptz at time zone 'Asia/Ho_Chi_Minn', 'YYYY-MM-DD HH24:MI'), '—')
      );
    end if;

    -- 'schedule_change' / 'other': không có module đích — lưu trong requests.
  end if;
end;
$$;

-- --------------------------------------------------------------------------
-- 9. create_request — Intern tạo & gửi đơn
-- --------------------------------------------------------------------------
create or replace function public.create_request(
  p_request_type text,
  p_title text,
  p_reason text,
  p_start_date date,
  p_end_date date,
  p_start_time time,
  p_end_time time,
  p_payload jsonb default '{}'::jsonb,
  p_description text default null,
  p_attachment_paths jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_intern public.interns%rowtype;
  v_internship public.internships%rowtype;
  v_type public.request_types%rowtype;
  v_id uuid;
  v_code text;
  v_path text;
  v_fname text;
  v_targets uuid[];
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'code', 'AUTH_REQUIRED',
      'message', 'Vui lòng đăng nhập.');
  end if;

  if p_title is null or length(trim(p_title)) < 3 then
    return jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'message', 'Tiêu đề đơn phải có ít nhất 3 ký tự.');
  end if;
  if p_reason is null or length(trim(p_reason)) < 5 then
    return jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'message', 'Vui lòng nhập lý do (tối thiểu 5 ký tự).');
  end if;

  select * into v_intern
  from public.interns where user_id = v_uid and deleted_at is null;
  if not found then
    return jsonb_build_object('success', false, 'code', 'PERMISSION_DENIED',
      'message', 'Chỉ thực tập sinh mới được gửi đơn.');
  end if;

  select * into v_internship
  from public.internships
  where intern_id = v_intern.id and status = 'active' and deleted_at is null
  order by created_at desc limit 1;
  if not found then
    return jsonb_build_object('success', false, 'code', 'NO_ACTIVE_INTERNSHIP',
      'message', 'Bạn chưa có đợt thực tập đang hoạt động.');
  end if;

  select * into v_type
  from public.request_types
  where code = p_request_type and is_active;
  if not found then
    return jsonb_build_object('success', false, 'code', 'UNKNOWN_REQUEST_TYPE',
      'message', 'Loại đơn không tồn tại hoặc đã bị tắt.');
  end if;

  -- Khoảng thời gian hợp lệ
  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    return jsonb_build_object('success', false, 'code', 'INVALID_DATE_RANGE',
      'message', 'Ngày kết thúc không được trước ngày bắt đầu.');
  end if;
  if p_start_date is null and v_type.code in ('leave', 'wfh', 'late', 'early_leave',
      'attendance_adjustment', 'schedule_change') then
    return jsonb_build_object('success', false, 'code', 'DATE_REQUIRED',
      'message', 'Vui lòng chọn ngày áp dụng cho đơn này.');
  end if;

  -- Trùng khoảng thời gian (đơn pending/in_review/approved cùng loại)
  if p_start_date is not null and v_type.code in ('leave', 'wfh') then
    if exists (
      select 1 from public.requests r
      where r.intern_id = v_intern.id
        and r.request_type = v_type.code::public.request_type
        and r.status in ('pending', 'in_review', 'approved')
        and r.start_date is not null
        and daterange(r.start_date, coalesce(r.end_date, r.start_date), '[]')
            && daterange(p_start_date, coalesce(p_end_date, p_start_date), '[]')
    ) then
      return jsonb_build_object('success', false, 'code', 'DUPLICATE_OVERLAP',
        'message', 'Đã tồn tại đơn cùng loại trong khoảng thời gian này.');
    end if;
  end if;

  -- Đơn điều chỉnh chấm công: bắt buộc có thời gian đề xuất
  if v_type.code = 'attendance_adjustment' then
    if coalesce(p_payload->>'proposed_check_in', '') = ''
       and coalesce(p_payload->>'proposed_check_out', '') = '' then
      return jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
        'message', 'Vui lòng nhập thời gian check-in hoặc check-out đề xuất.');
    end if;
  end if;

  if v_type.requires_attachment and jsonb_array_length(coalesce(p_attachment_paths, '[]'::jsonb)) = 0 then
    return jsonb_build_object('success', false, 'code', 'ATTACHMENT_REQUIRED',
      'message', 'Loại đơn này bắt buộc có tài liệu đính kèm.');
  end if;

  -- Validate đường dẫn đính kèm TRƯỚC khi ghi đơn (tránh bản ghi mồ côi)
  for v_path in
    select value #>> '{}' from jsonb_array_elements(coalesce(p_attachment_paths, '[]'::jsonb))
  loop
    if split_part(v_path, '/', 1) <> v_uid::text then
      return jsonb_build_object('success', false, 'code', 'ATTACHMENT_PATH_INVALID',
        'message', 'Đường dẫn đính kèm không thuộc về bạn.');
    end if;
  end loop;

  insert into public.requests (
    user_id, intern_id, internship_id, request_type, title, description, reason,
    start_date, end_date, requested_start_time, requested_end_time, payload, status,
    submitted_at
  ) values (
    v_uid, v_intern.id, v_internship.id, v_type.code::public.request_type,
    trim(p_title), p_description, trim(p_reason),
    p_start_date, p_end_date, p_start_time, p_end_time,
    coalesce(p_payload, '{}'::jsonb), 'pending', now()
  )
  returning id, request_code into v_id, v_code;

  -- Đính kèm (đường dẫn đã được kiểm tra thuộc user)
  for v_path in
    select value #>> '{}' from jsonb_array_elements(coalesce(p_attachment_paths, '[]'::jsonb))
  loop
    v_fname := v_path;
    if position('/' in reverse(v_path)) > 0 then
      v_fname := substr(v_path, length(v_path) - position('/' in reverse(v_path)) + 2);
    end if;
    insert into public.request_attachments (request_id, file_name, file_path, uploaded_by)
    values (v_id, v_fname, v_path, v_uid);
  end loop;

  insert into public.request_approval_logs (request_id, actor_id, action, previous_status, new_status, comment)
  values (v_id, v_uid, 'submit', null, 'pending', null);

  v_targets := public.request_notify_targets(v_internship.id);
  perform public.notify_request(
    u, 'request_submitted',
    'Đơn mới: ' || v_code,
    (select full_name from public.profiles where id = v_uid) || ' gửi đơn "' || p_title || '".',
    v_id, '/admin/requests/' || v_id
  )
  from unnest(v_targets) u
  where u <> v_uid;

  return jsonb_build_object(
    'success', true,
    'request_id', v_id,
    'request_code', v_code,
    'message', 'Đã gửi đơn thành công.'
  );
end;
$$;

-- --------------------------------------------------------------------------
-- 10. review_request — tiếp nhận / duyệt / từ chối / yêu cầu bổ sung /
--      hủy / gửi lại. Chỉ người có quyền; không tự duyệt; ràng buộc
--      trạng thái; ghi log; thông báo; đồng bộ Attendance khi duyệt.
-- --------------------------------------------------------------------------
create or replace function public.review_request(
  p_request_id uuid,
  p_action text,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_req public.requests%rowtype;
  v_prev text;
  v_new text;
  v_targets uuid[];
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'code', 'AUTH_REQUIRED',
      'message', 'Vui lòng đăng nhập.');
  end if;

  select public.get_my_role() into v_role;

  select * into v_req
  from public.requests where id = p_request_id for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND',
      'message', 'Không tìm thấy đơn.');
  end if;

  v_prev := v_req.status::text;

  -- ===================== Phân quyền theo hành động =====================
  if p_action in ('take', 'approve', 'reject', 'request_revision') then
    if v_uid = v_req.user_id then
      return jsonb_build_object('success', false, 'code', 'SELF_REVIEW',
        'message', 'Bạn không được tự xử lý đơn của mình.');
    end if;
    if v_role not in ('mentor', 'hr', 'admin') then
      return jsonb_build_object('success', false, 'code', 'PERMISSION_DENIED',
        'message', 'Bạn không có quyền xử lý đơn.');
    end if;
    if v_role = 'mentor' and not public.is_mentor_of_internship(v_req.internship_id) then
      return jsonb_build_object('success', false, 'code', 'PERMISSION_DENIED',
        'message', 'Đơn không thuộc thực tập sinh bạn phụ trách.');
    end if;
    if v_role = 'mentor' and v_req.request_type = 'attendance_adjustment' then
      return jsonb_build_object('success', false, 'code', 'PERMISSION_DENIED',
        'message', 'Đơn điều chỉnh chấm công do HR/Admin xử lý.');
    end if;
  elsif p_action = 'cancel' then
    if not (v_uid = v_req.user_id or v_role in ('hr', 'admin')) then
      return jsonb_build_object('success', false, 'code', 'PERMISSION_DENIED',
        'message', 'Bạn không có quyền hủy đơn này.');
    end if;
  elsif p_action = 'resubmit' then
    if v_uid <> v_req.user_id or v_role <> 'intern' then
      return jsonb_build_object('success', false, 'code', 'PERMISSION_DENIED',
        'message', 'Chỉ người gửi đơn mới được gửi lại.');
    end if;
  else
    return jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'message', 'Hành động không hợp lệ.');
  end if;

  -- ===================== Ràng buộc trạng thái =====================
  if p_action = 'take' then
    if v_req.status <> 'pending' then
      return jsonb_build_object('success', false, 'code', 'INVALID_STATE',
        'message', 'Đơn không ở trạng thái chờ xử lý.');
    end if;
    v_new := 'in_review';

  elsif p_action = 'approve' then
    if v_req.status not in ('pending', 'in_review') then
      return jsonb_build_object('success', false, 'code', 'INVALID_STATE',
        'message', 'Đơn chỉ được duyệt khi đang chờ hoặc đang xem xét.');
    end if;
    v_new := 'approved';

  elsif p_action = 'reject' then
    if v_req.status not in ('pending', 'in_review') then
      return jsonb_build_object('success', false, 'code', 'INVALID_STATE',
        'message', 'Đơn không ở trạng thái có thể từ chối.');
    end if;
    if p_comment is null or length(trim(p_comment)) < 5 then
      return jsonb_build_object('success', false, 'code', 'COMMENT_REQUIRED',
        'message', 'Bắt buộc nhập lý do từ chối (tối thiểu 5 ký tự).');
    end if;
    v_new := 'rejected';

  elsif p_action = 'request_revision' then
    if v_req.status not in ('pending', 'in_review') then
      return jsonb_build_object('success', false, 'code', 'INVALID_STATE',
        'message', 'Đơn không ở trạng thái có thể yêu cầu bổ sung.');
    end if;
    if p_comment is null or length(trim(p_comment)) < 5 then
      return jsonb_build_object('success', false, 'code', 'COMMENT_REQUIRED',
        'message', 'Bắt buộc nhập nội dung cần bổ sung.');
    end if;
    v_new := 'needs_revision';

  elsif p_action = 'cancel' then
    if v_req.status not in ('pending', 'in_review', 'needs_revision') then
      return jsonb_build_object('success', false, 'code', 'INVALID_STATE',
        'message', 'Chỉ hủy được đơn chưa được duyệt.');
    end if;
    v_new := 'cancelled';

  elsif p_action = 'resubmit' then
    if v_req.status <> 'needs_revision' then
      return jsonb_build_object('success', false, 'code', 'INVALID_STATE',
        'message', 'Chỉ gửi lại được đơn đang bị yêu cầu bổ sung.');
    end if;
    v_new := 'pending';
  end if;

  -- ===================== Cập nhật =====================
  update public.requests set
    status = v_new::public.request_status,
    reviewer_id = case
      when p_action in ('take', 'approve', 'reject', 'request_revision') then v_uid
      when p_action = 'cancel' and v_uid <> v_req.user_id then v_uid
      else reviewer_id
    end,
    reviewed_at = case
      when p_action in ('approve', 'reject', 'request_revision') then now()
      when p_action = 'resubmit' then null
      else reviewed_at
    end,
    review_comment = case
      when p_action in ('approve', 'take') then coalesce(p_comment, review_comment)
      when p_action = 'resubmit' then null
      else review_comment
    end,
    rejection_reason = case when p_action = 'reject' then trim(p_comment) else rejection_reason end,
    revision_note = case
      when p_action = 'request_revision' then trim(p_comment)
      when p_action = 'resubmit' then null
      else revision_note
    end,
    cancelled_at = case when p_action = 'cancel' then now() else cancelled_at end,
    submitted_at = case when p_action = 'resubmit' then now() else submitted_at end
  where id = p_request_id;

  insert into public.request_approval_logs (request_id, actor_id, action, previous_status, new_status, comment)
  values (p_request_id, v_uid, p_action, v_prev, v_new, p_comment);

  -- ===================== Đồng bộ Attendance khi duyệt =====================
  if p_action = 'approve' then
    v_req.status := 'approved'::public.request_status;
    v_req.reviewer_id := v_uid;
    v_req.review_comment := p_comment;
    perform public.sync_request_attendance(v_req);
  end if;

  -- ===================== Thông báo =====================
  if p_action in ('approve', 'reject', 'request_revision', 'take', 'cancel', 'resubmit') then
    -- notify người gửi
    if p_action = 'approve' then
      perform public.notify_request(v_req.user_id, 'request_approved',
        'Đơn ' || v_req.request_code || ' đã được duyệt',
        'Đơn "' || v_req.title || '" của bạn đã được phê duyệt.', p_request_id,
        '/intern/requests/' || p_request_id);
    elsif p_action = 'reject' then
      perform public.notify_request(v_req.user_id, 'request_rejected',
        'Đơn ' || v_req.request_code || ' bị từ chối',
        'Lý do: ' || trim(p_comment), p_request_id,
        '/intern/requests/' || p_request_id);
    elsif p_action = 'request_revision' then
      perform public.notify_request(v_req.user_id, 'request_revision',
        'Đơn ' || v_req.request_code || ' cần bổ sung',
        trim(p_comment), p_request_id,
        '/intern/requests/' || p_request_id);
    elsif p_action = 'take' then
      perform public.notify_request(v_req.user_id, 'request_taken',
        'Đơn ' || v_req.request_code || ' đang được xử lý',
        'Đơn "' || v_req.title || '" đã được tiếp nhận.', p_request_id,
        '/intern/requests/' || p_request_id);
    end if;
  end if;

  if p_action in ('submit', 'resubmit', 'cancel') then
    v_targets := public.request_notify_targets(v_req.internship_id);
    perform public.notify_request(
      u,
      case when p_action = 'cancel' then 'request_cancelled'::public.notification_type
           else 'request_submitted'::public.notification_type end,
      case when p_action = 'cancel' then 'Đơn ' || v_req.request_code || ' đã bị hủy'
           else 'Đơn ' || v_req.request_code || ' cần xử lý' end,
      'Đơn "' || v_req.title || '" (' ||
        case when p_action = 'resubmit' then 'gửi lại' else 'mới' end || ').',
      p_request_id, '/admin/requests/' || p_request_id
    )
    from unnest(v_targets) u
    where u <> v_uid;
  end if;

  return jsonb_build_object(
    'success', true,
    'previous_status', v_prev,
    'status', v_new,
    'message', case p_action
      when 'approve' then 'Đã phê duyệt đơn.'
      when 'reject' then 'Đã từ chối đơn.'
      when 'take' then 'Đã tiếp nhận đơn.'
      when 'request_revision' then 'Đã yêu cầu bổ sung.'
      when 'cancel' then 'Đã hủy đơn.'
      when 'resubmit' then 'Đã gửi lại đơn.'
      else 'Đã cập nhật.'
    end
  );
end;
$$;

-- --------------------------------------------------------------------------
-- 11. get_request_stats — dashboard báo cáo
-- --------------------------------------------------------------------------
create or replace function public.get_request_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_result jsonb;
begin
  v_role := public.get_my_role();
  if v_role is null or v_role not in ('admin', 'hr', 'mentor') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total', count(*),
    'by_status', coalesce(
      (select jsonb_object_agg(status, cnt) from (
         select status::text as status, count(*) as cnt
         from public.requests
         where (v_role <> 'mentor' or public.is_mentor_of_internship(internship_id))
         group by status
       ) s), '{}'::jsonb),
    'by_type', coalesce(
      (select jsonb_object_agg(request_type, cnt) from (
         select request_type::text as request_type, count(*) as cnt
         from public.requests
         where (v_role <> 'mentor' or public.is_mentor_of_internship(internship_id))
         group by request_type
       ) t), '{}'::jsonb),
    'overdue_pending', (
      select count(*) from public.requests
      where status = 'pending'
        and submitted_at < now() - interval '48 hours'
        and (v_role <> 'mentor' or public.is_mentor_of_internship(internship_id))
    ),
    'avg_review_hours', (
      select round(avg(extract(epoch from (reviewed_at - submitted_at)) / 3600)::numeric, 1)
      from public.requests
      where reviewed_at is not null
        and (v_role <> 'mentor' or public.is_mentor_of_internship(internship_id))
    )
  )
  into v_result
  from public.requests
  where (v_role <> 'mentor' or public.is_mentor_of_internship(internship_id));

  return v_result;
end;
$$;

revoke all on function public.get_request_stats() from PUBLIC, anon;
grant execute on function public.get_request_stats() to authenticated;

-- --------------------------------------------------------------------------
-- 12. Migrate dữ liệu đơn cũ → requests (idempotent theo legacy_id)
-- --------------------------------------------------------------------------
create unique index if not exists idx_requests_legacy_id
  on public.requests ((payload->>'legacy_id'));

insert into public.requests (
  user_id, intern_id, internship_id, request_type, title, reason,
  start_date, end_date, payload, status, reviewer_id, reviewed_at,
  review_comment, created_at, updated_at, submitted_at
)
select
  i.user_id,
  lr.id,
  lr.internship_id,
  'leave',
  'Đơn nghỉ phép (dữ liệu cũ)',
  lr.reason,
  lr.start_date,
  lr.end_date,
  jsonb_build_object('legacy_table', 'leave_requests', 'legacy_id', lr.id),
  lr.status,
  lr.reviewed_by,
  lr.reviewed_at,
  lr.review_note,
  lr.created_at,
  lr.updated_at,
  lr.created_at
from public.leave_requests lr
join public.interns i on i.id = lr.intern_id and i.user_id is not null
on conflict ((payload->>'legacy_id')) do nothing;

insert into public.requests (
  user_id, intern_id, internship_id, request_type, title, reason,
  start_date, end_date, payload, status, reviewer_id, reviewed_at,
  review_comment, created_at, updated_at, submitted_at
)
select
  i.user_id,
  w.id,
  w.internship_id,
  'wfh',
  'Đơn làm việc từ xa (dữ liệu cũ)',
  w.reason,
  w.work_date,
  w.work_date,
  jsonb_build_object('legacy_table', 'work_from_home_requests', 'legacy_id', w.id),
  w.status,
  w.reviewed_by,
  w.reviewed_at,
  w.review_note,
  w.created_at,
  w.updated_at,
  w.created_at
from public.work_from_home_requests w
join public.interns i on i.id = w.intern_id and i.user_id is not null
on conflict ((payload->>'legacy_id')) do nothing;

insert into public.requests (
  user_id, intern_id, internship_id, request_type, title, reason,
  start_date, end_date, requested_start_time, payload, status,
  reviewer_id, reviewed_at, review_comment, created_at, updated_at, submitted_at
)
select
  i.user_id,
  lr.id,
  lr.internship_id,
  case when lr.request_type in ('late', 'early_leave', 'other')
       then lr.request_type else 'late' end,
  case when lr.request_type = 'early_leave' then 'Đơn về sớm (dữ liệu cũ)'
       else 'Đơn đi muộn (dữ liệu cũ)' end,
  lr.reason,
  lr.request_date,
  lr.request_date,
  case when lr.minutes_late is not null
       then make_interval(mins => lr.minutes_late)::time end,
  jsonb_build_object(
    'legacy_table', 'late_requests',
    'legacy_id', lr.id,
    'minutes_late', lr.minutes_late
  ),
  lr.status,
  lr.reviewed_by,
  lr.reviewed_at,
  lr.review_note,
  lr.created_at,
  lr.updated_at,
  lr.created_at
from public.late_requests lr
join public.interns i on i.id = lr.intern_id and i.user_id is not null
on conflict ((payload->>'legacy_id')) do nothing;
