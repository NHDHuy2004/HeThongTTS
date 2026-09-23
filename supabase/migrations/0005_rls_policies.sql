-- ==========================================================================
-- IMS – 0005_rls_policies.sql
-- Bật RLS + policies cho toàn bộ bảng. Dùng helper security từ 0004.
--
-- Nguyên tắc:
--  * Không bảng nào truy cập được nếu thiếu policy (RLS deny mặc định).
--  * Role login từ DB (get_my_role), không tin claim/payload client.
--  * Hàm SECURITY DEFINER (owner=postgres) bỏ qua RLS → dùng cho helper,
--    tránh đệ quy policy.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Quyền EXECUTE mặc định cho functions (RLS dùng hàm như is_hr_or_admin)
-- --------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant execute on function public.get_my_role() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_hr_or_admin() to anon, authenticated, service_role;
grant execute on function public.get_my_intern_id() to anon, authenticated, service_role;
grant execute on function public.get_my_internship_ids() to anon, authenticated, service_role;
grant execute on function public.is_mentor_of_intern(uuid) to anon, authenticated, service_role;
grant execute on function public.is_mentor_of(uuid) to anon, authenticated, service_role;
grant execute on function public.is_mentor_of_internship(uuid) to anon, authenticated, service_role;
grant execute on function public.get_dashboard_stats() to authenticated;
grant execute on function public.get_mentor_stats() to authenticated;
grant execute on function public.attendance_rate(uuid) to authenticated;
grant execute on function public.task_completion_rate(uuid) to authenticated;
grant execute on function public.report_submission_rate(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- Helpers chặn đổi email/student_code khi user tự cập nhật hồ sơ.
-- (PHẢI định nghĩa TRƯỚC policy tham chiếu)
-- --------------------------------------------------------------------------
create or replace function public.existing_email(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from public.profiles where id = p_id;
$$;
grant execute on function public.existing_email(uuid) to authenticated;

create or replace function public.existing_interne_mail(p_id uuid)
returns text language sql stable security definer set search_path = public
as $$ select email from public.interns where id = p_id; $$;
grant execute on function public.existing_interne_mail(uuid) to authenticated;

create or replace function public.existing_student_code(p_id uuid)
returns text language sql stable security definer set search_path = public
as $$ select student_code from public.interns where id = p_id; $$;
grant execute on function public.existing_student_code(uuid) to authenticated;

-- ==========================================================================
-- 1. roles
-- ==========================================================================
alter table public.roles enable row level security;

create policy roles_select_authenticated on public.roles
  for select to authenticated using (true);

create policy roles_write_admin on public.roles
  for all to authenticated using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- ==========================================================================
-- 2. profiles
-- ==========================================================================
alter table public.profiles enable row level security;

create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_select_hr_admin on public.profiles
  for select to authenticated using (public.is_hr_or_admin());

create policy profiles_select_mentor_of on public.profiles
  for select to authenticated using (public.is_mentor_of(id));

create policy profiles_insert_hr_admin on public.profiles
  for insert to authenticated with check (public.is_hr_or_admin());

create policy profiles_update_self_limited on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and email is not distinct from existing_email(id)
  );

create policy profiles_update_hr_admin on public.profiles
  for update to authenticated
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- ==========================================================================
-- 3. departments
-- ==========================================================================
alter table public.departments enable row level security;

create policy departments_select_authenticated on public.departments
  for select to authenticated using (true);

create policy departments_write_admin on public.departments
  for all to authenticated using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- ==========================================================================
-- 4. internship_batches
-- ==========================================================================
alter table public.internship_batches enable row level security;

create policy batches_select_authenticated on public.internship_batches
  for select to authenticated using (true);

create policy batches_write_hr_admin on public.internship_batches
  for all to authenticated using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- ==========================================================================
-- 5. interns
-- ==========================================================================
alter table public.interns enable row level security;

create policy interns_select_self on public.interns
  for select to authenticated using (user_id = auth.uid());

create policy interns_select_hr_admin on public.interns
  for select to authenticated using (public.is_hr_or_admin());

create policy interns_select_mentor on public.interns
  for select to authenticated using (public.is_mentor_of_intern(id));

create policy interns_insert_hr_admin on public.interns
  for insert to authenticated with check (public.is_hr_or_admin());

create policy interns_update_self on public.interns
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and email is not distinct from existing_interne_mail(id)
    and student_code is not distinct from existing_student_code(id)
  );

create policy interns_update_hr_admin on public.interns
  for update to authenticated
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

create policy interns_delete_admin on public.interns
  for delete to authenticated using (public.is_hr_or_admin());

-- ==========================================================================
-- 6. mentors
-- ==========================================================================
alter table public.mentors enable row level security;

create policy mentors_select_authenticated on public.mentors
  for select to authenticated using (true);

create policy mentors_write_hr_admin on public.mentors
  for all to authenticated using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- ==========================================================================
-- 7. internships
-- ==========================================================================
alter table public.internships enable row level security;

create policy internships_select_own on public.internships
  for select to authenticated
  using (intern_id = public.get_my_intern_id());

create policy internships_select_mentor on public.internships
  for select to authenticated
  using (mentor_id in (select m.id from public.mentors m where m.user_id = auth.uid()));

create policy internships_select_hr_admin on public.internships
  for select to authenticated using (public.is_hr_or_admin());

create policy internships_insert_hr_admin on public.internships
  for insert to authenticated with check (public.is_hr_or_admin());

create policy internships_update_hr_admin on public.internships
  for update to authenticated
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

create policy internships_delete_hr_admin on public.internships
  for delete to authenticated using (public.is_hr_or_admin());

-- ==========================================================================
-- 8. documents
-- ==========================================================================
alter table public.documents enable row level security;

create policy documents_select_authenticated on public.documents
  for select to authenticated using (true);

create policy documents_write_hr_admin on public.documents
  for all to authenticated using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- ==========================================================================
-- 9. onboarding_checklists
-- ==========================================================================
alter table public.onboarding_checklists enable row level security;

create policy checklists_select_self on public.onboarding_checklists
  for select to authenticated
  using (intern_id = public.get_my_intern_id());

create policy checklists_select_mentor on public.onboarding_checklists
  for select to authenticated
  using (public.is_mentor_of_intern(intern_id));

create policy checklists_select_hr_admin on public.onboarding_checklists
  for select to authenticated using (public.is_hr_or_admin());

create policy checklists_insert_hr_admin on public.onboarding_checklists
  for insert to authenticated with check (public.is_hr_or_admin());

create policy checklists_update_self on public.onboarding_checklists
  for update to authenticated
  using (intern_id = public.get_my_intern_id())
  with check (intern_id = public.get_my_intern_id());

create policy checklists_update_hr_admin on public.onboarding_checklists
  for update to authenticated
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

create policy checklists_delete_hr_admin on public.onboarding_checklists
  for delete to authenticated using (public.is_hr_or_admin());

-- ==========================================================================
-- 10. task_templates
-- ==========================================================================
alter table public.task_templates enable row level security;

create policy templates_select_authenticated on public.task_templates
  for select to authenticated using (true);

create policy templates_write_hr_admin on public.task_templates
  for all to authenticated using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- ==========================================================================
-- 11. tasks
-- ==========================================================================
alter table public.tasks enable row level security;

create policy tasks_select_intern on public.tasks
  for select to authenticated
  using (internship_id = any (public.get_my_internship_ids()));

create policy tasks_select_mentor_owner on public.tasks
  for select to authenticated
  using (
    created_by = auth.uid()
    or public.is_mentor_of_internship(internship_id)
    or public.is_hr_or_admin()
  );

create policy tasks_insert_mentor_hr on public.tasks
  for insert to authenticated
  with check (
    public.is_hr_or_admin()
    or public.is_mentor_of_internship(internship_id)
  );

create policy tasks_update_intern on public.tasks
  for update to authenticated
  using (internship_id = any (public.get_my_internship_ids()))
  with check (internship_id = any (public.get_my_internship_ids()));

create policy tasks_update_mentor_hr on public.tasks
  for update to authenticated
  using (
    created_by = auth.uid()
    or public.is_mentor_of_internship(internship_id)
    or public.is_hr_or_admin()
  )
  with check (
    created_by = auth.uid()
    or public.is_mentor_of_internship(internship_id)
    or public.is_hr_or_admin()
  );

create policy tasks_delete_hr on public.tasks
  for delete to authenticated using (public.is_hr_or_admin());

-- ==========================================================================
-- 12. task_comments
-- ==========================================================================
alter table public.task_comments enable row level security;

create policy comments_select_participant on public.task_comments
  for select to authenticated
  using (
    task_id in (
      select t.id from public.tasks t
      where t.internship_id = any (public.get_my_internship_ids())
         or t.created_by = auth.uid()
         or public.is_mentor_of_internship(t.internship_id)
         or public.is_hr_or_admin()
    )
  );

create policy comments_insert_participant on public.task_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      task_id in (
        select t.id from public.tasks t
        where t.internship_id = any (public.get_my_internship_ids())
           or t.created_by = auth.uid()
           or public.is_mentor_of_internship(t.internship_id)
           or public.is_hr_or_admin()
      )
    )
  );

create policy comments_update_author on public.task_comments
  for update to authenticated
  using (user_id = auth.uid() or public.is_hr_or_admin())
  with check (user_id = auth.uid() or public.is_hr_or_admin());

create policy comments_delete_author on public.task_comments
  for delete to authenticated using (user_id = auth.uid() or public.is_hr_or_admin());

-- ==========================================================================
-- 13. task_attachments
-- ==========================================================================
alter table public.task_attachments enable row level security;

create policy attachments_select_participant on public.task_attachments
  for select to authenticated
  using (
    uploaded_by = auth.uid()
    or task_id in (
      select t.id from public.tasks t
      where t.internship_id = any (public.get_my_internship_ids())
         or t.created_by = auth.uid()
         or public.is_mentor_of_internship(t.internship_id)
         or public.is_hr_or_admin()
    )
  );

create policy attachments_insert_participant on public.task_attachments
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      task_id in (
        select t.id from public.tasks t
        where t.internship_id = any (public.get_my_internship_ids())
           or t.created_by = auth.uid()
           or public.is_mentor_of_internship(t.internship_id)
           or public.is_hr_or_admin()
      )
    )
  );

create policy attachments_delete_author on public.task_attachments
  for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_hr_or_admin());

-- ==========================================================================
-- 14. attendance_locations
-- ==========================================================================
alter table public.attendance_locations enable row level security;

create policy locations_select_authenticated on public.attendance_locations
  for select to authenticated using (true);

create policy locations_write_admin on public.attendance_locations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ==========================================================================
-- 15. attendance
--    Lưu ý: INSERT/UPDATE cho check-in/check-out thực hiện qua Edge Function
--    (service role) — client KHÔNG được ghi trực tiếp.
-- ==========================================================================
alter table public.attendance enable row level security;

create policy attendance_select_self on public.attendance
  for select to authenticated using (intern_id = public.get_my_intern_id());

create policy attendance_select_mentor on public.attendance
  for select to authenticated using (public.is_mentor_of_intern(intern_id));

create policy attendance_select_hr_admin on public.attendance
  for select to authenticated using (public.is_hr_or_admin());

create policy attendance_update_hr_admin on public.attendance
  for update to authenticated
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

create policy attendance_delete_hr_admin on public.attendance
  for delete to authenticated using (public.is_hr_or_admin());

-- ==========================================================================
-- 16. leave_requests
-- ==========================================================================
alter table public.leave_requests enable row level security;

create policy leave_select_self on public.leave_requests
  for select to authenticated using (intern_id = public.get_my_intern_id());

create policy leave_select_mentor on public.leave_requests
  for select to authenticated using (public.is_mentor_of_intern(intern_id));

create policy leave_select_hr_admin on public.leave_requests
  for select to authenticated using (public.is_hr_or_admin());

create policy leave_insert_self on public.leave_requests
  for insert to authenticated
  with check (intern_id = public.get_my_intern_id());

create policy leave_update_mentor on public.leave_requests
  for update to authenticated
  using (public.is_mentor_of_intern(intern_id))
  with check (public.is_mentor_of_intern(intern_id));

create policy leave_update_hr_admin on public.leave_requests
  for update to authenticated
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

create policy leave_update_cancel_self on public.leave_requests
  for update to authenticated
  using (intern_id = public.get_my_intern_id())
  with check (intern_id = public.get_my_intern_id() and status = 'cancelled');

create policy leave_delete_hr_admin on public.leave_requests
  for delete to authenticated using (public.is_hr_or_admin());

-- ==========================================================================
-- 17. work_from_home_requests
-- ==========================================================================
alter table public.work_from_home_requests enable row level security;

create policy wfh_select_self on public.work_from_home_requests
  for select to authenticated using (intern_id = public.get_my_intern_id());

create policy wfh_select_mentor on public.work_from_home_requests
  for select to authenticated using (public.is_mentor_of_intern(intern_id));

create policy wfh_select_hr_admin on public.work_from_home_requests
  for select to authenticated using (public.is_hr_or_admin());

create policy wfh_insert_self on public.work_from_home_requests
  for insert to authenticated
  with check (intern_id = public.get_my_intern_id());

create policy wfh_update_mentor on public.work_from_home_requests
  for update to authenticated
  using (public.is_mentor_of_intern(intern_id))
  with check (public.is_mentor_of_intern(intern_id));

create policy wfh_update_hr_admin on public.work_from_home_requests
  for update to authenticated
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

create policy wfh_update_cancel_self on public.work_from_home_requests
  for update to authenticated
  using (intern_id = public.get_my_intern_id())
  with check (intern_id = public.get_my_intern_id() and status = 'cancelled');

create policy wfh_delete_hr_admin on public.work_from_home_requests
  for delete to authenticated using (public.is_hr_or_admin());

-- ==========================================================================
-- 18. late_requests
-- ==========================================================================
alter table public.late_requests enable row level security;

create policy late_select_self on public.late_requests
  for select to authenticated using (intern_id = public.get_my_intern_id());

create policy late_select_mentor on public.late_requests
  for select to authenticated using (public.is_mentor_of_intern(intern_id));

create policy late_select_hr_admin on public.late_requests
  for select to authenticated using (public.is_hr_or_admin());

create policy late_insert_self on public.late_requests
  for insert to authenticated
  with check (intern_id = public.get_my_intern_id());

create policy late_update_mentor on public.late_requests
  for update to authenticated
  using (public.is_mentor_of_intern(intern_id))
  with check (public.is_mentor_of_intern(intern_id));

create policy late_update_hr_admin on public.late_requests
  for update to authenticated
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

create policy late_update_cancel_self on public.late_requests
  for update to authenticated
  using (intern_id = public.get_my_intern_id())
  with check (intern_id = public.get_my_intern_id() and status = 'cancelled');

create policy late_delete_hr_admin on public.late_requests
  for delete to authenticated using (public.is_hr_or_admin());

-- ==========================================================================
-- 19. daily_reports
-- ==========================================================================
alter table public.daily_reports enable row level security;

create policy daily_select_self on public.daily_reports
  for select to authenticated using (intern_id = public.get_my_intern_id());

create policy daily_select_mentor on public.daily_reports
  for select to authenticated using (public.is_mentor_of_intern(intern_id));

create policy daily_select_hr_admin on public.daily_reports
  for select to authenticated using (public.is_hr_or_admin());

create policy daily_insert_self on public.daily_reports
  for insert to authenticated
  with check (intern_id = public.get_my_intern_id());

create policy daily_update_self on public.daily_reports
  for update to authenticated
  using (intern_id = public.get_my_intern_id())
  with check (intern_id = public.get_my_intern_id());

create policy daily_update_mentor on public.daily_reports
  for update to authenticated
  using (public.is_mentor_of_intern(intern_id))
  with check (public.is_mentor_of_intern(intern_id));

create policy daily_update_hr_admin on public.daily_reports
  for update to authenticated
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

create policy daily_delete_hr_admin on public.daily_reports
  for delete to authenticated using (public.is_hr_or_admin());

-- ==========================================================================
-- 20. weekly_reports
-- ==========================================================================
alter table public.weekly_reports enable row level security;

create policy weekly_select_self on public.weekly_reports
  for select to authenticated using (intern_id = public.get_my_intern_id());

create policy weekly_select_mentor on public.weekly_reports
  for select to authenticated using (public.is_mentor_of_intern(intern_id));

create policy weekly_select_hr_admin on public.weekly_reports
  for select to authenticated using (public.is_hr_or_admin());

create policy weekly_insert_self on public.weekly_reports
  for insert to authenticated
  with check (intern_id = public.get_my_intern_id());

create policy weekly_update_self on public.weekly_reports
  for update to authenticated
  using (intern_id = public.get_my_intern_id())
  with check (intern_id = public.get_my_intern_id());

create policy weekly_update_mentor on public.weekly_reports
  for update to authenticated
  using (public.is_mentor_of_intern(intern_id))
  with check (public.is_mentor_of_intern(intern_id));

create policy weekly_update_hr_admin on public.weekly_reports
  for update to authenticated
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

create policy weekly_delete_hr_admin on public.weekly_reports
  for delete to authenticated using (public.is_hr_or_admin());

-- ==========================================================================
-- 21. evaluation_criteria
-- ==========================================================================
alter table public.evaluation_criteria enable row level security;

create policy criteria_select_authenticated on public.evaluation_criteria
  for select to authenticated using (true);

create policy criteria_write_admin on public.evaluation_criteria
  for all to authenticated using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

-- ==========================================================================
-- 22. evaluations
-- ==========================================================================
alter table public.evaluations enable row level security;

create policy evaluations_select_self on public.evaluations
  for select to authenticated
  using (internship_id = any (public.get_my_internship_ids()));

create policy evaluations_select_mentor_reviewer on public.evaluations
  for select to authenticated
  using (
    reviewer_id = auth.uid()
    or public.is_mentor_of_internship(internship_id)
    or public.is_hr_or_admin()
  );

create policy evaluations_insert_mentor_hr on public.evaluations
  for insert to authenticated
  with check (
    public.is_hr_or_admin()
    or public.is_mentor_of_internship(internship_id)
  );

create policy evaluations_update_mentor_hr on public.evaluations
  for update to authenticated
  using (
    public.is_hr_or_admin()
    or public.is_mentor_of_internship(internship_id)
  )
  with check (
    public.is_hr_or_admin()
    or public.is_mentor_of_internship(internship_id)
  );

create policy evaluations_delete_hr on public.evaluations
  for delete to authenticated using (public.is_hr_or_admin());

-- ==========================================================================
-- 23. evaluation_scores
-- ==========================================================================
alter table public.evaluation_scores enable row level security;

create policy scores_select on public.evaluation_scores
  for select to authenticated
  using (
    evaluation_id in (
      select e.id from public.evaluations e
      where e.internship_id = any (public.get_my_internship_ids())
         or e.reviewer_id = auth.uid()
         or public.is_mentor_of_internship(e.internship_id)
         or public.is_hr_or_admin()
    )
  );

create policy scores_insert_mentor_hr on public.evaluation_scores
  for insert to authenticated
  with check (
    evaluation_id in (
      select e.id from public.evaluations e
      where public.is_hr_or_admin()
         or public.is_mentor_of_internship(e.internship_id)
    )
  );

create policy scores_update_mentor_hr on public.evaluation_scores
  for update to authenticated
  using (
    evaluation_id in (
      select e.id from public.evaluations e
      where public.is_hr_or_admin()
         or public.is_mentor_of_internship(e.internship_id)
    )
  )
  with check (
    evaluation_id in (
      select e.id from public.evaluations e
      where public.is_hr_or_admin()
         or public.is_mentor_of_internship(e.internship_id)
    )
  );

create policy scores_delete_hr on public.evaluation_scores
  for delete to authenticated using (public.is_hr_or_admin());

-- ==========================================================================
-- 24. certificates
-- ==========================================================================
alter table public.certificates enable row level security;

create policy certificates_select_self on public.certificates
  for select to authenticated using (intern_id = public.get_my_intern_id());

create policy certificates_select_mentor on public.certificates
  for select to authenticated using (public.is_mentor_of_intern(intern_id));

create policy certificates_select_hr_admin on public.certificates
  for select to authenticated using (public.is_hr_or_admin());

create policy certificates_insert_hr_admin on public.certificates
  for insert to authenticated with check (public.is_hr_or_admin());

create policy certificates_update_hr_admin on public.certificates
  for update to authenticated
  using (public.is_hr_or_admin()) with check (public.is_hr_or_admin());

create policy certificates_delete_hr_admin on public.certificates
  for delete to authenticated using (public.is_hr_or_admin());

-- ==========================================================================
-- 25. notifications
-- ==========================================================================
alter table public.notifications enable row level security;

create policy notifications_select_self on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy notifications_insert_user on public.notifications
  -- Intern chỉ ghi thông báo cho chính mình; mentor/admin/hr tạo cho người khác.
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.is_hr_or_admin()
    or (public.get_my_role() = 'mentor' and public.is_mentor_of(user_id))
  );

create policy notifications_update_self on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notifications_delete_self on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ==========================================================================
-- 26. notification_devices
-- ==========================================================================
alter table public.notification_devices enable row level security;

create policy devices_all_self on public.notification_devices
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ==========================================================================
-- 27. audit_logs (chỉ admin đọc; ghi qua trigger security definer)
-- ==========================================================================
alter table public.audit_logs enable row level security;

create policy audit_select_admin on public.audit_logs
  for select to authenticated using (public.is_admin());

-- ==========================================================================
-- 28. system_settings
-- ==========================================================================
alter table public.system_settings enable row level security;

create policy settings_select_authenticated on public.system_settings
  for select to authenticated using (true);

create policy settings_write_admin on public.system_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());