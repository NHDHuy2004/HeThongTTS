-- ==========================================================================
-- IMS – 0022_evaluation_module.sql
-- Module Đánh giá Intern toàn diện:
--   * 6 tiêu chí chuẩn (Đúng giờ, Đồng phục, Kiến thức, Kỹ năng,
--     Kết quả công việc, Giao tiếp) với trọng số
--   * Điểm 0–10 + mức đánh giá (Rất tốt/Tốt/Khá/Trung bình/Chưa đạt)
--   * evaluations.status (draft/submitted/reviewed/finalized), overall_level
--   * Trigger tự tính final_score (weighted) + overall_level
--   * get_evaluation_context(): tóm tắt Attendance + Task cho Mentor
--   * Notification khi submit/finalize
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. evaluation_criteria: thêm code, seed tiêu chí chuẩn
-- --------------------------------------------------------------------------
alter table public.evaluation_criteria add column if not exists code text;
create unique index if not exists idx_evaluation_criteria_code
  on public.evaluation_criteria (code) where code is not null;

-- Tắt tiêu chí cũ để tránh trùng lặp nghiệp vụ
update public.evaluation_criteria set is_active = false where code is null;

insert into public.evaluation_criteria (code, name, category, description, weight, sort_order, is_active)
select * from (values
  ('PUNCTUALITY', 'Đúng giờ', 'Kỷ luật', 'Tuân thủ giờ giấc, chuyên cần, đúng hạn', 0.15, 1, true),
  ('UNIFORM',     'Đồng phục', 'Kỷ luật', 'Tuân thủ quy định đồng phục/trang phục', 0.05, 2, true),
  ('KNOWLEDGE',   'Kiến thức', 'Chuyên môn', 'Nắm kiến thức nền tảng và công nghệ sử dụng', 0.20, 3, true),
  ('SKILLS',      'Kỹ năng', 'Chuyên môn', 'Kỹ năng chuyên môn, giải quyết vấn đề, công cụ', 0.20, 4, true),
  ('WORK_RESULT', 'Kết quả công việc', 'Kết quả', 'Mức độ hoàn thành Task, submission, review', 0.20, 5, true),
  ('COMMUNICATION','Giao tiếp', 'Thái độ', 'Chủ động trao đổi, báo cáo, phản hồi', 0.10, 6, true)
) as v(code, name, category, description, weight, sort_order, is_active)
where not exists (select 1 from public.evaluation_criteria ec where ec.code = v.code);

-- --------------------------------------------------------------------------
-- 2. evaluations: trạng thái + mức đánh giá
-- --------------------------------------------------------------------------
alter table public.evaluations add column if not exists status text not null default 'draft';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'evaluations_status_check') then
    alter table public.evaluations
      add constraint evaluations_status_check
      check (status in ('draft', 'submitted', 'reviewed', 'finalized'));
  end if;
end $$;
alter table public.evaluations add column if not exists overall_level text;
alter table public.evaluations add column if not exists reviewed_at timestamptz;

update public.evaluations set status = 'submitted'
 where status = 'draft' and submitted_at is not null;

-- Đổi thang điểm tổng 0–100 → 0–10
alter table public.evaluations drop constraint if exists evaluations_final_score_check;
alter table public.evaluations add constraint evaluations_final_score_check
  check (final_score between 0 and 10);

-- --------------------------------------------------------------------------
-- 3. evaluation_scores: 0–10 + rating_level
-- --------------------------------------------------------------------------
alter table public.evaluation_scores alter column score type numeric(4,1);
alter table public.evaluation_scores drop constraint if exists evaluation_scores_score_check;
alter table public.evaluation_scores add constraint evaluation_scores_score_check
  check (score between 0 and 10);
alter table public.evaluation_scores add column if not exists rating_level text;

-- --------------------------------------------------------------------------
-- 4. Tự tính điểm tổng + mức đánh giá
-- --------------------------------------------------------------------------
create or replace function public.evaluation_rating_level(p_score numeric)
returns text
language sql
immutable
as $$
  select case
    when p_score is null then null
    when p_score >= 9 then 'Rất tốt'
    when p_score >= 8 then 'Tốt'
    when p_score >= 7 then 'Khá'
    when p_score >= 5 then 'Trung bình'
    else 'Chưa đạt'
  end;
$$;

create or replace function public.recompute_evaluation(p_evaluation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_score numeric;
begin
  select round(sum(s.score * c.weight) / nullif(sum(c.weight), 0), 2)
  into v_score
  from public.evaluation_scores s
  join public.evaluation_criteria c on c.id = s.criterion_id
  where s.evaluation_id = p_evaluation_id;

  update public.evaluations
     set final_score = v_score,
         overall_level = public.evaluation_rating_level(v_score),
         updated_at = now()
   where id = p_evaluation_id;
end;
$$;

create or replace function public.tg_evaluation_scores_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.score is not null then
    NEW.rating_level := public.evaluation_rating_level(NEW.score);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_evaluation_scores_level on public.evaluation_scores;
create trigger trg_evaluation_scores_level
before insert or update on public.evaluation_scores
for each row execute function public.tg_evaluation_scores_sync();

create or replace function public.tg_evaluation_recompute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_evaluation(coalesce(NEW.evaluation_id, OLD.evaluation_id));
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_evaluation_recompute on public.evaluation_scores;
create trigger trg_evaluation_recompute
after insert or update or delete on public.evaluation_scores
for each row execute function public.tg_evaluation_recompute();

-- --------------------------------------------------------------------------
-- 5. Bối cảnh đánh giá (Attendance + Task) cho Mentor
-- --------------------------------------------------------------------------
create or replace function public.get_evaluation_context(p_internship_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_intern uuid;
  v_att jsonb;
  v_task jsonb;
  v_total bigint; v_present bigint; v_late bigint; v_early bigint; v_absent bigint;
begin
  select intern_id into v_intern from public.internships where id = p_internship_id;

  select count(*),
         count(*) filter (where status = 'present'),
         count(*) filter (where status = 'late'),
         count(*) filter (where status = 'early_leave'),
         count(*) filter (where status = 'absent')
    into v_total, v_present, v_late, v_early, v_absent
    from public.attendance
   where intern_id = v_intern;

  v_att := jsonb_build_object(
    'total_days', v_total,
    'present', v_present,
    'late', v_late,
    'early_leave', v_early,
    'absent', v_absent,
    'punctuality_rate', case when v_total > 0
        then round(100.0 * (v_present + v_late) * 1.0 / v_total, 1) else null end,
    'suggested_score', case when v_total > 0
        then round(10.0 * (v_present + v_late) / v_total, 1) else null end
  );

  -- Task: dùng get_member_task_stats nếu có intern
  select jsonb_agg(row_to_json(t)) into v_task
  from (select * from public.get_member_task_stats(p_internship_id) m where m.intern_id = v_intern) t;

  return jsonb_build_object('attendance', v_att, 'tasks', v_task);
end;
$$;

grant execute on function public.get_evaluation_context(uuid) to anon, authenticated, service_role;

-- --------------------------------------------------------------------------
-- 6. Notification khi submit / finalize
-- --------------------------------------------------------------------------
create or replace function public.tg_evaluation_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  select i.user_id into v_uid
  from public.internships ip
  join public.interns i on i.id = ip.intern_id
  where ip.id = NEW.internship_id;

  if v_uid is null then return NEW; end if;

  if NEW.status is distinct from OLD.status and NEW.status = 'submitted' then
    insert into public.notifications (user_id, type, title, body, data)
    values (v_uid, 'evaluation'::public.notification_type,
            'Đánh giá mới',
            format('Bạn đã nhận được đánh giá %s.', NEW.type),
            jsonb_build_object('table', 'evaluations', 'id', NEW.id));
  elsif NEW.status is distinct from OLD.status and NEW.status = 'finalized' then
    insert into public.notifications (user_id, type, title, body, data)
    values (v_uid, 'evaluation'::public.notification_type,
            'Đánh giá đã hoàn tất',
            format('Đánh giá %s của bạn đã được hoàn tất.', NEW.type),
            jsonb_build_object('table', 'evaluations', 'id', NEW.id));
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_evaluation_notify on public.evaluations;
create trigger trg_evaluation_notify
after update on public.evaluations
for each row execute function public.tg_evaluation_notify();
