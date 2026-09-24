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
-- 3. Internship batch
-- --------------------------------------------------------------------------
insert into public.internship_batches (id, name, code, description, start_date, end_date, max_interns, status, location, created_by) values
  ('20000000-0000-0000-0000-000000000001', 'Đợt Thực tập Kỳ 1 – 2026', 'IT-2026-01',
   'Đợt thực tập sinh viên kỳ 1 năm 2026', '2026-03-01', '2026-06-30', 30, 'upcoming',
   'Hà Nội', (select id from auth.users where email = 'admin@ims.local'))
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
  ('company',         '{"name":"Công ty TNHH ABC","logo_url":""}'::jsonb, 'Thông tin công ty')
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
-- 8. Gán role cho profile
-- --------------------------------------------------------------------------
update public.profiles set role_id = '00000000-0000-0000-0000-000000000001' where email = 'admin@ims.local';
update public.profiles set role_id = '00000000-0000-0000-0000-000000000002' where email = 'hr@ims.local';
update public.profiles set role_id = '00000000-0000-0000-0000-000000000003' where email = 'mentor@ims.local';
update public.profiles set role_id = '00000000-0000-0000-0000-000000000004' where email = 'intern@ims.local';

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

-- --------------------------------------------------------------------------
-- 12. Task mẫu
-- --------------------------------------------------------------------------
insert into public.tasks (internship_id, title, description, priority, status, deadline, created_by) values
  ('70000000-0000-0000-0000-000000000001', 'Tìm hiểu kiến trúc hệ thống', 'Đọc tài liệu kiến trúc và chuẩn bị Q&A', 'high', 'todo', now() + interval '3 days', '40000000-0000-0000-0000-000000000003'),
  ('70000000-0000-0000-0000-000000000001', 'Cài đặt môi trường phát triển', 'Setup IDE, database local, chạy app demo', 'medium', 'in_progress', now() + interval '1 day', '40000000-0000-0000-0000-000000000003');