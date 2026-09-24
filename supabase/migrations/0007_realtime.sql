-- ==========================================================================
-- IMS – 0007_realtime.sql
-- Bật Realtime (Postgres CDC) cho các bảng nghiệp vụ cần cập nhật trực tiếp.
-- Client subscribe vẫn bị ràng buộc bởi RLS.
-- ==========================================================================

-- Supabase cloud tạo sẵn publication này; tạo nếu môi trường chưa có (idempotent)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- --------------------------------------------------------------------------
-- Đăng ký từng bảng vào publication (idempotent — không lỗi nếu đã có sẵn)
-- --------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks') then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_comments') then
    alter publication supabase_realtime add table public.task_comments;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_reports') then
    alter publication supabase_realtime add table public.daily_reports;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'weekly_reports') then
    alter publication supabase_realtime add table public.weekly_reports;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leave_requests') then
    alter publication supabase_realtime add table public.leave_requests;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'work_from_home_requests') then
    alter publication supabase_realtime add table public.work_from_home_requests;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'late_requests') then
    alter publication supabase_realtime add table public.late_requests;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'evaluations') then
    alter publication supabase_realtime add table public.evaluations;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendance') then
    alter publication supabase_realtime add table public.attendance;
  end if;
end $$;

-- --------------------------------------------------------------------------
-- Hàm tiện ích: bảng, các bảng chưa có trong publication
-- --------------------------------------------------------------------------
create or replace function public.realtime_tables()
returns table(name text, subscribed boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.relname as name,
         exists (
           select 1 from pg_publication_tables pt
           where pt.pubname = 'supabase_realtime' and pt.tablename = c.relname
         ) as subscribed
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname;
$$;
grant execute on function public.realtime_tables() to authenticated;