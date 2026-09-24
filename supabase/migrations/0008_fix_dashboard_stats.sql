-- ==========================================================================
-- IMS – 0008_fix_dashboard_stats.sql
-- Sửa lỗi "aggregate function calls cannot be nested" trong get_dashboard_stats:
-- mục attendance_trend trước đây dùng jsonb_agg(jsonb_build_object(..., count(*))),
-- là aggregate lồng nhau. Chuyển count(*) vào subquery trước rồi mới jsonb_agg.
-- ==========================================================================

create or replace function public.get_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_hr_or_admin() then
    raise exception 'PERMISSION_DENIED';
  end if;

  select jsonb_build_object(
    'total_interns',       (select count(*) from public.interns where deleted_at is null),
    'total_mentors',       (select count(*) from public.mentors where deleted_at is null),
    'total_batches',       (select count(*) from public.internship_batches where deleted_at is null),
    'interns_active',      (select count(*) from public.internships where status = 'active' and deleted_at is null),
    'interns_completed',   (select count(*) from public.internships where status = 'completed' and deleted_at is null),
    'converted',           (select count(*) from public.internships where converted_to_employee and deleted_at is null),
    'attendance_rate',     (select round(100.0 * count(*) filter (where status in ('present','late')) / nullif(count(*), 0), 1)
                            from public.attendance),
    'task_completion_rate',(select round(100.0 * count(*) filter (where status = 'done') / nullif(count(*), 0), 1)
                            from public.tasks),
    'avg_evaluation',      (select round(avg(final_score)::numeric, 1) from public.evaluations where final_score is not null),
    'attendance_trend',    (select coalesce(jsonb_agg(jsonb_build_object('date', date, 'present', present) order by date desc), '[]'::jsonb)
                            from (select work_date as date, count(*) as present
                                  from public.attendance
                                  where status in ('present','late')
                                  group by work_date) trend),
    'tasks_by_status',     (select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb)
                            from (select status, count(*) as cnt from public.tasks group by status) t),
    'batches_by_status',   (select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb)
                            from (select status, count(*) as cnt from public.internship_batches where deleted_at is null group by status) t)
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_dashboard_stats() to authenticated;