do $$
begin
  create type public.onboarding_record_status as enum ('not_started', 'in_progress', 'pending_review', 'needs_revision', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.onboarding_checklist_status as enum ('not_started', 'in_progress', 'pending_review', 'needs_revision', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.onboarding_document_status as enum ('not_submitted', 'pending_review', 'approved', 'needs_revision');
exception
  when duplicate_object then null;
end
$$;

alter table public.interns
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists emergency_contact_email text;

create table if not exists public.onboarding_document_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  description text,
  is_required_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents
  add column if not exists document_type text references public.onboarding_document_types(code) on update cascade on delete set null,
  add column if not exists file_name text,
  add column if not exists version integer not null default 1,
  add column if not exists is_required_default boolean not null default false,
  add column if not exists is_guidance boolean not null default false;

alter table public.documents drop constraint if exists documents_version_check;
alter table public.documents add constraint documents_version_check check (version > 0);

alter table public.documents drop constraint if exists documents_target;
update public.documents set bucket = 'onboarding' where bucket <> 'onboarding';
update public.documents
set file_url = regexp_replace(file_url, '^http://', 'https://', 'i')
where file_url ~* '^http://';
update public.documents set file_size = null where file_size < 0;
update public.documents
set file_path = null
where file_path is not null
  and (file_path ~* '^https?://' or file_path ~ '(^|/)\.\.(/|$)');
alter table public.documents drop constraint if exists documents_bucket_check;
alter table public.documents drop constraint if exists documents_file_size_check;
alter table public.documents drop constraint if exists documents_file_path_check;
alter table public.documents drop constraint if exists documents_file_url_check;
alter table public.documents add constraint documents_bucket_check check (bucket = 'onboarding');
alter table public.documents add constraint documents_file_size_check check (file_size is null or file_size >= 0);
alter table public.documents add constraint documents_file_path_check check (file_path is null or (file_path !~ '(^|/)\.\.(/|$)' and file_path !~* '^https?://'));
alter table public.documents add constraint documents_file_url_check check (file_url is null or file_url ~* '^https://');

create table if not exists public.onboarding_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists onboarding_checklist_templates_one_default_idx
  on public.onboarding_checklist_templates (is_default)
  where is_default = true;

create table if not exists public.onboarding_checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.onboarding_checklist_templates(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'Khác',
  is_required boolean not null default true,
  sort_order integer not null default 0,
  due_offset_days integer,
  default_assignee_role public.user_role,
  guide_document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_template_item_order_check check (sort_order >= 0),
  constraint onboarding_template_item_offset_check check (due_offset_days is null or due_offset_days between -365 and 365)
);

create sequence if not exists public.onboarding_record_code_seq;

create table if not exists public.onboarding_records (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  internship_id uuid not null unique references public.internships(id) on delete cascade,
  batch_id uuid not null references public.internship_batches(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  mentor_id uuid references public.mentors(id) on delete set null,
  assigned_hr_id uuid references public.profiles(id) on delete set null,
  start_date date,
  end_date date,
  onboarding_start_date date not null,
  due_date date not null,
  status public.onboarding_record_status not null default 'not_started',
  progress_percent integer not null default 0,
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_record_dates_check check (end_date is null or start_date is null or end_date >= start_date),
  constraint onboarding_record_due_check check (due_date >= onboarding_start_date),
  constraint onboarding_record_progress_check check (progress_percent between 0 and 100),
  constraint onboarding_record_code_check check (length(trim(code)) >= 6)
);

do $$
begin
  if to_regclass('public.onboarding_checklists') is not null and to_regclass('public.onboarding_checklist_items') is null then
    alter table public.onboarding_checklists rename to onboarding_checklist_items;
  end if;
end
$$;

alter table public.onboarding_checklist_items
  add column if not exists onboarding_id uuid references public.onboarding_records(id) on delete cascade,
  add column if not exists legacy_intern_id uuid references public.interns(id) on delete set null,
  add column if not exists template_item_id uuid references public.onboarding_checklist_template_items(id) on delete set null,
  add column if not exists category text not null default 'Khác',
  add column if not exists guide_document_id uuid references public.documents(id) on delete set null,
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists performer_id uuid references public.profiles(id) on delete set null,
  add column if not exists start_date date,
  add column if not exists is_required boolean not null default true,
  add column if not exists review_required boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists started_at timestamptz,
  add column if not exists completed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists feedback text;

update public.onboarding_checklist_items
set legacy_intern_id = intern_id
where legacy_intern_id is null;

alter table public.onboarding_checklist_items alter column status drop default;
alter table public.onboarding_checklist_items
  alter column status type public.onboarding_checklist_status
  using status::text::public.onboarding_checklist_status;
alter table public.onboarding_checklist_items alter column status set default 'not_started';

alter table public.onboarding_checklist_items drop constraint if exists onboarding_checklist_item_link_check;
alter table public.onboarding_checklist_items add constraint onboarding_checklist_item_link_check check (onboarding_id is not null or legacy_intern_id is not null);
alter table public.onboarding_checklist_items drop constraint if exists onboarding_checklist_item_order_check;
alter table public.onboarding_checklist_items add constraint onboarding_checklist_item_order_check check (sort_order >= 0);

with legacy_interns as (
  select distinct legacy_intern_id
  from public.onboarding_checklist_items
  where legacy_intern_id is not null
), chosen as (
  select li.legacy_intern_id, chosen_internship.id
  from legacy_interns li
  cross join lateral (
    select ip.id
    from public.internships ip
    where ip.intern_id = li.legacy_intern_id
      and ip.deleted_at is null
    order by
      case ip.status when 'active' then 0 when 'upcoming' then 1 when 'completed' then 2 else 3 end,
      coalesce(ip.start_date, date '9999-12-31'),
      ip.created_at desc
    limit 1
  ) chosen_internship
),
legacy_owner as (
  select distinct on (i.legacy_intern_id)
    i.legacy_intern_id,
    i.created_by as owner_id
  from public.onboarding_checklist_items i
  where i.legacy_intern_id is not null
    and i.created_by is not null
  order by i.legacy_intern_id, i.updated_at desc nulls last, i.created_at desc
)
insert into public.onboarding_records (
  code,
  internship_id,
  batch_id,
  department_id,
  mentor_id,
  start_date,
  end_date,
  onboarding_start_date,
  due_date,
  status,
  notes,
  assigned_hr_id,
  created_by,
  created_at,
  updated_at
)
select
  'ONB-LEGACY-' || upper(left(replace(c.id::text, '-', ''), 12)),
  c.id,
  ip.batch_id,
  ip.department_id,
  ip.mentor_id,
  ip.start_date,
  ip.end_date,
  coalesce(ip.start_date, current_date),
  coalesce(ip.start_date, current_date) + 14,
  case
    when bool_and(i.status = 'completed') then 'pending_review'::public.onboarding_record_status
    when bool_or(i.status <> 'not_started') then 'in_progress'::public.onboarding_record_status
    else 'not_started'::public.onboarding_record_status
  end,
  'Chuyển từ checklist onboarding cũ.',
  case when lo_role.id is not null then lo.owner_id end,
  case when lo_role.id is not null then lo.owner_id end,
  min(i.created_at),
  max(i.updated_at)
from chosen c
join public.internships ip on ip.id = c.id
join public.onboarding_checklist_items i on i.legacy_intern_id = c.legacy_intern_id
left join legacy_owner lo on lo.legacy_intern_id = c.legacy_intern_id
left join public.profiles lo_profile on lo_profile.id = lo.owner_id and lo_profile.is_active
left join public.roles lo_role
  on lo_role.id = lo_profile.role_id
  and lo_role.code in ('hr', 'admin')
group by c.legacy_intern_id, c.id, ip.batch_id, ip.department_id, ip.mentor_id, ip.start_date, ip.end_date,
         lo.owner_id, lo_role.id
on conflict (internship_id) do nothing;

update public.onboarding_checklist_items i
set onboarding_id = (
  select ip.id
  from public.internships ip
  where ip.intern_id = i.legacy_intern_id
    and ip.deleted_at is null
  order by
    case ip.status when 'active' then 0 when 'upcoming' then 1 when 'completed' then 2 else 3 end,
    coalesce(ip.start_date, date '9999-12-31'),
    ip.created_at desc
  limit 1
)
where i.onboarding_id is null
  and i.legacy_intern_id is not null;

update public.onboarding_checklist_items i
set assigned_to = (
      select owner.user_id
      from public.interns owner
      where owner.id = i.legacy_intern_id
    ),
    performer_id = (
      select owner.user_id
      from public.interns owner
      where owner.id = i.legacy_intern_id
    )
where i.onboarding_id is not null
  and i.assigned_to is null
  and exists (
    select 1
    from public.interns owner
    where owner.id = i.legacy_intern_id
      and owner.user_id is not null
  );

update public.onboarding_records r
set progress_percent = coalesce((
  select floor(
    100.0 * count(*) filter (where i.status = 'completed') / nullif(count(*) filter (where i.is_required), 0)
  )::integer
  from public.onboarding_checklist_items i
  where i.onboarding_id = r.id and i.is_required
), 0)
where r.code like 'ONB-LEGACY-%';

create table if not exists public.onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.onboarding_records(id) on delete cascade,
  catalog_document_id uuid references public.documents(id) on delete set null,
  document_name text not null,
  document_type text references public.onboarding_document_types(code) on update cascade on delete set null,
  description text,
  is_required boolean not null default true,
  visible_to_mentor boolean not null default false,
  due_date date,
  status public.onboarding_document_status not null default 'not_submitted',
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  feedback text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists onboarding_documents_catalog_unique_idx
  on public.onboarding_documents (onboarding_id, catalog_document_id)
  where catalog_document_id is not null;

create table if not exists public.onboarding_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.onboarding_documents(id) on delete cascade,
  file_path text not null unique,
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  version_number integer not null,
  constraint onboarding_document_version_size_check check (file_size > 0 and file_size <= 10485760),
  constraint onboarding_document_version_number_check check (version_number > 0),
  constraint onboarding_document_version_name_check check (nullif(trim(file_name), '') is not null),
  constraint onboarding_document_version_mime_check check (mime_type in (
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  constraint onboarding_document_version_path_check check (file_path ~ '^records/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/documents/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$')
);

alter table public.onboarding_documents
  add column if not exists current_version_id uuid,
  add column if not exists reviewed_version_id uuid;

alter table public.onboarding_documents
  drop constraint if exists onboarding_documents_current_version_fkey,
  drop constraint if exists onboarding_documents_reviewed_version_fkey;

alter table public.onboarding_documents
  add constraint onboarding_documents_current_version_fkey
    foreign key (current_version_id) references public.onboarding_document_versions(id) on delete set null,
  add constraint onboarding_documents_reviewed_version_fkey
    foreign key (reviewed_version_id) references public.onboarding_document_versions(id) on delete set null;

create unique index if not exists onboarding_document_versions_number_unique_idx
  on public.onboarding_document_versions (document_id, version_number);

create table if not exists public.onboarding_activity_logs (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.onboarding_records(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists onboarding_records_internship_idx on public.onboarding_records (internship_id);
create index if not exists onboarding_records_status_due_idx on public.onboarding_records (status, due_date);
create index if not exists onboarding_records_batch_idx on public.onboarding_records (batch_id, status);
create index if not exists onboarding_records_department_idx on public.onboarding_records (department_id, status);
create index if not exists onboarding_records_mentor_idx on public.onboarding_records (mentor_id, status);
create index if not exists onboarding_records_assigned_hr_idx on public.onboarding_records (assigned_hr_id, status);
create index if not exists onboarding_checklist_template_items_template_idx on public.onboarding_checklist_template_items (template_id, sort_order);
create index if not exists onboarding_checklist_items_record_idx on public.onboarding_checklist_items (onboarding_id, sort_order);
create index if not exists onboarding_checklist_items_status_due_idx on public.onboarding_checklist_items (status, due_date);
create index if not exists onboarding_checklist_items_assignee_idx on public.onboarding_checklist_items (assigned_to, status);
create index if not exists onboarding_documents_record_idx on public.onboarding_documents (onboarding_id, status);
create index if not exists onboarding_documents_due_idx on public.onboarding_documents (onboarding_id, due_date);
create index if not exists onboarding_document_versions_document_idx on public.onboarding_document_versions (document_id, version_number desc);
create index if not exists onboarding_activity_logs_record_idx on public.onboarding_activity_logs (onboarding_id, created_at desc);
create index if not exists documents_active_scope_idx on public.documents (is_active, batch_id, department_id);

insert into public.onboarding_document_types (code, name, description, is_required_default)
values
  ('cv', 'CV / Hồ sơ', 'CV hoặc hồ sơ theo yêu cầu của đơn vị.', false),
  ('internship_letter', 'Giấy giới thiệu thực tập', 'Giấy giới thiệu nếu đơn vị yêu cầu.', false),
  ('personal_form', 'Biểu mẫu thông tin cá nhân', 'Biểu mẫu do đơn vị cung cấp.', true),
  ('identity', 'Giấy tờ tùy thân', 'Giấy tờ hoặc tài liệu định danh theo yêu cầu.', true),
  ('confidentiality', 'Cam kết bảo mật', 'Cam kết bảo mật và sở hữu trí tuệ nếu được yêu cầu.', true),
  ('policy', 'Tài liệu hướng dẫn và nội quy', 'Nội quy, hướng dẫn làm việc và chính sách liên quan.', true),
  ('other', 'Tài liệu khác', 'Tài liệu do HR cấu hình theo từng hồ sơ.', false)
on conflict (code) do nothing;

insert into public.onboarding_checklist_templates (id, code, name, description, is_default, is_active)
values (
  '00000000-0000-4000-8000-000000000012',
  'STANDARD_V1',
  'Quy trình tiếp nhận thực tập sinh tiêu chuẩn',
  ' checklist mặc định gồm hồ sơ cá nhân, thủ tục, tiếp nhận công việc và chuẩn bị ngày đầu tiên.',
  true,
  true
)
on conflict (code) do nothing;

insert into public.documents (
  id,
  title,
  description,
  bucket,
  document_type,
  is_required_default,
  is_guidance,
  is_active
)
values
  ('20000000-0000-4000-8000-000000000001', 'Sổ tay thực tập sinh', 'Hướng dẫn quy trình và thông tin liên hệ cần thiết.', 'onboarding', 'policy', true, true, true),
  ('20000000-0000-4000-8000-000000000002', 'Biểu mẫu thông tin cá nhân', 'HR thay file mẫu được duyệt trước khi yêu cầu nộp.', 'onboarding', 'personal_form', true, false, true),
  ('20000000-0000-4000-8000-000000000003', 'Cam kết bảo mật', 'HR thay file mẫu được duyệt trước khi yêu cầu nộp.', 'onboarding', 'confidentiality', true, false, true),
  ('20000000-0000-4000-8000-000000000004', 'Nội quy và chính sách làm việc', 'HR thay file nội quy được phê duyệt.', 'onboarding', 'policy', true, true, true),
  ('20000000-0000-4000-8000-000000000005', 'Hướng dẫn sử dụng IMS', 'Tài liệu hướng dẫn thực tập sinh sử dụng hệ thống.', 'onboarding', 'policy', true, true, true),
  ('20000000-0000-4000-8000-000000000006', 'Mẫu CV', 'Tài liệu tham khảo; không mặc định bắt buộc.', 'onboarding', 'cv', false, true, true)
on conflict (id) do nothing;

insert into public.onboarding_checklist_template_items (
  id,
  template_id,
  title,
  description,
  category,
  is_required,
  sort_order,
  due_offset_days,
  default_assignee_role,
  guide_document_id
)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'Xác nhận thông tin cá nhân', 'Kiểm tra họ tên, ngày sinh và thông tin liên hệ chính xác.', 'A. Hồ sơ cá nhân', true, 10, -7, 'intern', null),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000012', 'Cập nhật email và số điện thoại', 'Cập nhật các kênh liên hệ được phép chỉnh sửa.', 'A. Hồ sơ cá nhân', true, 20, -7, 'intern', null),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000012', 'Cung cấp thông tin liên hệ khẩn cấp', 'Nhập tên, số điện thoại và email của người liên hệ khẩn cấp.', 'A. Hồ sơ cá nhân', true, 30, -5, 'intern', null),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000012', 'Nộp CV hoặc hồ sơ theo yêu cầu', 'Tùy yêu cầu của đơn vị, không mặc định bắt buộc.', 'A. Hồ sơ cá nhân', false, 40, -3, 'intern', '20000000-0000-4000-8000-000000000006'),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000012', 'Nộp giấy giới thiệu thực tập nếu có', 'Chỉ thực hiện khi HR yêu cầu.', 'B. Hồ sơ và thủ tục', false, 50, -5, 'intern', null),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000012', 'Nộp giấy tờ hoặc biểu mẫu theo yêu cầu', 'Nộp đúng loại tài liệu HR yêu cầu.', 'B. Hồ sơ và thủ tục', true, 60, -5, 'intern', '20000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000012', 'Xác nhận các quy định và chính sách liên quan', 'Đọc và xác nhận nội quy, chính sách của đơn vị.', 'B. Hồ sơ và thủ tục', true, 70, -3, 'intern', '20000000-0000-4000-8000-000000000004'),
  ('10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000012', 'Hoàn thành biểu mẫu cam kết bảo mật nếu được yêu cầu', 'HR chỉ giao mục này khi đơn vị yêu cầu.', 'B. Hồ sơ và thủ tục', true, 80, -3, 'intern', '20000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000012', 'Gán phòng ban và mentor', 'HR xác nhận phòng ban và mentor phụ trách.', 'C. Tiếp nhận công việc', true, 90, -3, 'hr', null),
  ('10000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000012', 'Giới thiệu quy trình làm việc', 'HR hoặc mentor giới thiệu quy trình và cách phối hợp.', 'C. Tiếp nhận công việc', true, 100, -2, 'hr', null),
  ('10000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000012', 'Cấp quyền truy cập các hệ thống cần thiết', 'Xác nhận các tài khoản và quyền cần thiết đã được cấp.', 'C. Tiếp nhận công việc', true, 110, -1, 'hr', null),
  ('10000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000012', 'Hướng dẫn sử dụng IMS', 'Thực tập sinh hoàn thành hướng dẫn sử dụng hệ thống.', 'C. Tiếp nhận công việc', true, 120, -1, 'intern', '20000000-0000-4000-8000-000000000005'),
  ('10000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000012', 'Xác nhận mục tiêu và kế hoạch thực tập', 'Xác nhận mục tiêu, kế hoạch và kết quả kỳ vọng.', 'C. Tiếp nhận công việc', true, 130, 0, 'intern', null),
  ('10000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000012', 'Xác nhận ngày bắt đầu', 'Xác nhận ngày bắt đầu và thời gian làm việc.', 'D. Chuẩn bị ngày đầu tiên', true, 140, -1, 'intern', null),
  ('10000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000012', 'Cung cấp địa điểm làm việc', 'Xác nhận địa điểm và hướng dẫn đến nơi làm việc.', 'D. Chuẩn bị ngày đầu tiên', false, 150, -1, 'hr', null),
  ('10000000-0000-4000-8000-000000000016', '00000000-0000-4000-8000-000000000012', 'Hướng dẫn giờ làm việc và quy định chấm công', 'Xác nhận giờ làm, điểm danh và quy định liên quan.', 'D. Chuẩn bị ngày đầu tiên', true, 160, -1, 'hr', null),
  ('10000000-0000-4000-8000-000000000017', '00000000-0000-4000-8000-000000000012', 'Xác nhận đã nhận các thông tin cần thiết', 'Xác nhận đã nhận đầy đủ thông tin trước ngày bắt đầu.', 'D. Chuẩn bị ngày đầu tiên', true, 170, 0, 'intern', null)
on conflict (id) do nothing;

create or replace function public.can_manage_onboarding(p_onboarding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.onboarding_records r
    where r.id = p_onboarding_id
      and public.get_my_role() in ('hr', 'admin')
      and (
        public.get_my_role() = 'admin'
        or r.assigned_hr_id is null
        or r.assigned_hr_id = auth.uid()
      )
  );
$$;

create or replace function public.can_read_onboarding(p_onboarding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.onboarding_records r
    where r.id = p_onboarding_id
      and (
        public.can_manage_onboarding(r.id)
        or exists (
          select 1
          from public.internships ip
          join public.interns i on i.id = ip.intern_id
          where ip.id = r.internship_id
            and ip.deleted_at is null
            and i.deleted_at is null
            and i.user_id = auth.uid()
        )
        or (
          public.get_my_role() = 'mentor'
          and exists (
            select 1
            from public.internships ip
            join public.mentors m on m.id = ip.mentor_id
            where ip.id = r.internship_id
              and ip.deleted_at is null
              and m.deleted_at is null
              and m.is_active = true
              and m.user_id = auth.uid()
          )
        )
      )
  );
$$;

create or replace function public.can_review_onboarding_item(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.onboarding_checklist_items i
    where i.id = p_item_id
      and i.onboarding_id is not null
      and (
        public.can_manage_onboarding(i.onboarding_id)
        or (
          public.get_my_role() = 'mentor'
          and i.assigned_to = auth.uid()
          and public.can_read_onboarding(i.onboarding_id)
        )
      )
  );
$$;

create or replace function public.can_read_onboarding_document(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.onboarding_documents d
    where d.id = p_document_id
      and (
        public.can_manage_onboarding(d.onboarding_id)
        or (
          public.get_my_role() = 'intern'
          and exists (
            select 1
            from public.onboarding_records r
            join public.internships ip on ip.id = r.internship_id
            join public.interns i on i.id = ip.intern_id
            where r.id = d.onboarding_id
              and ip.deleted_at is null
              and i.deleted_at is null
              and i.user_id = auth.uid()
          )
        )
        or (
          d.visible_to_mentor = true
          and exists (
            select 1
            from public.onboarding_records r
            where r.id = d.onboarding_id
              and public.is_mentor_of_internship(r.internship_id)
          )
        )
      )
  );
$$;

create or replace function public.can_submit_onboarding_document(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.onboarding_documents d
    join public.onboarding_records r on r.id = d.onboarding_id
    join public.internships ip on ip.id = r.internship_id
    join public.interns i on i.id = ip.intern_id
    where d.id = p_document_id
      and i.user_id = auth.uid()
      and i.deleted_at is null
      and ip.deleted_at is null
      and public.get_my_role() = 'intern'
      and d.status <> 'approved'
      and r.status not in ('completed', 'cancelled')
  );
$$;

create or replace function public.can_read_document_catalog(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_my_role() in ('hr', 'admin')
    or exists (
      select 1
      from public.onboarding_documents d
      where d.catalog_document_id = p_document_id
        and public.can_read_onboarding(d.onboarding_id)
    )
    or exists (
      select 1
      from public.onboarding_checklist_items i
      where i.guide_document_id = p_document_id
        and i.onboarding_id is not null
        and public.can_read_onboarding(i.onboarding_id)
    );
$$;

create or replace function public.can_read_onboarding_storage_path(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with parts as (
    select string_to_array(p_object_name, '/') as value
  )
  select
    public.get_my_role() = 'admin'
    or (
      array_length(value, 1) = 2
      and value[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and public.can_read_document_catalog(value[1]::uuid)
    )
    or (
      array_length(value, 1) = 5
      and value[1] = 'records'
      and value[3] = 'documents'
      and value[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and value[4] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and public.can_read_onboarding(value[2]::uuid)
      and public.can_read_onboarding_document(value[4]::uuid)
      and exists (
        select 1
        from public.onboarding_documents d
        where d.id = value[4]::uuid
          and d.onboarding_id = value[2]::uuid
      )
    );
$$;

create or replace function public.can_write_onboarding_storage_path(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with parts as (
    select string_to_array(p_object_name, '/') as value
  )
  select
    public.get_my_role() = 'admin'
    or (
      public.get_my_role() = 'hr'
      and array_length(value, 1) = 2
      and value[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
    or (
      array_length(value, 1) = 5
      and value[1] = 'records'
      and value[3] = 'documents'
      and value[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and value[4] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (
        public.can_submit_onboarding_document(value[4]::uuid)
        or public.can_manage_onboarding(value[2]::uuid)
      )
      and exists (
        select 1
        from public.onboarding_documents d
        where d.id = value[4]::uuid
          and d.onboarding_id = value[2]::uuid
      )
    );
$$;

revoke all on function public.can_manage_onboarding(uuid) from public, anon;
revoke all on function public.can_read_onboarding(uuid) from public, anon;
revoke all on function public.can_review_onboarding_item(uuid) from public, anon;
revoke all on function public.can_read_onboarding_document(uuid) from public, anon;
revoke all on function public.can_submit_onboarding_document(uuid) from public, anon;
revoke all on function public.can_read_document_catalog(uuid) from public, anon;
revoke all on function public.can_read_onboarding_storage_path(text) from public, anon;
revoke all on function public.can_write_onboarding_storage_path(text) from public, anon;
grant execute on function public.can_manage_onboarding(uuid) to authenticated;
grant execute on function public.can_read_onboarding(uuid) to authenticated;
grant execute on function public.can_review_onboarding_item(uuid) to authenticated;
grant execute on function public.can_read_onboarding_document(uuid) to authenticated;
grant execute on function public.can_submit_onboarding_document(uuid) to authenticated;
grant execute on function public.can_read_document_catalog(uuid) to authenticated;
grant execute on function public.can_read_onboarding_storage_path(text) to authenticated;
grant execute on function public.can_write_onboarding_storage_path(text) to authenticated;

alter table public.onboarding_document_types enable row level security;
alter table public.onboarding_checklist_templates enable row level security;
alter table public.onboarding_checklist_template_items enable row level security;
alter table public.onboarding_records enable row level security;
alter table public.onboarding_checklist_items enable row level security;
alter table public.onboarding_documents enable row level security;
alter table public.onboarding_document_versions enable row level security;
alter table public.onboarding_activity_logs enable row level security;

drop policy if exists onboarding_document_types_select on public.onboarding_document_types;
create policy onboarding_document_types_select on public.onboarding_document_types
  for select to authenticated using (is_active or public.get_my_role() in ('hr', 'admin'));
drop policy if exists onboarding_document_types_write on public.onboarding_document_types
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists onboarding_templates_select on public.onboarding_checklist_templates;
create policy onboarding_templates_select on public.onboarding_checklist_templates
  for select to authenticated using (is_active or public.get_my_role() in ('hr', 'admin'));
drop policy if exists onboarding_templates_write on public.onboarding_checklist_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists onboarding_template_items_select on public.onboarding_checklist_template_items;
create policy onboarding_template_items_select on public.onboarding_checklist_template_items
  for select to authenticated using (
    public.get_my_role() = 'admin'
    or exists (
      select 1 from public.onboarding_checklist_templates t
      where t.id = template_id and t.is_active
    )
  );
drop policy if exists onboarding_template_items_write on public.onboarding_checklist_template_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists onboarding_records_select on public.onboarding_records;
create policy onboarding_records_select on public.onboarding_records
  for select to authenticated using (public.can_read_onboarding(id));
drop policy if exists onboarding_records_insert on public.onboarding_records;
create policy onboarding_records_insert on public.onboarding_records
  for insert to authenticated
  with check (
    public.get_my_role() in ('hr', 'admin')
    and (public.get_my_role() = 'admin' or assigned_hr_id is null or assigned_hr_id = auth.uid())
  );
drop policy if exists onboarding_records_update on public.onboarding_records;
create policy onboarding_records_update on public.onboarding_records
  for update to authenticated
  using (public.can_manage_onboarding(id))
  with check (
    public.get_my_role() in ('hr', 'admin')
    and (public.get_my_role() = 'admin' or assigned_hr_id is null or assigned_hr_id = auth.uid())
  );

drop policy if exists checklists_select_self on public.onboarding_checklist_items;
drop policy if exists checklists_select_mentor on public.onboarding_checklist_items;
drop policy if exists checklists_select_hr_admin on public.onboarding_checklist_items;
drop policy if exists checklists_insert_hr_admin on public.onboarding_checklist_items;
drop policy if exists checklists_update_self on public.onboarding_checklist_items;
drop policy if exists checklists_update_hr_admin on public.onboarding_checklist_items;
drop policy if exists checklists_delete_hr_admin on public.onboarding_checklist_items;
drop index if exists public.idx_checklists_intern;
alter table public.onboarding_checklist_items drop column if exists intern_id;
create policy onboarding_checklist_items_select on public.onboarding_checklist_items
  for select to authenticated using (
    (onboarding_id is not null and public.can_read_onboarding(onboarding_id))
    or (onboarding_id is null and public.get_my_role() in ('hr', 'admin'))
  );
create policy onboarding_checklist_items_insert on public.onboarding_checklist_items
  for insert to authenticated with check (onboarding_id is not null and public.can_manage_onboarding(onboarding_id));
create policy onboarding_checklist_items_update on public.onboarding_checklist_items
  for update to authenticated using (onboarding_id is not null and public.can_manage_onboarding(onboarding_id))
  with check (onboarding_id is not null and public.can_manage_onboarding(onboarding_id));
create policy onboarding_checklist_items_delete on public.onboarding_checklist_items
  for delete to authenticated using (onboarding_id is not null and public.can_manage_onboarding(onboarding_id));

drop policy if exists documents_select_authenticated on public.documents;
drop policy if exists documents_write_hr_admin on public.documents;
create policy documents_select_scoped on public.documents
  for select to authenticated using (public.can_read_document_catalog(id));
create policy documents_write_hr_admin on public.documents
  for all to authenticated using (public.get_my_role() in ('hr', 'admin')) with check (public.get_my_role() in ('hr', 'admin'));

drop policy if exists onboarding_documents_select on public.onboarding_documents;
create policy onboarding_documents_select on public.onboarding_documents
  for select to authenticated using (public.can_read_onboarding_document(id));
drop policy if exists onboarding_documents_insert on public.onboarding_documents;
create policy onboarding_documents_insert on public.onboarding_documents
  for insert to authenticated with check (public.can_manage_onboarding(onboarding_id));
drop policy if exists onboarding_documents_update_hr on public.onboarding_documents;
drop policy if exists onboarding_documents_delete_hr on public.onboarding_documents;

drop policy if exists onboarding_document_versions_select on public.onboarding_document_versions;
create policy onboarding_document_versions_select on public.onboarding_document_versions
  for select to authenticated using (public.can_read_onboarding_document(document_id));
drop policy if exists onboarding_document_versions_insert_hr on public.onboarding_document_versions;
drop policy if exists onboarding_document_versions_delete_hr on public.onboarding_document_versions;

drop policy if exists onboarding_activity_logs_select on public.onboarding_activity_logs;
create policy onboarding_activity_logs_select on public.onboarding_activity_logs
  for select to authenticated using (
    public.can_manage_onboarding(onboarding_id)
    or exists (
      select 1
      from public.onboarding_records r
      join public.internships ip on ip.id = r.internship_id
      join public.interns i on i.id = ip.intern_id
      where r.id = onboarding_activity_logs.onboarding_id
        and ip.deleted_at is null
        and i.deleted_at is null
        and i.user_id = auth.uid()
    )
  );

grant select on public.onboarding_document_types to authenticated;
grant select, insert, update, delete on public.onboarding_checklist_templates to authenticated;
grant select, insert, update, delete on public.onboarding_checklist_template_items to authenticated;
grant select, insert, update on public.onboarding_records to authenticated;
grant select, insert, update, delete on public.onboarding_checklist_items to authenticated;
grant select, insert on public.onboarding_documents to authenticated;
grant select on public.onboarding_document_versions to authenticated;
grant select on public.onboarding_activity_logs to authenticated;

drop policy if exists "onboarding_read" on storage.objects;
drop policy if exists "onboarding_insert_hr_admin" on storage.objects;
drop policy if exists "onboarding_update_hr_admin" on storage.objects;
drop policy if exists "onboarding_update_scoped" on storage.objects;
drop policy if exists "onboarding_delete_hr_admin" on storage.objects;
create policy "onboarding_read_scoped" on storage.objects
  for select to authenticated
  using (bucket_id = 'onboarding' and public.can_read_onboarding_storage_path(name));
create policy "onboarding_insert_scoped" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'onboarding' and public.can_write_onboarding_storage_path(name));

update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
where id = 'onboarding';
