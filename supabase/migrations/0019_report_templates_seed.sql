-- ==========================================================================
-- IMS – 0019_report_templates_seed.sql
-- Seed mẫu báo cáo (chạy SAU 0018_reports_management.sql).
-- Tách riêng vì giá trị enum 'monthly' / 'final' không được dùng trong
-- cùng transaction với ALTER TYPE ... ADD VALUE.
-- ==========================================================================

insert into public.report_templates (name, report_type, description, template_content) values
  ('Báo cáo ngày', 'daily', 'Ghi lại công việc trong ngày làm việc',
   '{"work_done":"Công việc đã thực hiện","results":"Kết quả đạt được","difficulties":"Khó khăn gặp phải","solution":"Cách giải quyết","next_plan":"Kế hoạch ngày tiếp theo","note":"Ghi chú"}'::jsonb),
  ('Báo cáo tuần', 'weekly', 'Tổng hợp công việc trong tuần',
   '{"completed_tasks":"Nhiệm vụ đã hoàn thành","in_progress_tasks":"Nhiệm vụ đang thực hiện","progress":"Tiến độ công việc","results":"Kết quả đạt được","difficulties":"Khó khăn gặp phải","solution":"Cách giải quyết","skills_learned":"Kiến thức / kỹ năng học được","next_plan":"Kế hoạch tuần tiếp theo","self_evaluation":"Tự đánh giá"}'::jsonb),
  ('Báo cáo tháng', 'monthly', 'Tổng kết kết quả thực tập theo tháng',
   '{"completed_work":"Công việc đã hoàn thành","progress":"Tiến độ các nhiệm vụ","highlights":"Kết quả nổi bật","skills_developed":"Kỹ năng chuyên môn phát triển","difficulties":"Khó khăn gặp phải","goal_completion":"Mức độ hoàn thành mục tiêu","next_plan":"Kế hoạch tháng tiếp theo","comments":"Nhận xét của thực tập sinh"}'::jsonb),
  ('Báo cáo tổng kết', 'final', 'Báo cáo tổng hợp quá trình thực tập',
   '{"goals":"Mục tiêu ban đầu","work_content":"Nội dung công việc đã thực hiện","notable_projects":"Dự án / nhiệm vụ tiêu biểu","results":"Kết quả đạt được","hard_skills":"Kiến thức và kỹ năng chuyên môn","soft_skills":"Kỹ năng mềm","difficulties":"Khó khăn và cách giải quyết","lessons":"Bài học kinh nghiệm","self_evaluation":"Tự đánh giá kết quả thực tập","future_direction":"Định hướng phát triển"}'::jsonb)
on conflict do nothing;
