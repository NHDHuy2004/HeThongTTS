-- ==========================================================================
-- IMS – seed.sql (chạy sau migrations khi `supabase db reset`)
-- Demo accounts (mật khẩu mặc định):
--   admin@ims.local / Admin@123     → System Admin
--   hr@ims.local    / Hr@123456     → HR Manager
--   mentor@ims.local/ Mentor@123    → Mentor
--   intern@ims.local/ Intern@123    → Intern
-- ==========================================================================

create extension if not exists pgcrypto;

set search_path = public, extensions;

-- --------------------------------------------------------------------------
-- 1. Roles (id cố định để tham chiếu trong demo)
-- --------------------------------------------------------------------------
insert into public.roles (id, name, code, description) values
  ('00000000-0000-0000-0000-000000000001', 'Administrator', 'admin',   'Quản trị toàn hệ thống'),
  ('00000000-0000-0000-0000-000000000002', 'HR Manager',    'hr',      'Quản lý nghiệp vụ thực tập'),
  ('00000000-0000-0000-0000-000000000003', 'Mentor',        'mentor',  'Hướng dẫn và quản lý thực tập sinh'),
  ('00000000-0000-0000-0000-000000000004', 'Intern',        'intern',  'Thực tập sinh')
on conflict (code) do nothing;

-- --------------------------------------------------------------------------
-- 2. Departments
-- --------------------------------------------------------------------------
insert into public.departments (id, name, code, description) values
  ('10000000-0000-0000-0000-000000000001', 'Phòng Phát triển Phần mềm', 'DEV', 'Xây dựng & phát triển sản phẩm'),
  ('10000000-0000-0000-0000-000000000002', 'Phòng Kiểm thử',            'QA',  'Đảm bảo chất lượng phần mềm'),
  ('10000000-0000-0000-0000-000000000003', 'Phòng Thiết kế',            'DSG', 'Thiết kế UI/UX và truyền thông')
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- 4. Evaluation criteria (8 tiêu chí chuẩn, tổng weight = 1)
-- --------------------------------------------------------------------------
insert into public.evaluation_criteria (name, category, description, weight, sort_order) values
  ('Technical Skill',      'Kỹ năng',        'Năng lực chuyên môn kỹ thuật', 0.15, 1),
  ('Communication',        'Kỹ năng',        'Giao tiếp và trình bày',        0.10, 2),
  ('Teamwork',             'Kỹ năng',        'Làm việc nhóm',                 0.10, 3),
  ('Problem Solving',      'Kỹ năng',        'Giải quyết vấn đề',             0.15, 4),
  ('Responsibility',       'Thái độ',        'Tinh thần trách nhiệm',         0.15, 5),
  ('Learning Ability',     'Thái độ',        'Khả năng học hỏi',              0.10, 6),
  ('Work Quality',         'Kết quả',        'Chất lượng công việc',          0.15, 7),
  ('Attendance',           'Kết quả',        'Chuyên cần và đúng giờ',        0.10, 8);

-- --------------------------------------------------------------------------
-- 5. Attendance location (mẫu: 350 Hoàng Quốc Việt, Hà Nội)
-- --------------------------------------------------------------------------
insert into public.attendance_locations (id, name, address, latitude, longitude, radius_m, is_active) values
  ('30000000-0000-0000-0000-000000000001', 'Văn phòng Cầu Giấy',
   '350 Hoàng Quốc Việt, Cầu Giấy, Hà Nội', 21.041746, 105.801413, 300, true)
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- 6. System settings
-- --------------------------------------------------------------------------
insert into public.system_settings (key, value, description) values
  ('attendance',      '{"check_in_start":"08:00","check_in_late":"08:30","check_out_start":"17:00","work_hours_day":8}'::jsonb, 'Khung giờ điểm danh'),
  ('certificate',     '{"signer_name":"Nguyễn Văn A","signer_title":"Giám đốc Nhân sự"}'::jsonb, 'Thông tin người ký chứng nhận'),
  ('company',         '{"name":"Công ty TNHH ABC","logo_url":""}'::jsonb, 'Thông tin công ty'),
  ('task_score',      '{"completion":0.30,"quality":0.30,"technical":0.20,"deadline":0.10,"documentation":0.10}'::jsonb, 'Trọng số tính điểm task (Final Task Score / 10)')
on conflict (key) do nothing;

-- --------------------------------------------------------------------------
-- 7. Demo users (auth.users) — trigger handle_new_user tạo profiles
-- --------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000',
   '40000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'admin@ims.local',
   crypt('Admin@123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Admin Hệ thống"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '40000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'hr@ims.local',
   crypt('Hr@123456', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"HR Manager"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '40000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'mentor@ims.local',
   crypt('Mentor@123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Mentor Nguyễn Văn M"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '40000000-0000-0000-0000-000000000004',
   'authenticated', 'authenticated', 'intern@ims.local',
   crypt('Intern@123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Intern Trần Thị I"}',
   now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- 7.1. Bù profile nếu auth.users đã tồn tại từ lần seed trước
-- --------------------------------------------------------------------------
insert into public.profiles (id, email, full_name)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1))
from auth.users
where email in ('admin@ims.local', 'hr@ims.local', 'mentor@ims.local', 'intern@ims.local')
on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name;

-- --------------------------------------------------------------------------
-- 8. Gán role cho profile
-- --------------------------------------------------------------------------
update public.profiles set role_id = '00000000-0000-0000-0000-000000000001' where email = 'admin@ims.local';
update public.profiles set role_id = '00000000-0000-0000-0000-000000000002' where email = 'hr@ims.local';
update public.profiles set role_id = '00000000-0000-0000-0000-000000000003' where email = 'mentor@ims.local';
update public.profiles set role_id = '00000000-0000-0000-0000-000000000004' where email = 'intern@ims.local';

-- --------------------------------------------------------------------------
-- 8. Internship batch (created_by tham chiếu profiles, phải tạo sau demo users)
-- --------------------------------------------------------------------------
insert into public.internship_batches (id, name, code, description, start_date, end_date, max_interns, status, location, created_by) values
  ('20000000-0000-0000-0000-000000000001', 'Đợt Thực tập Kỳ 1 – 2026', 'IT-2026-01',
   'Đợt thực tập sinh viên kỳ 1 năm 2026', '2026-03-01', '2026-06-30', 30, 'upcoming',
   'Hà Nội', (select id from public.profiles where email = 'admin@ims.local'))
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- 9. Mentors
-- --------------------------------------------------------------------------
insert into public.mentors (id, user_id, employee_code, full_name, email, department_id, max_interns) values
  ('50000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000003', 'EMP-0001', 'Mentor Nguyễn Văn M',
   'mentor@ims.local', '10000000-0000-0000-0000-000000000001', 5)
on conflict (employee_code) do nothing;

-- --------------------------------------------------------------------------
-- 10. Interns
-- --------------------------------------------------------------------------
insert into public.interns (id, user_id, student_code, full_name, email, phone, school, major, status) values
  ('60000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000004', 'SV-2026-0001', 'Intern Trần Thị I',
   'intern@ims.local', '0987654321', 'Đại học Bách Khoa Hà Nội', 'Công nghệ thông tin', 'pending')
on conflict (student_code) do nothing;

-- --------------------------------------------------------------------------
-- 11. Internship (gán intern vào batch + department + mentor)
-- --------------------------------------------------------------------------
insert into public.internships (id, intern_id, batch_id, department_id, mentor_id, status, start_date, end_date, created_by) values
  ('70000000-0000-0000-0000-000000000001',
   '60000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   '50000000-0000-0000-0000-000000000001',
   'active', '2026-03-01', '2026-06-30',
   '40000000-0000-0000-0000-000000000001')
on conflict (intern_id, batch_id) do nothing;

-- 11b. Thêm 2 intern nữa cho demo team task (không có tài khoản đăng nhập)
insert into public.interns (id, user_id, student_code, full_name, email, phone, school, major, status) values
  ('60000000-0000-0000-0000-000000000002', null, 'SV-2026-0002', 'Intern Lê Văn L',
   'intern2@ims.local', '0987000002', 'Đại học Bách Khoa Hà Nội', 'Công nghệ thông tin', 'active'),
  ('60000000-0000-0000-0000-000000000003', null, 'SV-2026-0003', 'Intern Phạm Thị P',
   'intern3@ims.local', '0987000003', 'Đại học Bách Khoa Hà Nội', 'Công nghệ thông tin', 'active')
on conflict (student_code) do nothing;

insert into public.internships (id, intern_id, batch_id, department_id, mentor_id, status, start_date, end_date, created_by) values
  ('70000000-0000-0000-0000-000000000002',
   '60000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   '50000000-0000-0000-0000-000000000001',
   'active', '2026-03-01', '2026-06-30',
   '40000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000003',
   '60000000-0000-0000-0000-000000000003',
   '20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   '50000000-0000-0000-0000-000000000001',
   'active', '2026-03-01', '2026-06-30',
   '40000000-0000-0000-0000-000000000001')
on conflict (intern_id, batch_id) do nothing;

-- --------------------------------------------------------------------------
-- 12. Task mẫu (individual) — status theo model mới
-- --------------------------------------------------------------------------
delete from public.tasks
where internship_id = '70000000-0000-0000-0000-000000000001'
  and title in ('Tìm hiểu kiến trúc hệ thống', 'Cài đặt môi trường phát triển')
  and id not in (
    '81000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000002'
  );

insert into public.tasks (id, internship_id, title, description, priority, status, start_date, deadline, created_by) values
  ('81000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Tìm hiểu kiến trúc hệ thống', 'Đọc tài liệu kiến trúc và chuẩn bị Q&A', 'high', 'not_started', now(), now() + interval '3 days', '40000000-0000-0000-0000-000000000003'),
  ('81000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 'Cài đặt môi trường phát triển', 'Setup IDE, database local, chạy app demo', 'medium', 'in_progress', now(), now() + interval '1 day', '40000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- 13. Task nhóm mẫu (team) + assignees + subtasks + submission + review
-- --------------------------------------------------------------------------
insert into public.tasks (
  id, internship_id, title, description, project, module, task_type,
  assignment_type, priority, status, start_date, deadline,
  objective, requirements, acceptance_criteria, deliverables,
  estimated_hours, created_by
) values (
  '80000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  'Xây dựng Module Quản lý Intern',
  'Xây dựng toàn bộ module quản lý thực tập sinh gồm database, API, UI và kiểm thử.',
  'IMS', 'Intern Management', 'feature',
  'team', 'high', 'in_progress',
  now(), now() + interval '14 days',
  'Module cho phép CRUD thực tập sinh, phân bổ phòng ban/mentor và giao task.',
  '1. Bảng intern + internship theo ERD.\n2. API CRUD + phân quyền.\n3. Màn hình danh sách/chi tiết intern.\n4. Unit test cho service layer.',
  'Có thể tạo/sửa/xóa/xem intern; phân quyền đúng 4 vai trò; tất cả test pass.',
  '["source_code","database_script","screenshot","documentation","demo_link"]'::jsonb,
  40, '40000000-0000-0000-0000-000000000003'
)
on conflict (id) do nothing;

-- Assignees (team 3 người — intern1 là lead)
insert into public.task_assignees (task_id, intern_id, role, assigned_by) values
  ('80000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'lead', '40000000-0000-0000-0000-000000000003'),
  ('80000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 'assignee', '40000000-0000-0000-0000-000000000003'),
  ('80000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 'assignee', '40000000-0000-0000-0000-000000000003')
on conflict (task_id, intern_id) do nothing;

-- Subtasks (mỗi người một phần)
insert into public.task_subtasks (id, task_id, title, description, assignee_id, start_date, due_date, priority, status, deliverable) values
  ('82000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'Database', 'Thiết kế bảng intern + internship, index và migration', '60000000-0000-0000-0000-000000000001', now(), now() + interval '7 days', 'high', 'in_review', 'Database script'),
  ('82000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 'API', 'Xây dựng REST API + phân quyền', '60000000-0000-0000-0000-000000000002', now(), now() + interval '9 days', 'high', 'in_progress', 'Source code + Swagger'),
  ('82000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001', 'UI', 'Xây dựng màn hình danh sách/chi tiết intern', '60000000-0000-0000-0000-000000000003', now(), now() + interval '11 days', 'medium', 'not_started', 'Screenshot + Demo link'),
  ('82000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000001', 'Testing', 'Viết unit test và kiểm thử end-to-end', '60000000-0000-0000-0000-000000000001', now(), now() + interval '14 days', 'medium', 'not_started', 'Test report')
on conflict (id) do nothing;

-- Lịch sử nộp (subtask Database — intern1) + link đính kèm
insert into public.task_submissions (id, task_id, subtask_id, submitted_by, work_summary, implementation_details, problems, solutions, submission_no) values
  ('83000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000004',
   'Đã hoàn thành bảng intern + internship + index',
   'Dùng migration SQL, thêm RLS cho 2 bảng.',
   'Gặp lỗi RLS đệ quy khi viết policy',
  'Tách policy via helper function is_hr_or_admin()',
  1)
on conflict (id) do nothing;

delete from public.task_submission_links
where submission_id = '83000000-0000-0000-0000-000000000001'
  and id <> '84000000-0000-0000-0000-000000000001';

insert into public.task_submission_links (id, submission_id, title, url) values
  ('84000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'Pull request', 'https://github.com/demo/ims/pull/101')
on conflict (id) do nothing;

-- Review (request changes — trạng thái chờ sửa)
insert into public.task_reviews (
  id, task_id, subtask_id, submission_id, reviewer_id, decision, completion, completion_pct,
  quality_score, technical_score, documentation_score, soft_score, deadline_bucket,
  feedback, strengths, weaknesses, improvements
) values (
  '85000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003',
  'changes_requested', 'partial', 80,
  4.0, 4.0, 3.0, 4.0, 'on_time',
  'Cần bổ sung index và kiểm tra lại RLS cho bảng con.',
  'Cấu trúc bảng rõ ràng, đúng ERD.',
  'Thiếu index cho cột created_by ở bảng task.',
  'Thêm index và chạy lại test RLS trước khi nộp lại.'
)
on conflict (id) do nothing;