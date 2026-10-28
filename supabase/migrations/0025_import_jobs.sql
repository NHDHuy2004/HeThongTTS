-- ==========================================================================
-- IMS – 0025_import_jobs.sql
-- Import history (Intern/Mentor/Attendance...)
-- ==========================================================================
create table if not exists public.import_jobs (
  id              uuid primary key default gen_random_uuid(),
  import_type     text not null default 'interns',
  file_name       text,
  file_size       bigint,
  target_batch_id uuid references public.internship_batches(id) on delete set null,
  total_rows      int not null default 0,
  valid_rows      int not null default 0,
  success_rows    int not null default 0,
  failed_rows     int not null default 0,
  duplicate_rows  int not null default 0,
  import_mode     text not null default 'partial' check (import_mode in ('partial', 'strict')),
  status          text not null default 'pending'
                  check (status in ('pending','validating','ready','importing','completed','partial','failed','cancelled')),
  error_message   text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index if not exists idx_import_jobs_batch on public.import_jobs (target_batch_id);
create index if not exists idx_import_jobs_user on public.import_jobs (created_by);

create table if not exists public.import_job_items (
  id                uuid primary key default gen_random_uuid(),
  import_job_id     uuid not null references public.import_jobs(id) on delete cascade,
  row_number        int not null,
  raw_data          jsonb,
  normalized_data   jsonb,
  status            text not null default 'valid'
                    check (status in ('valid','invalid','duplicate','imported','skipped','failed')),
  error_code        text,
  error_message     text,
  created_record_id uuid,
  created_at        timestamptz not null default now()
);

create index if not exists idx_import_job_items_job on public.import_job_items (import_job_id);

alter table public.import_jobs enable row level security;
alter table public.import_job_items enable row level security;

drop policy if exists import_jobs_select on public.import_jobs;
create policy import_jobs_select on public.import_jobs
  for select to authenticated
  using (public.is_hr_or_admin() or created_by = auth.uid());

drop policy if exists import_jobs_write on public.import_jobs;
create policy import_jobs_write on public.import_jobs
  for all to authenticated
  using (public.is_hr_or_admin())
  with check (public.is_hr_or_admin());

drop policy if exists import_job_items_select on public.import_job_items;
create policy import_job_items_select on public.import_job_items
  for select to authenticated
  using (
    exists (select 1 from public.import_jobs j where j.id = import_job_id
            and (public.is_hr_or_admin() or j.created_by = auth.uid()))
  );

drop policy if exists import_job_items_write on public.import_job_items;
create policy import_job_items_write on public.import_job_items
  for all to authenticated
  using (public.is_hr_or_admin())
  with check (public.is_hr_or_admin());

-- Bucket private cho file import
insert into storage.buckets (id, name, public)
values ('imports', 'imports', false)
on conflict (id) do nothing;

drop policy if exists imports_manage_staff on storage.objects;
create policy imports_manage_staff on storage.objects
  for all to authenticated
  using (bucket_id = 'imports' and (public.is_hr_or_admin() or owner = auth.uid()))
  with check (bucket_id = 'imports' and public.is_hr_or_admin());
