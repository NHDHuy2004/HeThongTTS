-- ==========================================================================
-- IMS – 0001_enums.sql
-- Enum types dùng xuyên hệ thống
-- ==========================================================================

-- Vai trò người dùng
create type public.user_role as enum ('admin', 'hr', 'mentor', 'intern');

-- Trạng thái thực tập sinh
create type public.intern_status as enum ('pending', 'onboarding', 'active', 'completed', 'cancelled', 'converted');

-- Trạng thái đợt thực tập
create type public.internship_status as enum ('upcoming', 'active', 'completed', 'cancelled');

-- Trạng thái task
create type public.task_status as enum ('todo', 'in_progress', 'review', 'done');

-- Độ ưu tiên task
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');

-- Loại đơn từ
create type public.request_type as enum ('leave', 'wfh', 'late', 'early_leave', 'other');

-- Trạng thái đơn từ
create type public.request_status as enum ('pending', 'approved', 'rejected', 'cancelled');

-- Trạng thái báo cáo
create type public.report_status as enum ('draft', 'submitted', 'approved', 'rejected');

-- Loại báo cáo
create type public.report_type as enum ('daily', 'weekly');

-- Loại đánh giá
create type public.evaluation_type as enum ('weekly', 'midterm', 'final', 'feedback_360');

-- Trạng thái điểm danh
create type public.attendance_status as enum ('present', 'late', 'absent', 'leave', 'wfh', 'early_leave', 'weekend');

-- Loại ngày
create type public.day_status as enum ('working_day', 'weekend', 'holiday');

-- Loại thông báo
create type public.notification_type as enum (
  'task_assigned',
  'task_updated',
  'report_approved',
  'report_rejected',
  'request_approved',
  'request_rejected',
  'evaluation',
  'certificate',
  'system',
  'message'
);

-- Trạng thái onboarding
create type public.onboarding_status as enum ('not_started', 'in_progress', 'completed');

-- Trạng thái chứng nhận
create type public.certificate_status as enum ('draft', 'issued', 'revoked');

-- Nền tảng thiết bị nhận push
create type public.device_platform as enum ('android', 'ios');