-- ==========================================================================
-- IMS – 0023_evaluation_form_fields.sql
-- Bổ sung trường cho form đánh giá: điểm mạnh, cần cải thiện, đề xuất,
-- khoảng thời gian đánh giá.
-- ==========================================================================
alter table public.evaluations add column if not exists strengths text;
alter table public.evaluations add column if not exists needs_improvement text;
alter table public.evaluations add column if not exists recommendation text;
alter table public.evaluations add column if not exists period_start date;
alter table public.evaluations add column if not exists period_end date;
