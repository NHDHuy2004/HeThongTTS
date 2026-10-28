-- ==========================================================================
-- IMS – 0024_mssv_unique_per_batch.sql
-- MSSV (interns.student_code) là duy nhất trong phạm vi một đợt thực tập,
-- KHÔNG unique toàn hệ thống (sinh viên có thể tham gia nhiều đợt).
--   * Bỏ unique global trên interns.student_code
--   * UNIQUE (batch_id, intern_id) trên internships
--   * Trigger chặn cùng student_code xuất hiện 2 lần trong cùng batch
--   * UNIQUE (internship_id, type) cho đánh giá midterm/final
-- ==========================================================================

alter table public.interns drop constraint if exists interns_student_code_key;
create index if not exists idx_interns_student_code on public.interns (student_code);

create unique index if not exists idx_internships_batch_intern
  on public.internships (batch_id, intern_id);

-- Guard: cùng student_code (không phân biệt hoa thường, bỏ khoảng trắng)
-- không được xuất hiện ở 2 intern khác nhau trong cùng batch.
create or replace function public.tg_internship_mssv_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.internships it
    join public.interns i on i.id = it.intern_id
    join public.interns ni on ni.id = NEW.intern_id
    where it.batch_id = NEW.batch_id
      and it.id <> NEW.id
      and lower(trim(i.student_code)) = lower(trim(ni.student_code))
  ) then
    raise exception 'MSSV đã tồn tại trong đợt thực tập này. Vui lòng kiểm tra lại thông tin sinh viên.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_internship_mssv_guard on public.internships;
create trigger trg_internship_mssv_guard
before insert or update on public.internships
for each row execute function public.tg_internship_mssv_guard();

-- Mỗi internship chỉ có tối đa 1 đánh giá midterm và 1 final (periodic vẫn theo period_label)
create unique index if not exists idx_evaluations_unique_final
  on public.evaluations (internship_id, type)
  where type in ('midterm', 'final');
