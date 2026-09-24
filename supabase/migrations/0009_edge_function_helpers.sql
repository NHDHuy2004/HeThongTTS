-- ==========================================================================
-- IMS – 0009_edge_function_helpers.sql
-- Helpers server-side cho Edge Function và client:
--   * distance_m      : haversine (mét) — dùng preview khoảng cách trên Mobile
--   * get_active_internship(user_id) : internship đang active của 1 user
-- ==========================================================================

-- Khoảng cách haversine (mét) giữa 2 tọa độ
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

-- Đợt thực tập đang active của 1 user (auth.users.id)
create or replace function public.get_active_internship(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'internship', row_to_json(ip)::jsonb,
    'intern', jsonb_build_object('id', i.id, 'student_code', i.student_code, 'full_name', i.full_name)
  )
  into v_result
  from public.interns i
  join public.internships ip on ip.intern_id = i.id
  where i.user_id = p_user_id
    and i.deleted_at is null
    and ip.deleted_at is null
    and ip.status = 'active'
  order by ip.created_at desc
  limit 1;

  return v_result;
end;
$$;

-- Mã chứng nhận kế tiếp theo năm (CERT-YYYY-xxxxxx)
create or replace function public.next_certificate_code(p_year int)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select 'CERT-' || p_year || '-' || lpad((count(*) + 1)::text, 6, '0')
  from public.certificates
  where certificate_code like 'CERT-' || p_year || '-%';
$$;

grant execute on function public.distance_m(double precision, double precision, double precision, double precision) to anon, authenticated, service_role;
grant execute on function public.get_active_internship(uuid) to authenticated;
grant execute on function public.next_certificate_code(int) to authenticated;