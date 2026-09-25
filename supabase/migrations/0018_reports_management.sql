-- ==========================================================================
-- IMS – 0018_reports_management.sql
-- Quản lý báo cáo thực tập thống nhất:
--   * reports              : báo cáo ngày / tuần / tháng / tổng kết.
--   * report_attachments   : tài liệu đính kèm (Storage bucket report-attachments).
--   * report_task_links    : liên kết báo cáo với Tasks.
--   * report_reviews       : lịch sử xét duyệt.
--   * report_versions      : lịch sử phiên bản nội dung.
--   * report_templates     : mẫu báo cáo (seed 4 loại ở 0019).
--   * report_schedules     : kỳ hạn báo cáo theo đợt thực tập.
--   * RPC: create_report / update_report / submit_report / review_report /
--          get_report_stats.
--   * Thông báo qua bảng notifications.
--   * Migrate dữ liệu từ daily_reports / weekly_reports.
--
-- LƯU Ý: các giá trị enum mới (monthly, final, in_review, needs_revision,
-- cancelled, report_submitted, ...) chỉ được ADD trong file này và dùng lúc
-- runtime — an toàn khi chạy trong 1 transaction của SQL Editor.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Mở rộng enum
-- --------------------------------------------------------------------------
alter type public.report_type add value if not exists 'monthly';
alter type public.report_type add value if not exists 'final';

alter type public.report_status add value if not exists 'in_review';
alter type public.report_status add value if not exists 'needs_revision';
alter type public.report_status add value if not exists 'cancelled';

alter type public.notification_type add value if not exists 'report_submitted';
alter type public.notification_type add value if not exists 'report_revision';
alter type public.notification_type add value if not exists 'report_due_soon';
alter type public.notification_type add value if not exists 'report_overdue';

-- --------------------------------------------------------------------------
-- 2. reports
-- --------------------------------------------------------------------------
create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  report_code     text not null unique,
  internship_id   uuid references public.internships(id) on delete cascade,
  intern_id       uuid not null references public.interns(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  mentor_id       uuid references public.mentors(id) on delete set null,
  report_type     public.report_type not null,
  title           text not null,
  period_start    date not null,
  period_end      date not null,
  content         jsonb not null default '{}'::jsonb,
  links           jsonb not null default '[]'::jsonb,
  status          public.report_status not null default 'draft',
  submitted_at    timestamptz,
  reviewed_at     timestamptz,
  reviewed_by     uuid references public.profiles(id) on delete set null,
  review_comment  text,
  rejection_reason text,
  revision_note   text,
  due_date        date,
  is_late         boolean not null default false,
  cancelled_at    timestamptz,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint reports_dates_check check (period_end >= period_start)
);

create index if not exists idx_reports_intern on public.reports (intern_id, period_start desc);
create index if not exists idx_reports_internship on public.reports (internship_id, period_start desc);
create index if not exists idx_reports_status on public.reports (status, period_start desc);
create index if not exists idx_reports_type on public.reports (report_type, period_start desc);
create index if not exists idx_reports_user on public.reports (user_id, created_at desc);
create index if not exists idx_reports_mentor on public.reports (mentor_id);
create index if not exists idx_reports_due on public.reports (due_date, status);

-- Một kỳ báo cáo (intern + loại + ngày bắt đầu) chỉ có 1 bản — kiểm tra ở RPC
-- create_report (không unique index để tránh dùng giá trị enum mới trong
-- cùng transaction với ALTER TYPE).

-- Mã báo cáo: RPT-YYYYMMDD-XXXXXX (sinh tự động khi insert)
create or replace function public.assign_report_code()
returns trigger
language plpgsql
as $$
begin
  if new.report_code is null or new.report_code = '' then
    new.report_code := 'RPT-'
      || to_char(now(), 'YYYYMMDD')
      || '-'
      || upper(substr(replace(new.id::text, '-', ''), 1, 6));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_report_code on public.reports;
create trigger trg_assign_report_code
before insert on public.reports
for each row execute function public.assign_report_code();

drop trigger if exists trg_reports_updated on public.reports;
create trigger trg_reports_updated before update on public.reports
for each row execute function public.handle_updated_at();

-- --------------------------------------------------------------------------
-- 3. report_attachments
-- --------------------------------------------------------------------------
create table if not exists public.report_attachments (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports(id) on delete cascade,
  file_name   text not null,
  file_path   text not null,
  file_size   bigint check (file_size is null or file_size >= 0),
  mime_type   text,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists idx_report_attachments_report
  on public.report_attachments (report_id);

-- --------------------------------------------------------------------------
-- 4. report_task_links
-- --------------------------------------------------------------------------
create table if not exists public.report_task_links (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.reports(id) on delete cascade,
  task_id    uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (report_id, task_id)
);

create index if not exists idx_report_task_links_task
  on public.report_task_links (task_id);

-- --------------------------------------------------------------------------
-- 5. report_reviews (lịch sử xử lý)
-- --------------------------------------------------------------------------
create table if not exists public.report_reviews (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid not null references public.reports(id) on delete cascade,
  actor_id        uuid references public.profiles(id) on delete set null,
  action          text not null,
  previous_status text,
  new_status      text,
  comment         text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_report_reviews_report
  on public.report_reviews (report_id, created_at);

-- --------------------------------------------------------------------------
-- 6. report_versions (lịch sử phiên bản nội dung)
-- --------------------------------------------------------------------------
create table if not exists public.report_versions (
  id             uuid primary key default gen_random_uuid(),
  report_id      uuid not null references public.reports(id) on delete cascade,
  version_number int not null,
  title          text not null,
  content        jsonb not null default '{}'::jsonb,
  links          jsonb not null default '[]'::jsonb,
  submitted_by   uuid references public.profiles(id) on delete set null,
  submitted_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  unique (report_id, version_number)
);

create index if not exists idx_report_versions_report
  on public.report_versions (report_id, version_number desc);

-- --------------------------------------------------------------------------
-- 7. report_templates (mẫu báo cáo)
-- --------------------------------------------------------------------------
create table if not exists public.report_templates (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  report_type      public.report_type not null,
  description      text,
  template_content jsonb not null default '{}'::jsonb,
  is_active        boolean not null default true,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists trg_report_templates_updated on public.report_templates;
create trigger trg_report_templates_updated before update on public.report_templates
for each row execute function public.handle_updated_at();

-- Seed 4 mẫu báo cáo nằm ở 0019 (giá trị enum monthly/final không dùng được
-- trong cùng transaction với ALTER TYPE).
create unique index if not exists idx_report_templates_unique
  on public.report_templates (name, report_type);

-- --------------------------------------------------------------------------
-- 8. report_schedules (kỳ hạn theo đợt thực tập)
-- --------------------------------------------------------------------------
create table if not exists public.report_schedules (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references public.internship_batches(id) on delete cascade,
  report_type  public.report_type not null,
  frequency    text not null default 'weekly'
               check (frequency in ('daily', 'weekly', 'monthly', 'once')),
  due_date     date,
  due_time     time not null default '17:00',
  is_required  boolean not null default true,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_report_schedules_updated on public.report_schedules;
create trigger trg_report_schedules_updated before update on public.report_schedules
for each row execute function public.handle_updated_at();

create index if not exists idx_report_schedules_batch
  on public.report_schedules (batch_id, report_type);

-- --------------------------------------------------------------------------
-- 9. RLS
--    - Intern thấy báo cáo của mình; mentor thấy báo cáo thực tập sinh được
--      phân công; HR/Admin thấy toàn bộ.
--    - INSERT/UPDATE/DELETE: KHÔNG có policy client — mọi thao tác qua RPC
--      security definer (create_report / update_report / submit_report /
--      review_report).
-- --------------------------------------------------------------------------
alter table public.reports enable row level security;
alter table public.report_attachments enable row level security;
alter table public.report_task_links enable row level security;
alter table public.report_reviews enable row level security;
alter table public.report_versions enable row level security;
alter table public.report_templates enable row level security;
alter table public.report_schedules enable row level security;

drop policy if exists reports_select_own on public.reports;
create policy reports_select_own on public.reports
  for select to authenticated using (user_id = auth.uid());

drop policy if exists reports_select_mentor on public.reports;
create policy reports_select_mentor on public.reports
  for select to authenticated using (public.is_mentor_of_internship(internship_id));

drop policy if exists reports_select_hr_admin on public.reports;
create policy reports_select_hr_admin on public.reports
  for select to authenticated using (public.is_hr_or_admin());

drop policy if exists report_attachments_select on public.report_attachments;
create policy report_attachments_select on public.report_attachments
  for select to authenticated
  using (
    uploaded_by = auth.uid()
    or public.is_hr_or_admin()
    or exists (
      select 1 from public.reports r
      where r.id = report_id
        and (r.user_id = auth.uid() or public.is_mentor_of_internship(r.internship_id))
    )
  );

drop policy if exists report_task_links_select on public.report_task_links;
create policy report_task_links_select on public.report_task_links
  for select to authenticated
  using (
    public.is_hr_or_admin()
    or exists (
      select 1 from public.reports r
      where r.id = report_id
        and (r.user_id = auth.uid() or public.is_mentor_of_internship(r.internship_id))
    )
  );

drop policy if exists report_reviews_select on public.report_reviews;
create policy report_reviews_select on public.report_reviews
  for select to authenticated
  using (
    public.is_hr_or_admin()
    or exists (
      select 1 from public.reports r
      where r.id = report_id
        and (r.user_id = auth.uid() or public.is_mentor_of_internship(r.internship_id))
    )
  );

drop policy if exists report_versions_select on public.report_versions;
create policy report_versions_select on public.report_versions
  for select to authenticated
  using (
    public.is_hr_or_admin()
    or exists (
      select 1 from public.reports r
      where r.id = report_id
        and (r.user_id = auth.uid() or public.is_mentor_of_internship(r.internship_id))
    )
  );

drop policy if exists report_templates_select on public.report_templates;
create policy report_templates_select on public.report_templates
  for select to authenticated using (is_active or public.is_hr_or_admin());

drop policy if exists report_templates_write on public.report_templates;
create policy report_templates_write on public.report_templates
  for all to authenticated
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

drop policy if exists report_schedules_select on public.report_schedules;
create policy report_schedules_select on public.report_schedules
  for select to authenticated using (public.is_hr_or_admin());

drop policy if exists report_schedules_write on public.report_schedules;
create policy report_schedules_write on public.report_schedules
  for all to authenticated
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- Mentor được đọc file đính kèm báo cáo (bucket report-attachments)
drop policy if exists "repatts_select_mentor" on storage.objects;
create policy "repatts_select_mentor" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'report-attachments'
    and exists (
      select 1
      from public.report_attachments ra
      join public.reports r on r.id = ra.report_id
      where ra.file_path = storage.objects.name
        and public.is_mentor_of_internship(r.internship_id)
    )
  );

-- --------------------------------------------------------------------------
-- 10. Helpers
-- --------------------------------------------------------------------------
-- Người nhận thông báo: mentor của internship + HR/Admin đang hoạt động.
create or replace function public.report_notify_targets(p_internship_id uuid)
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

create or replace function public.notify_report(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_report_id uuid,
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
          jsonb_build_object('report_id', p_report_id, 'path', p_path));
end;
$$;

-- Các trường bắt buộc theo loại báo cáo (kiểm tra khi nộp).
-- Tham số text để không cast enum 'monthly'/'final' lúc CREATE FUNCTION
-- (giá trị enum mới không dùng được trong cùng transaction với ALTER TYPE).
create or replace function public.report_required_keys(p_type text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_type
    when 'daily'  then array['work_done', 'results']
    when 'weekly' then array['completed_tasks', 'results']
    when 'monthly' then array['completed_work', 'highlights']
    when 'final'  then array['goals', 'work_content', 'results', 'self_evaluation']
    else array[]::text[]
  end;
$$;

-- --------------------------------------------------------------------------
-- 11. create_report — Intern tạo báo cáo (nháp hoặc nộp ngay)
-- --------------------------------------------------------------------------
create or replace function public.create_report(
  p_report_type text,
  p_title text,
  p_period_start date,
  p_period_end date,
  p_content jsonb default '{}'::jsonb,
  p_links jsonb default '[]'::jsonb,
  p_task_ids jsonb default '[]'::jsonb,
  p_due_date date default null,
  p_attachment_paths jsonb default '[]'::jsonb,
  p_submit boolean default false
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
  v_type public.report_type;
  v_id uuid;
  v_code text;
  v_due date;
  v_status public.report_status;
  v_path text;
  v_fname text;
  v_req text;
  v_val text;
  v_task uuid;
  v_targets uuid[];
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'code', 'AUTH_REQUIRED',
      'message', 'Vui lòng đăng nhập.');
  end if;

  if p_report_type not in ('daily', 'weekly', 'monthly', 'final') then
    return jsonb_build_object('success', false, 'code', 'UNKNOWN_REPORT_TYPE',
      'message', 'Loại báo cáo không hợp lệ.');
  end if;
  v_type := p_report_type::public.report_type;

  if p_title is null or length(trim(p_title)) < 5 then
    return jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'message', 'Tiêu đề báo cáo phải có ít nhất 5 ký tự.');
  end if;
  if p_period_start is null or p_period_end is null then
    return jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'message', 'Vui lòng chọn kỳ báo cáo.');
  end if;
  if p_period_end < p_period_start then
    return jsonb_build_object('success', false, 'code', 'INVALID_DATE_RANGE',
      'message', 'Ngày kết thúc không được trước ngày bắt đầu.');
  end if;

  select * into v_intern
  from public.interns where user_id = v_uid and deleted_at is null;
  if not found then
    return jsonb_build_object('success', false, 'code', 'PERMISSION_DENIED',
      'message', 'Chỉ thực tập sinh mới được tạo báo cáo.');
  end if;

  select * into v_internship
  from public.internships
  where intern_id = v_intern.id and status = 'active' and deleted_at is null
  order by created_at desc limit 1;
  if not found then
    return jsonb_build_object('success', false, 'code', 'NO_ACTIVE_INTERNSHIP',
      'message', 'Bạn chưa có đợt thực tập đang hoạt động.');
  end if;

  -- Trùng kỳ báo cáo
  if exists (
    select 1 from public.reports r
    where r.intern_id = v_intern.id
      and r.report_type = v_type
      and r.period_start = p_period_start
      and r.status <> 'cancelled'
  ) then
    return jsonb_build_object('success', false, 'code', 'DUPLICATE_REPORT',
      'message', 'Đã tồn tại báo cáo này cho kỳ được chọn.');
  end if;

  -- Nội dung bắt buộc khi nộp
  if coalesce(p_submit, false) then
    for v_req in select unnest(public.report_required_keys(v_type)) loop
      v_val := nullif(trim(coalesce(p_content ->> v_req, '')), '');
      if v_val is null then
        return jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
          'message', 'Bắt buộc điền nội dung: ' || v_req || '.');
      end if;
    end loop;
  end if;

  -- Hạn nộp: chỉ định hoặc lấy từ cấu hình kỳ hạn của đợt thực tập
  v_due := p_due_date;
  if v_due is null then
    select s.due_date into v_due
    from public.report_schedules s
    where s.batch_id = v_internship.batch_id
      and s.report_type = v_type
      and s.is_active
    order by s.created_at desc limit 1;
  end if;

  v_status := case when coalesce(p_submit, false)
                   then 'submitted'::public.report_status
                   else 'draft'::public.report_status end;

  -- Validate đường dẫn đính kèm TRƯỚC khi ghi báo cáo (tránh bản ghi mồ côi)
  for v_path in
    select value #>> '{}' from jsonb_array_elements(coalesce(p_attachment_paths, '[]'::jsonb))
  loop
    if split_part(v_path, '/', 1) <> v_uid::text then
      return jsonb_build_object('success', false, 'code', 'ATTACHMENT_PATH_INVALID',
        'message', 'Đường dẫn đính kèm không thuộc về bạn.');
    end if;
  end loop;

  insert into public.reports (
    internship_id, intern_id, user_id, mentor_id, report_type, title,
    period_start, period_end, content, links, status, submitted_at,
    due_date, is_late
  ) values (
    v_internship.id, v_intern.id, v_uid, v_internship.mentor_id, v_type,
    trim(p_title), p_period_start, p_period_end,
    coalesce(p_content, '{}'::jsonb), coalesce(p_links, '[]'::jsonb),
    v_status,
    case when v_status = 'submitted' then now() else null end,
    v_due,
    case when v_status = 'submitted' and v_due is not null
           and now()::date > v_due
         then true else false end
  )
  returning id, report_code into v_id, v_code;

  for v_path in
    select value #>> '{}' from jsonb_array_elements(coalesce(p_attachment_paths, '[]'::jsonb))
  loop
    v_fname := v_path;
    if position('/' in reverse(v_path)) > 0 then
      v_fname := substr(v_path, length(v_path) - position('/' in reverse(v_path)) + 2);
    end if;
    insert into public.report_attachments (report_id, file_name, file_path, uploaded_by)
    values (v_id, v_fname, v_path, v_uid);
  end loop;

  for v_task in
    select (value #>> '{}')::uuid from jsonb_array_elements(coalesce(p_task_ids, '[]'::jsonb))
  loop
    if exists (select 1 from public.tasks t where t.id = v_task and t.internship_id = v_internship.id) then
      insert into public.report_task_links (report_id, task_id)
      values (v_id, v_task)
      on conflict (report_id, task_id) do nothing;
    end if;
  end loop;

  insert into public.report_reviews (report_id, actor_id, action, previous_status, new_status, comment)
  values (v_id, v_uid, 'create', null, v_status::text, null);

  if v_status = 'submitted' then
    insert into public.report_versions (report_id, version_number, title, content, links, submitted_by)
    values (v_id, 1, trim(p_title), coalesce(p_content, '{}'::jsonb),
            coalesce(p_links, '[]'::jsonb), v_uid);

    v_targets := public.report_notify_targets(v_internship.id);
    perform public.notify_report(
      u, 'report_submitted',
      'Báo cáo mới: ' || v_code,
      (select full_name from public.profiles where id = v_uid) || ' nộp báo cáo "' || p_title || '".',
      v_id, '/admin/reports/' || v_id
    )
    from unnest(v_targets) u
    where u <> v_uid;
  end if;

  return jsonb_build_object(
    'success', true,
    'report_id', v_id,
    'report_code', v_code,
    'status', v_status::text,
    'message', case when v_status = 'submitted'
                    then 'Đã nộp báo cáo thành công.'
                    else 'Đã lưu báo cáo nháp.' end
  );
end;
$$;

-- --------------------------------------------------------------------------
-- 12. update_report — chỉnh sửa báo cáo nháp / bị yêu cầu chỉnh sửa
-- --------------------------------------------------------------------------
create or replace function public.update_report(
  p_report_id uuid,
  p_title text,
  p_period_start date,
  p_period_end date,
  p_content jsonb default '{}'::jsonb,
  p_links jsonb default '[]'::jsonb,
  p_task_ids jsonb default '[]'::jsonb,
  p_due_date date default null,
  p_attachment_paths jsonb default '[]'::jsonb,
  p_submit boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rep public.reports%rowtype;
  v_path text;
  v_fname text;
  v_req text;
  v_val text;
  v_task uuid;
  v_targets uuid[];
  v_version int;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'code', 'AUTH_REQUIRED',
      'message', 'Vui lòng đăng nhập.');
  end if;

  select * into v_rep from public.reports where id = p_report_id for update;
  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND',
      'message', 'Không tìm thấy báo cáo.');
  end if;
  if v_rep.user_id <> v_uid then
    return jsonb_build_object('success', false, 'code', 'PERMISSION_DENIED',
      'message', 'Bạn chỉ được chỉnh sửa báo cáo của mình.');
  end if;
  if v_rep.status not in ('draft', 'needs_revision') then
    return jsonb_build_object('success', false, 'code', 'INVALID_STATE',
      'message', 'Báo cáo đã nộp không thể chỉnh sửa trực tiếp.');
  end if;

  if p_title is null or length(trim(p_title)) < 5 then
    return jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'message', 'Tiêu đề báo cáo phải có ít nhất 5 ký tự.');
  end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    return jsonb_build_object('success', false, 'code', 'INVALID_DATE_RANGE',
      'message', 'Kỳ báo cáo không hợp lệ.');
  end if;

  if coalesce(p_submit, false) then
    for v_req in select unnest(public.report_required_keys(v_rep.report_type)) loop
      v_val := nullif(trim(coalesce(p_content ->> v_req, '')), '');
      if v_val is null then
        return jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
          'message', 'Bắt buộc điền nội dung: ' || v_req || '.');
      end if;
    end loop;
  end if;

  for v_path in
    select value #>> '{}' from jsonb_array_elements(coalesce(p_attachment_paths, '[]'::jsonb))
  loop
    if split_part(v_path, '/', 1) <> v_uid::text then
      return jsonb_build_object('success', false, 'code', 'ATTACHMENT_PATH_INVALID',
        'message', 'Đường dẫn đính kèm không thuộc về bạn.');
    end if;
  end loop;

  update public.reports set
    title = trim(p_title),
    period_start = p_period_start,
    period_end = p_period_end,
    content = coalesce(p_content, '{}'::jsonb),
    links = coalesce(p_links, '[]'::jsonb),
    due_date = coalesce(p_due_date, due_date),
    status = case when coalesce(p_submit, false)
                  then 'submitted'::public.report_status else status end,
    submitted_at = case when coalesce(p_submit, false) then now() else submitted_at end,
    is_late = case
      when coalesce(p_submit, false) and due_date is not null and now()::date > due_date
      then true else is_late end,
    revision_note = case when coalesce(p_submit, false) then null else revision_note end,
    reviewed_at = case when coalesce(p_submit, false) then null else reviewed_at end,
    reviewed_by = case when coalesce(p_submit, false) then null else reviewed_by end,
    review_comment = case when coalesce(p_submit, false) then null else review_comment end
  where id = p_report_id;

  -- Thay danh sách đính kèm
  delete from public.report_attachments where report_id = p_report_id;
  for v_path in
    select value #>> '{}' from jsonb_array_elements(coalesce(p_attachment_paths, '[]'::jsonb))
  loop
    v_fname := v_path;
    if position('/' in reverse(v_path)) > 0 then
      v_fname := substr(v_path, length(v_path) - position('/' in reverse(v_path)) + 2);
    end if;
    insert into public.report_attachments (report_id, file_name, file_path, uploaded_by)
    values (p_report_id, v_fname, v_path, v_uid);
  end loop;

  -- Thay danh sách task liên kết
  delete from public.report_task_links where report_id = p_report_id;
  for v_task in
    select (value #>> '{}')::uuid from jsonb_array_elements(coalesce(p_task_ids, '[]'::jsonb))
  loop
    if exists (
      select 1 from public.tasks t
      where t.id = v_task and t.internship_id = v_rep.internship_id
    ) then
      insert into public.report_task_links (report_id, task_id)
      values (p_report_id, v_task)
      on conflict (report_id, task_id) do nothing;
    end if;
  end loop;

  insert into public.report_reviews (report_id, actor_id, action, previous_status, new_status, comment)
  values (p_report_id, v_uid, 'update', v_rep.status::text,
          case when coalesce(p_submit, false) then 'submitted' else v_rep.status::text end, null);

  if coalesce(p_submit, false) then
    select coalesce(max(version_number), 0) + 1 into v_version
    from public.report_versions where report_id = p_report_id;
    insert into public.report_versions (report_id, version_number, title, content, links, submitted_by)
    values (p_report_id, v_version, trim(p_title), coalesce(p_content, '{}'::jsonb),
            coalesce(p_links, '[]'::jsonb), v_uid);

    v_targets := public.report_notify_targets(v_rep.internship_id);
    perform public.notify_report(
      u, 'report_submitted',
      'Báo cáo cần xử lý: ' || v_rep.report_code,
      (select full_name from public.profiles where id = v_uid) || ' nộp lại báo cáo "' || p_title || '".',
      p_report_id, '/admin/reports/' || p_report_id
    )
    from unnest(v_targets) u
    where u <> v_uid;
  end if;

  return jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'status', case when coalesce(p_submit, false) then 'submitted' else v_rep.status::text end,
    'message', case when coalesce(p_submit, false)
                    then 'Đã nộp báo cáo thành công.'
                    else 'Đã lưu báo cáo nháp.' end
  );
end;
$$;

-- --------------------------------------------------------------------------
-- 13. submit_report — nộp lại báo cáo nháp / bị yêu cầu chỉnh sửa
-- --------------------------------------------------------------------------
create or replace function public.submit_report(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rep public.reports%rowtype;
  v_req text;
  v_val text;
  v_version int;
  v_targets uuid[];
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'code', 'AUTH_REQUIRED',
      'message', 'Vui lòng đăng nhập.');
  end if;

  select * into v_rep from public.reports where id = p_report_id for update;
  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND',
      'message', 'Không tìm thấy báo cáo.');
  end if;
  if v_rep.user_id <> v_uid then
    return jsonb_build_object('success', false, 'code', 'PERMISSION_DENIED',
      'message', 'Bạn chỉ được nộp báo cáo của mình.');
  end if;
  if v_rep.status not in ('draft', 'needs_revision') then
    return jsonb_build_object('success', false, 'code', 'INVALID_STATE',
      'message', 'Báo cáo không ở trạng thái có thể nộp.');
  end if;

  for v_req in select unnest(public.report_required_keys(v_rep.report_type)) loop
    v_val := nullif(trim(coalesce(v_rep.content ->> v_req, '')), '');
    if v_val is null then
      return jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
        'message', 'Bắt buộc điền nội dung: ' || v_req || '.');
    end if;
  end loop;

  update public.reports set
    status = 'submitted',
    submitted_at = now(),
    is_late = case when due_date is not null and now()::date > due_date
                   then true else is_late end,
    revision_note = null,
    reviewed_at = null,
    reviewed_by = null,
    review_comment = null
  where id = p_report_id;

  select coalesce(max(version_number), 0) + 1 into v_version
  from public.report_versions where report_id = p_report_id;
  insert into public.report_versions (report_id, version_number, title, content, links, submitted_by)
  values (p_report_id, v_version, v_rep.title, v_rep.content, v_rep.links, v_uid);

  insert into public.report_reviews (report_id, actor_id, action, previous_status, new_status, comment)
  values (p_report_id, v_uid, 'submit', v_rep.status::text, 'submitted', null);

  v_targets := public.report_notify_targets(v_rep.internship_id);
  perform public.notify_report(
    u, 'report_submitted',
    'Báo cáo cần xử lý: ' || v_rep.report_code,
    (select full_name from public.profiles where id = v_uid) || ' nộp báo cáo "' || v_rep.title || '".',
    p_report_id, '/admin/reports/' || p_report_id
  )
  from unnest(v_targets) u
  where u <> v_uid;

  return jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'status', 'submitted',
    'message', 'Đã nộp báo cáo thành công.'
  );
end;
$$;

-- --------------------------------------------------------------------------
-- 14. review_report — tiếp nhận / duyệt / từ chối / yêu cầu chỉnh sửa / hủy
-- --------------------------------------------------------------------------
create or replace function public.review_report(
  p_report_id uuid,
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
  v_rep public.reports%rowtype;
  v_prev text;
  v_new text;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'code', 'AUTH_REQUIRED',
      'message', 'Vui lòng đăng nhập.');
  end if;

  select public.get_my_role() into v_role;

  select * into v_rep from public.reports where id = p_report_id for update;
  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND',
      'message', 'Không tìm thấy báo cáo.');
  end if;

  v_prev := v_rep.status::text;

  -- ===================== Phân quyền theo hành động =====================
  if p_action in ('take', 'approve', 'reject', 'request_revision') then
    if v_uid = v_rep.user_id then
      return jsonb_build_object('success', false, 'code', 'SELF_REVIEW',
        'message', 'Bạn không được tự xét duyệt báo cáo của mình.');
    end if;
    if v_role not in ('mentor', 'hr', 'admin') then
      return jsonb_build_object('success', false, 'code', 'PERMISSION_DENIED',
        'message', 'Bạn không có quyền xét duyệt báo cáo.');
    end if;
    if v_role = 'mentor' and not public.is_mentor_of_internship(v_rep.internship_id) then
      return jsonb_build_object('success', false, 'code', 'PERMISSION_DENIED',
        'message', 'Báo cáo không thuộc thực tập sinh bạn phụ trách.');
    end if;
  elsif p_action = 'cancel' then
    if not (v_uid = v_rep.user_id or v_role in ('hr', 'admin')) then
      return jsonb_build_object('success', false, 'code', 'PERMISSION_DENIED',
        'message', 'Bạn không có quyền hủy báo cáo này.');
    end if;
  else
    return jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'message', 'Hành động không hợp lệ.');
  end if;

  -- ===================== Ràng buộc trạng thái =====================
  if p_action = 'take' then
    if v_rep.status <> 'submitted' then
      return jsonb_build_object('success', false, 'code', 'INVALID_STATE',
        'message', 'Báo cáo không ở trạng thái chờ xử lý.');
    end if;
    v_new := 'in_review';

  elsif p_action = 'approve' then
    if v_rep.status not in ('submitted', 'in_review') then
      return jsonb_build_object('success', false, 'code', 'INVALID_STATE',
        'message', 'Báo cáo chỉ được duyệt khi đang chờ hoặc đang xem xét.');
    end if;
    v_new := 'approved';

  elsif p_action = 'reject' then
    if v_rep.status not in ('submitted', 'in_review') then
      return jsonb_build_object('success', false, 'code', 'INVALID_STATE',
        'message', 'Báo cáo không ở trạng thái có thể từ chối.');
    end if;
    if p_comment is null or length(trim(p_comment)) < 5 then
      return jsonb_build_object('success', false, 'code', 'COMMENT_REQUIRED',
        'message', 'Bắt buộc nhập lý do từ chối (tối thiểu 5 ký tự).');
    end if;
    v_new := 'rejected';

  elsif p_action = 'request_revision' then
    if v_rep.status not in ('submitted', 'in_review') then
      return jsonb_build_object('success', false, 'code', 'INVALID_STATE',
        'message', 'Báo cáo không ở trạng thái có thể yêu cầu chỉnh sửa.');
    end if;
    if p_comment is null or length(trim(p_comment)) < 5 then
      return jsonb_build_object('success', false, 'code', 'COMMENT_REQUIRED',
        'message', 'Bắt buộc nhập nội dung cần chỉnh sửa.');
    end if;
    v_new := 'needs_revision';

  elsif p_action = 'cancel' then
    if v_rep.status in ('approved', 'rejected', 'cancelled') then
      return jsonb_build_object('success', false, 'code', 'INVALID_STATE',
        'message', 'Không thể hủy báo cáo đã được xử lý.');
    end if;
    v_new := 'cancelled';
  end if;

  -- ===================== Cập nhật =====================
  update public.reports set
    status = v_new::public.report_status,
    reviewed_by = case
      when p_action in ('take', 'approve', 'reject', 'request_revision') then v_uid
      when p_action = 'cancel' and v_uid <> v_rep.user_id then v_uid
      else reviewed_by
    end,
    reviewed_at = case
      when p_action in ('approve', 'reject', 'request_revision') then now()
      else reviewed_at
    end,
    review_comment = case
      when p_action in ('approve', 'take') then coalesce(p_comment, review_comment)
      else review_comment
    end,
    rejection_reason = case when p_action = 'reject' then trim(p_comment) else rejection_reason end,
    revision_note = case
      when p_action = 'request_revision' then trim(p_comment)
      when p_action in ('approve', 'reject') then null
      else revision_note
    end,
    cancelled_at = case when p_action = 'cancel' then now() else cancelled_at end
  where id = p_report_id;

  insert into public.report_reviews (report_id, actor_id, action, previous_status, new_status, comment)
  values (p_report_id, v_uid, p_action, v_prev, v_new, p_comment);

  -- ===================== Thông báo =====================
  if p_action = 'approve' then
    perform public.notify_report(v_rep.user_id, 'report_approved',
      'Báo cáo ' || v_rep.report_code || ' đã được phê duyệt',
      'Báo cáo "' || v_rep.title || '" của bạn đã được phê duyệt.', p_report_id,
      '/intern/reports/' || p_report_id);
  elsif p_action = 'reject' then
    perform public.notify_report(v_rep.user_id, 'report_rejected',
      'Báo cáo ' || v_rep.report_code || ' bị từ chối',
      'Lý do: ' || trim(p_comment), p_report_id,
      '/intern/reports/' || p_report_id);
  elsif p_action = 'request_revision' then
    perform public.notify_report(v_rep.user_id, 'report_revision',
      'Báo cáo ' || v_rep.report_code || ' cần chỉnh sửa',
      trim(p_comment), p_report_id,
      '/intern/reports/' || p_report_id);
  elsif p_action = 'cancel' and v_uid <> v_rep.user_id then
    perform public.notify_report(v_rep.user_id, 'report_rejected',
      'Báo cáo ' || v_rep.report_code || ' đã bị hủy',
      'Báo cáo "' || v_rep.title || '" đã bị quản lý hủy.', p_report_id,
      '/intern/reports/' || p_report_id);
  end if;

  return jsonb_build_object(
    'success', true,
    'previous_status', v_prev,
    'status', v_new,
    'message', case p_action
      when 'approve' then 'Đã phê duyệt báo cáo.'
      when 'reject' then 'Đã từ chối báo cáo.'
      when 'take' then 'Đã tiếp nhận báo cáo.'
      when 'request_revision' then 'Đã yêu cầu chỉnh sửa.'
      when 'cancel' then 'Đã hủy báo cáo.'
      else 'Đã cập nhật.'
    end
  );
end;
$$;

-- --------------------------------------------------------------------------
-- 15. get_report_stats — dashboard thống kê báo cáo
-- --------------------------------------------------------------------------
create or replace function public.get_report_stats()
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
         from public.reports
         where status <> 'cancelled'
           and (v_role <> 'mentor' or public.is_mentor_of_internship(internship_id))
         group by status
       ) s), '{}'::jsonb),
    'by_type', coalesce(
      (select jsonb_object_agg(report_type, cnt) from (
         select report_type::text as report_type, count(*) as cnt
         from public.reports
         where status <> 'cancelled'
           and (v_role <> 'mentor' or public.is_mentor_of_internship(internship_id))
         group by report_type
       ) t), '{}'::jsonb),
    'overdue', (
      select count(*) from public.reports
      where status in ('draft', 'submitted', 'in_review', 'needs_revision')
        and due_date is not null and due_date < now()::date
        and (v_role <> 'mentor' or public.is_mentor_of_internship(internship_id))
    ),
    'late_submitted', (
      select count(*) from public.reports
      where is_late
        and (v_role <> 'mentor' or public.is_mentor_of_internship(internship_id))
    ),
    'on_time_rate', (
      select case when count(*) = 0 then null
             else round(100.0 * sum(case when not is_late then 1 else 0 end)
                        / count(*), 1)
             end
      from public.reports
      where submitted_at is not null and status <> 'cancelled'
        and (v_role <> 'mentor' or public.is_mentor_of_internship(internship_id))
    ),
    'approval_rate', (
      select case when count(*) = 0 then null
             else round(100.0 * sum(case when status = 'approved' then 1 else 0 end)
                        / count(*), 1)
             end
      from public.reports
      where status in ('approved', 'rejected')
        and (v_role <> 'mentor' or public.is_mentor_of_internship(internship_id))
    ),
    'avg_review_hours', (
      select round(avg(extract(epoch from (reviewed_at - submitted_at)) / 3600)::numeric, 1)
      from public.reports
      where reviewed_at is not null and submitted_at is not null
        and (v_role <> 'mentor' or public.is_mentor_of_internship(internship_id))
    )
  )
  into v_result
  from public.reports
  where (v_role <> 'mentor' or public.is_mentor_of_internship(internship_id));

  return v_result;
end;
$$;

revoke all on function public.get_report_stats() from PUBLIC, anon;
grant execute on function public.get_report_stats() to authenticated;

-- --------------------------------------------------------------------------
-- 16. Migrate dữ liệu báo cáo cũ → reports (idempotent theo legacy_id)
-- --------------------------------------------------------------------------
create unique index if not exists idx_reports_legacy_id
  on public.reports ((payload->>'legacy_id'));

insert into public.reports (
  internship_id, intern_id, user_id, mentor_id, report_type, title,
  period_start, period_end, content, status, submitted_at, reviewed_by,
  reviewed_at, review_comment, due_date, is_late, payload,
  created_at, updated_at
)
select
  d.internship_id,
  d.intern_id,
  i.user_id,
  ip.mentor_id,
  'daily',
  'Báo cáo ngày ' || to_char(d.report_date, 'DD/MM/YYYY'),
  d.report_date,
  d.report_date,
  jsonb_strip_nulls(jsonb_build_object(
    'work_done', d.tasks_done,
    'results', d.results,
    'difficulties', d.difficulties,
    'next_plan', d.next_plan,
    'note', null
  )),
  d.status,
  d.submitted_at,
  d.reviewed_by,
  d.reviewed_at,
  d.feedback,
  null,
  false,
  jsonb_build_object('legacy_table', 'daily_reports', 'legacy_id', d.id, 'legacy_score', d.score),
  d.created_at,
  d.updated_at
from public.daily_reports d
join public.interns i on i.id = d.intern_id and i.user_id is not null
left join public.internships ip on ip.id = d.internship_id
on conflict ((payload->>'legacy_id')) do nothing;

insert into public.reports (
  internship_id, intern_id, user_id, mentor_id, report_type, title,
  period_start, period_end, content, status, submitted_at, reviewed_by,
  reviewed_at, review_comment, due_date, is_late, payload,
  created_at, updated_at
)
select
  w.internship_id,
  w.intern_id,
  i.user_id,
  ip.mentor_id,
  'weekly',
  'Báo cáo tuần ' || to_char(w.week_start, 'DD/MM') || ' – ' || to_char(w.week_end, 'DD/MM/YYYY'),
  w.week_start,
  w.week_end,
  jsonb_strip_nulls(jsonb_build_object(
    'completed_tasks', w.work_summary,
    'results', w.results,
    'skills_learned', w.skills_learned,
    'difficulties', w.difficulties,
    'next_plan', w.next_week_plan
  )),
  w.status,
  w.submitted_at,
  w.reviewed_by,
  w.reviewed_at,
  w.feedback,
  null,
  false,
  jsonb_build_object('legacy_table', 'weekly_reports', 'legacy_id', w.id, 'legacy_score', w.score),
  w.created_at,
  w.updated_at
from public.weekly_reports w
join public.interns i on i.id = w.intern_id and i.user_id is not null
left join public.internships ip on ip.id = w.internship_id
on conflict ((payload->>'legacy_id')) do nothing;
