create or replace function public.get_my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select r.code
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid()
    and p.is_active = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_my_role() = 'admin';
$$;

create or replace function public.is_hr_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_my_role() in ('hr', 'admin');
$$;

create or replace function public.get_my_intern_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select i.id
  from public.interns i
  where i.user_id = auth.uid()
    and i.deleted_at is null
  order by i.created_at
  limit 1;
$$;

create or replace function public.get_my_internship_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(ip.id), '{}'::uuid[])
  from public.internships ip
  where ip.intern_id = public.get_my_intern_id()
    and ip.deleted_at is null;
$$;

create or replace function public.is_mentor_of_intern(p_intern_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_my_role() = 'mentor'
    and exists (
      select 1
      from public.internships ip
      join public.mentors m on m.id = ip.mentor_id
      where ip.intern_id = p_intern_id
        and ip.deleted_at is null
        and m.deleted_at is null
        and m.is_active = true
        and m.user_id = auth.uid()
    );
$$;

create or replace function public.is_mentor_of(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_my_role() = 'mentor'
    and exists (
      select 1
      from public.interns i
      join public.internships ip on ip.intern_id = i.id
      join public.mentors m on m.id = ip.mentor_id
      where i.user_id = target_user_id
        and i.deleted_at is null
        and ip.deleted_at is null
        and m.deleted_at is null
        and m.is_active = true
        and m.user_id = auth.uid()
    );
$$;

create or replace function public.is_mentor_of_internship(p_internship_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_my_role() = 'mentor'
    and exists (
      select 1
      from public.internships ip
      join public.mentors m on m.id = ip.mentor_id
      where ip.id = p_internship_id
        and ip.deleted_at is null
        and m.deleted_at is null
        and m.is_active = true
        and m.user_id = auth.uid()
    );
$$;

create or replace function public.existing_profile_role_id(p_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select role_id from public.profiles where id = p_id;
$$;

create or replace function public.existing_profile_is_active(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select is_active from public.profiles where id = p_id;
$$;

create or replace function public.existing_intern_status(p_id uuid)
returns public.intern_status
language sql
stable
security definer
set search_path = ''
as $$
  select status from public.interns where id = p_id;
$$;

create or replace function public.existing_intern_deleted_at(p_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select deleted_at from public.interns where id = p_id;
$$;

revoke all on function public.existing_profile_role_id(uuid) from public, anon, authenticated;
revoke all on function public.existing_profile_is_active(uuid) from public, anon, authenticated;
revoke all on function public.existing_intern_status(uuid) from public, anon, authenticated;
revoke all on function public.existing_intern_deleted_at(uuid) from public, anon, authenticated;
grant execute on function public.existing_profile_role_id(uuid) to authenticated;
grant execute on function public.existing_profile_is_active(uuid) to authenticated;
grant execute on function public.existing_intern_status(uuid) to authenticated;
grant execute on function public.existing_intern_deleted_at(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from public.interns
    where user_id is not null and deleted_at is null
    group by user_id
    having count(*) > 1
  ) then
    create unique index if not exists interns_one_active_profile_idx
      on public.interns (user_id)
      where user_id is not null and deleted_at is null;
  end if;

  if not exists (
    select 1
    from public.mentors
    where user_id is not null and deleted_at is null
    group by user_id
    having count(*) > 1
  ) then
    create unique index if not exists mentors_one_active_profile_idx
      on public.mentors (user_id)
      where user_id is not null and deleted_at is null;
  end if;
end;
$$;

create or replace function public.enforce_single_active_intern_profile()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is not null
    and new.deleted_at is null
    and exists (
      select 1
      from public.interns i
      where i.id <> new.id
        and i.user_id = new.user_id
        and i.deleted_at is null
    ) then
    raise exception 'INTERN_PROFILE_ALREADY_LINKED' using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_interns_single_profile on public.interns;
create trigger trg_interns_single_profile
  before insert or update of user_id, deleted_at on public.interns
  for each row execute function public.enforce_single_active_intern_profile();

create or replace function public.enforce_single_active_mentor_profile()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is not null
    and new.deleted_at is null
    and exists (
      select 1
      from public.mentors m
      where m.id <> new.id
        and m.user_id = new.user_id
        and m.deleted_at is null
    ) then
    raise exception 'MENTOR_PROFILE_ALREADY_LINKED' using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mentors_single_profile on public.mentors;
create trigger trg_mentors_single_profile
  before insert or update of user_id, deleted_at on public.mentors
  for each row execute function public.enforce_single_active_mentor_profile();

drop policy if exists onboarding_records_insert on public.onboarding_records;
revoke insert, update on public.onboarding_records from authenticated;
revoke delete on public.onboarding_documents, public.onboarding_document_versions from authenticated;

create or replace function public.prepare_onboarding_record_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'not_started' or new.progress_percent <> 0 then
    raise exception 'INVALID_INITIAL_ONBOARDING_STATUS' using errcode = '23514';
  end if;
  if new.completed_at is not null or new.completed_by is not null
    or new.cancelled_at is not null or new.cancelled_by is not null then
    raise exception 'INVALID_INITIAL_ONBOARDING_APPROVAL' using errcode = '23514';
  end if;
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end;
$$;

drop trigger if exists trg_onboarding_record_insert_guard on public.onboarding_records;
create trigger trg_onboarding_record_insert_guard
  before insert on public.onboarding_records
  for each row execute function public.prepare_onboarding_record_insert();

create or replace function public.prepare_onboarding_checklist_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'not_started' then
    raise exception 'INVALID_INITIAL_CHECKLIST_STATUS' using errcode = '23514';
  end if;
  if new.completed_at is not null or new.completed_by is not null
    or new.reviewed_at is not null or new.reviewed_by is not null then
    raise exception 'INVALID_INITIAL_CHECKLIST_APPROVAL' using errcode = '23514';
  end if;
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end;
$$;

drop trigger if exists trg_onboarding_checklist_insert_guard on public.onboarding_checklist_items;
create trigger trg_onboarding_checklist_insert_guard
  before insert on public.onboarding_checklist_items
  for each row execute function public.prepare_onboarding_checklist_insert();

create or replace function public.prepare_onboarding_document_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'not_submitted' then
    raise exception 'INVALID_INITIAL_DOCUMENT_STATUS' using errcode = '23514';
  end if;
  if new.submitted_at is not null or new.submitted_by is not null
    or new.reviewed_at is not null or new.reviewed_by is not null then
    raise exception 'INVALID_INITIAL_DOCUMENT_APPROVAL' using errcode = '23514';
  end if;
  if new.due_date is not null and new.due_date < (
    select onboarding_start_date from public.onboarding_records where id = new.onboarding_id
  ) then
    raise exception 'DOCUMENT_DUE_DATE_INVALID' using errcode = '23514';
  end if;
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end;
$$;

drop trigger if exists trg_onboarding_document_insert_guard on public.onboarding_documents;
create trigger trg_onboarding_document_insert_guard
  before insert on public.onboarding_documents
  for each row execute function public.prepare_onboarding_document_insert();

create or replace function public.sync_onboarding_assignments_from_intern_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null
    and new.user_id is distinct from old.user_id then
    update public.onboarding_checklist_items i
    set assigned_to = new.user_id,
        performer_id = new.user_id
    where i.onboarding_id in (
      select r.id
      from public.onboarding_records r
      join public.internships ip on ip.id = r.internship_id
      where ip.intern_id = new.id
        and r.status not in ('completed', 'cancelled')
    )
      and (i.assigned_to is null or i.assigned_to = old.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_onboarding_intern_profile on public.interns;
create trigger trg_sync_onboarding_intern_profile
  after update of user_id on public.interns
  for each row execute function public.sync_onboarding_assignments_from_intern_profile();

drop policy if exists profiles_update_self_limited on public.profiles;
create policy profiles_update_self_limited on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and email is not distinct from public.existing_email(id)
    and role_id is not distinct from public.existing_profile_role_id(id)
    and is_active is not distinct from public.existing_profile_is_active(id)
  );

drop policy if exists interns_update_self on public.interns;
create policy interns_update_self on public.interns
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and email is not distinct from public.existing_interne_mail(id)
    and student_code is not distinct from public.existing_student_code(id)
    and status is not distinct from public.existing_intern_status(id)
    and deleted_at is not distinct from public.existing_intern_deleted_at(id)
  );

create or replace function public.enforce_self_profile_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() = old.id and public.get_my_role() = 'intern' then
    if (to_jsonb(new) - array[
      'updated_at', 'full_name', 'phone', 'birth_date', 'address', 'avatar_path'
    ]) is distinct from (to_jsonb(old) - array[
      'updated_at', 'full_name', 'phone', 'birth_date', 'address', 'avatar_path'
    ]) then
      raise exception 'PROFILE_FIELD_NOT_EDITABLE' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_self_update_guard on public.profiles;
create trigger trg_profiles_self_update_guard
  before update on public.profiles
  for each row execute function public.enforce_self_profile_update();

create or replace function public.enforce_self_intern_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.user_id = auth.uid() and public.get_my_role() = 'intern' then
    if (to_jsonb(new) - array[
      'updated_at', 'full_name', 'phone', 'gender', 'birth_date', 'address',
      'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_email'
    ]) is distinct from (to_jsonb(old) - array[
      'updated_at', 'full_name', 'phone', 'gender', 'birth_date', 'address',
      'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_email'
    ]) then
      raise exception 'INTERN_FIELD_NOT_EDITABLE' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_interns_self_update_guard on public.interns;
create trigger trg_interns_self_update_guard
  before update on public.interns
  for each row execute function public.enforce_self_intern_update();

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_document_types_updated on public.onboarding_document_types;
create trigger trg_document_types_updated before update on public.onboarding_document_types
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_onboarding_templates_updated on public.onboarding_checklist_templates;
create trigger trg_onboarding_templates_updated before update on public.onboarding_checklist_templates
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_onboarding_template_items_updated on public.onboarding_checklist_template_items;
create trigger trg_onboarding_template_items_updated before update on public.onboarding_checklist_template_items
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_onboarding_records_updated on public.onboarding_records;
create trigger trg_onboarding_records_updated before update on public.onboarding_records
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_checklists_updated on public.onboarding_checklist_items;
create trigger trg_checklists_updated before update on public.onboarding_checklist_items
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_onboarding_documents_updated on public.onboarding_documents;
create trigger trg_onboarding_documents_updated before update on public.onboarding_documents
  for each row execute function public.handle_updated_at();

create or replace function public.log_onboarding_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_onboarding_id uuid;
  v_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'DELETE' then
    if tg_table_name = 'onboarding_records' then
      return old;
    end if;
    v_onboarding_id := old.onboarding_id;
    v_entity_id := old.id;
    v_old := to_jsonb(old);
    v_new := null;
  else
    if tg_table_name = 'onboarding_records' then
      v_onboarding_id := new.id;
    else
      v_onboarding_id := new.onboarding_id;
    end if;
    v_entity_id := new.id;
    v_new := to_jsonb(new);
    if tg_op = 'UPDATE' then
      v_old := to_jsonb(old);
      if (v_old - 'updated_at') = (v_new - 'updated_at') then
        return new;
      end if;
    end if;
  end if;

  if v_onboarding_id is null then
    return coalesce(new, old);
  end if;

  if exists (select 1 from public.onboarding_records where id = v_onboarding_id) then
    insert into public.onboarding_activity_logs (
      onboarding_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      details
    )
    values (
      v_onboarding_id,
      auth.uid(),
      lower(tg_op),
      tg_table_name,
      v_entity_id,
      jsonb_strip_nulls(jsonb_build_object('before', v_old, 'after', v_new))
    );
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_onboarding_activity_record on public.onboarding_records;
create trigger trg_onboarding_activity_record
  after insert or update or delete on public.onboarding_records
  for each row execute function public.log_onboarding_activity();

drop trigger if exists trg_onboarding_activity_checklist on public.onboarding_checklist_items;
create trigger trg_onboarding_activity_checklist
  after insert or update or delete on public.onboarding_checklist_items
  for each row execute function public.log_onboarding_activity();

drop trigger if exists trg_onboarding_activity_document on public.onboarding_documents;
create trigger trg_onboarding_activity_document
  after insert or update or delete on public.onboarding_documents
  for each row execute function public.log_onboarding_activity();

create or replace function public.insert_onboarding_notification(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_data jsonb,
  p_dedupe_key text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.notifications (user_id, type, title, body, data, dedupe_key)
  values (p_user_id, p_type, p_title, p_body, p_data, p_dedupe_key)
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
end;
$$;

revoke all on function public.insert_onboarding_notification(uuid, public.notification_type, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.insert_onboarding_notification(uuid, public.notification_type, text, text, jsonb, text) to service_role;

create or replace function public.onboarding_intern_user(p_onboarding_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select i.user_id
  from public.onboarding_records r
  join public.internships ip on ip.id = r.internship_id
  join public.interns i on i.id = ip.intern_id
  where r.id = p_onboarding_id
    and i.deleted_at is null;
$$;

create or replace function public.onboarding_mentor_user(p_onboarding_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id
  from public.onboarding_records r
  join public.mentors m on m.id = r.mentor_id
  where r.id = p_onboarding_id
    and m.deleted_at is null
    and m.is_active = true;
$$;

revoke all on function public.onboarding_intern_user(uuid) from public, anon, authenticated;
revoke all on function public.onboarding_mentor_user(uuid) from public, anon, authenticated;
grant execute on function public.onboarding_intern_user(uuid) to service_role;
grant execute on function public.onboarding_mentor_user(uuid) to service_role;

create or replace function public.enforce_onboarding_record_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.internship_id is distinct from old.internship_id
    or new.batch_id is distinct from old.batch_id
    or new.code is distinct from old.code then
    raise exception 'ONBOARDING_IDENTITY_IMMUTABLE' using errcode = '42501';
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
  elsif new.status is distinct from 'cancelled' then
    new.cancelled_at := null;
    new.cancelled_by := null;
  end if;

  if tg_op = 'UPDATE' and new.status = 'completed' and old.status is distinct from 'completed' then
    if old.status is distinct from 'pending_review' then
      raise exception 'ONBOARDING_NOT_PENDING_REVIEW' using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.onboarding_checklist_items i
      where i.onboarding_id = old.id
        and i.is_required = true
        and i.status is distinct from 'completed'
    ) then
      raise exception 'REQUIRED_CHECKLIST_INCOMPLETE' using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.onboarding_documents d
      where d.onboarding_id = old.id
        and d.is_required = true
        and d.status is distinct from 'approved'
    ) then
      raise exception 'REQUIRED_DOCUMENT_NOT_APPROVED' using errcode = '23514';
    end if;

    new.completed_at := coalesce(new.completed_at, now());
    new.completed_by := coalesce(new.completed_by, auth.uid());
  elsif new.status is distinct from 'completed' then
    new.completed_at := null;
    new.completed_by := null;
  elsif old.completed_by is distinct from new.completed_by then
    raise exception 'ONBOARDING_COMPLETER_IMMUTABLE' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_onboarding_record_guard on public.onboarding_records;
create trigger trg_onboarding_record_guard
  before update on public.onboarding_records
  for each row execute function public.enforce_onboarding_record_update();

create or replace function public.enforce_onboarding_checklist_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.onboarding_id is distinct from old.onboarding_id then
    raise exception 'CHECKLIST_ONBOARDING_IMMUTABLE' using errcode = '42501';
  end if;

  if old.completed_by is not null and new.completed_by is distinct from old.completed_by then
    raise exception 'CHECKLIST_COMPLETER_IMMUTABLE' using errcode = '42501';
  end if;

  if new.status = 'needs_revision' and nullif(trim(new.feedback), '') is null then
    raise exception 'CHECKLIST_FEEDBACK_REQUIRED' using errcode = '23514';
  end if;

  if new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
    new.completed_by := coalesce(new.completed_by, auth.uid());
    if new.review_required then
      new.reviewed_at := coalesce(new.reviewed_at, now());
      new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
    end if;
  else
    new.completed_at := null;
    new.completed_by := null;
  end if;

  if new.status = 'in_progress' then
    new.started_at := coalesce(new.started_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_onboarding_checklist_guard on public.onboarding_checklist_items;
create trigger trg_onboarding_checklist_guard
  before update on public.onboarding_checklist_items
  for each row execute function public.enforce_onboarding_checklist_update();

create or replace function public.enforce_onboarding_document_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.onboarding_id is distinct from old.onboarding_id then
    raise exception 'DOCUMENT_ONBOARDING_IMMUTABLE' using errcode = '42501';
  end if;

  if new.due_date is not null and new.due_date < (
    select onboarding_start_date from public.onboarding_records where id = new.onboarding_id
  ) then
    raise exception 'DOCUMENT_DUE_DATE_INVALID' using errcode = '23514';
  end if;

  if new.status = 'needs_revision' and nullif(trim(new.feedback), '') is null then
    raise exception 'DOCUMENT_FEEDBACK_REQUIRED' using errcode = '23514';
  end if;

  if new.status = 'approved' then
    new.reviewed_at := coalesce(new.reviewed_at, now());
    new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
    new.reviewed_version_id := new.current_version_id;
  end if;

  if new.status in ('pending_review', 'needs_revision', 'approved') then
    if new.current_version_id is null or not exists (
      select 1
      from public.onboarding_document_versions v
      where v.id = new.current_version_id
        and v.document_id = new.id
    ) then
      raise exception 'DOCUMENT_VERSION_INVALID' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_onboarding_document_guard on public.onboarding_documents;
create trigger trg_onboarding_document_guard
  before update on public.onboarding_documents
  for each row execute function public.enforce_onboarding_document_update();

create or replace function public.lock_onboarding_for_child_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_onboarding_id uuid;
  v_status public.onboarding_record_status;
begin
  v_onboarding_id := case when tg_op = 'DELETE' then old.onboarding_id else new.onboarding_id end;
  if v_onboarding_id is null then
    return coalesce(new, old);
  end if;

  select status into v_status
  from public.onboarding_records
  where id = v_onboarding_id
  for update;

  if v_status in ('completed', 'cancelled') then
    raise exception 'ONBOARDING_LOCKED' using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_onboarding_checklist_lock on public.onboarding_checklist_items;
create trigger trg_onboarding_checklist_lock
  before insert or update or delete on public.onboarding_checklist_items
  for each row execute function public.lock_onboarding_for_child_mutation();

drop trigger if exists trg_onboarding_document_lock on public.onboarding_documents;
create trigger trg_onboarding_document_lock
  before insert or update or delete on public.onboarding_documents
  for each row execute function public.lock_onboarding_for_child_mutation();

create or replace function public.refresh_onboarding_record(p_onboarding_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_required_tasks integer;
  v_completed_tasks integer;
  v_required_documents integer;
  v_approved_documents integer;
  v_progress integer;
  v_has_checklist_activity boolean;
  v_has_document_activity boolean;
  v_has_activity boolean;
  v_has_checklist_revision boolean;
  v_has_document_revision boolean;
  v_needs_revision boolean;
  v_next_status public.onboarding_record_status;
  v_current_status public.onboarding_record_status;
  v_current_started_at timestamptz;
  v_started_at timestamptz;
begin
  if p_onboarding_id is null then
    return;
  end if;

  select status, started_at
  into v_current_status, v_current_started_at
  from public.onboarding_records
  where id = p_onboarding_id
  for update;

  if not found or v_current_status in ('completed', 'cancelled') then
    return;
  end if;

  select
    count(*) filter (where is_required),
    count(*) filter (where is_required and status = 'completed'),
    coalesce(bool_or(status <> 'not_started'), false),
    coalesce(bool_or(is_required and status = 'needs_revision'), false)
  into v_required_tasks, v_completed_tasks, v_has_checklist_activity, v_has_checklist_revision
  from public.onboarding_checklist_items
  where onboarding_id = p_onboarding_id;

  select
    count(*) filter (where is_required),
    count(*) filter (where is_required and status = 'approved'),
    coalesce(bool_or(status <> 'not_submitted'), false),
    coalesce(bool_or(is_required and status = 'needs_revision'), false)
  into v_required_documents, v_approved_documents, v_has_document_activity, v_has_document_revision
  from public.onboarding_documents
  where onboarding_id = p_onboarding_id;

  v_has_activity := coalesce(v_has_checklist_activity, false) or coalesce(v_has_document_activity, false);
  v_needs_revision := coalesce(v_has_checklist_revision, false) or coalesce(v_has_document_revision, false);
  v_progress := case
    when coalesce(v_required_tasks, 0) = 0 then 0
    else least(100, floor(100.0 * v_completed_tasks / v_required_tasks)::integer)
  end;

  v_next_status := case
    when v_needs_revision then 'needs_revision'::public.onboarding_record_status
    when (
      v_completed_tasks = v_required_tasks
      and v_approved_documents = v_required_documents
    ) then 'pending_review'::public.onboarding_record_status
    when v_has_activity then 'in_progress'::public.onboarding_record_status
    else 'not_started'::public.onboarding_record_status
  end;

  v_started_at := case
    when v_next_status = 'not_started' then null
    else coalesce(v_current_started_at, now())
  end;

  update public.onboarding_records
  set progress_percent = v_progress,
      status = v_next_status,
      started_at = v_started_at
  where id = p_onboarding_id
    and status not in ('completed', 'cancelled')
    and (
      progress_percent is distinct from v_progress
      or status is distinct from v_next_status
      or started_at is distinct from v_started_at
    );
end;
$$;

revoke all on function public.refresh_onboarding_record(uuid) from public, anon, authenticated;
grant execute on function public.refresh_onboarding_record(uuid) to service_role;

create or replace function public.tg_refresh_onboarding_from_checklist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_onboarding_record(old.onboarding_id);
    return old;
  end if;
  perform public.refresh_onboarding_record(new.onboarding_id);
  return new;
end;
$$;

drop trigger if exists trg_refresh_onboarding_checklist on public.onboarding_checklist_items;
create trigger trg_refresh_onboarding_checklist
  after insert or update or delete on public.onboarding_checklist_items
  for each row execute function public.tg_refresh_onboarding_from_checklist();

create or replace function public.tg_refresh_onboarding_from_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_onboarding_record(old.onboarding_id);
    return old;
  end if;
  perform public.refresh_onboarding_record(new.onboarding_id);
  return new;
end;
$$;

drop trigger if exists trg_refresh_onboarding_document on public.onboarding_documents;
create trigger trg_refresh_onboarding_document
  after insert or update or delete on public.onboarding_documents
  for each row execute function public.tg_refresh_onboarding_from_document();

create or replace function public.create_onboarding_record(
  p_internship_id uuid,
  p_onboarding_start_date date,
  p_due_date date,
  p_assigned_hr_id uuid default null,
  p_template_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_internship public.internships%rowtype;
  v_intern_user uuid;
  v_intern_status public.intern_status;
  v_batch_status public.internship_status;
  v_mentor_user uuid;
  v_assigned_hr_id uuid;
  v_template_id uuid;
  v_onboarding_id uuid;
  v_code text;
  v_item public.onboarding_checklist_template_items%rowtype;
  v_assigned_to uuid;
  v_item_due_date date;
begin
  if public.is_hr_or_admin() is not true then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if p_onboarding_start_date is null or p_due_date is null or p_due_date < p_onboarding_start_date then
    raise exception 'INVALID_ONBOARDING_DATES' using errcode = '23514';
  end if;

  select * into v_internship
  from public.internships
  where id = p_internship_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'INTERNSHIP_NOT_FOUND';
  end if;

  if v_internship.status <> 'upcoming' then
    raise exception 'INTERNSHIP_NOT_ONBOARDABLE' using errcode = '23514';
  end if;

  select i.status into v_intern_status
  from public.interns i
  where i.id = v_internship.intern_id
    and i.deleted_at is null;

  if not found or v_intern_status in ('cancelled', 'completed', 'converted') then
    raise exception 'INTERN_NOT_ONBOARDABLE' using errcode = '23514';
  end if;

  select b.status into v_batch_status
  from public.internship_batches b
  where b.id = v_internship.batch_id
    and b.deleted_at is null;

  if not found or v_batch_status in ('completed', 'cancelled') then
    raise exception 'BATCH_NOT_ONBOARDABLE' using errcode = '23514';
  end if;

  v_intern_user := public.intern_owner(v_internship.intern_id);
  if v_intern_user is null then
    raise exception 'INTERN_ACCOUNT_NOT_LINKED' using errcode = '23514';
  end if;

  select m.user_id into v_mentor_user
  from public.mentors m
  where m.id = v_internship.mentor_id
    and m.deleted_at is null
    and m.is_active = true;

  if v_internship.mentor_id is not null and v_mentor_user is null and exists (
    select 1 from public.mentors where id = v_internship.mentor_id
  ) then
    raise exception 'MENTOR_NOT_ONBOARDABLE' using errcode = '23514';
  end if;

  if v_internship.department_id is not null and not exists (
    select 1
    from public.departments
    where id = v_internship.department_id
      and is_active = true
      and deleted_at is null
  ) then
    raise exception 'DEPARTMENT_NOT_ONBOARDABLE' using errcode = '23514';
  end if;

  v_assigned_hr_id := coalesce(p_assigned_hr_id, auth.uid());
  if not exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = v_assigned_hr_id
      and p.is_active = true
      and r.code in ('hr', 'admin')
  ) then
    raise exception 'INVALID_ASSIGNED_HR' using errcode = '23514';
  end if;

  select coalesce(p_template_id, id) into v_template_id
  from public.onboarding_checklist_templates
  where (id = p_template_id and is_active = true)
     or (p_template_id is null and is_default = true and is_active = true)
  order by (id = p_template_id) desc nulls last
  limit 1;

  if v_template_id is null then
    raise exception 'ONBOARDING_TEMPLATE_NOT_FOUND';
  end if;

  v_code := 'ONB-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(nextval('public.onboarding_record_code_seq')::text, 6, '0');

  if exists (
    select 1 from public.onboarding_records where internship_id = v_internship.id
  ) then
    raise exception 'ONBOARDING_RECORD_EXISTS' using errcode = '23505';
  end if;

  insert into public.onboarding_records (
    code,
    internship_id,
    batch_id,
    department_id,
    mentor_id,
    assigned_hr_id,
    start_date,
    end_date,
    onboarding_start_date,
    due_date,
    notes,
    created_by
  )
  values (
    v_code,
    v_internship.id,
    v_internship.batch_id,
    v_internship.department_id,
    v_internship.mentor_id,
    v_assigned_hr_id,
    v_internship.start_date,
    v_internship.end_date,
    p_onboarding_start_date,
    p_due_date,
    nullif(trim(p_notes), ''),
    auth.uid()
  )
  returning id into v_onboarding_id;

  update public.interns
  set status = 'onboarding'
  where id = v_internship.intern_id
    and status = 'pending';

  for v_item in
    select *
    from public.onboarding_checklist_template_items
    where template_id = v_template_id
    order by sort_order, created_at
  loop
    v_assigned_to := case v_item.default_assignee_role
      when 'intern' then v_intern_user
      when 'hr' then v_assigned_hr_id
      when 'mentor' then v_mentor_user
      else null
    end;

    v_item_due_date := case
      when v_item.due_offset_days is null then p_due_date
      else least(p_due_date, p_onboarding_start_date + v_item.due_offset_days)
    end;

    insert into public.onboarding_checklist_items (
      onboarding_id,
      template_item_id,
      title,
      description,
      category,
      is_required,
      sort_order,
      start_date,
      due_date,
      assigned_to,
      performer_id,
      review_required,
      guide_document_id,
      created_by
    )
    values (
      v_onboarding_id,
      v_item.id,
      v_item.title,
      v_item.description,
      v_item.category,
      v_item.is_required,
      v_item.sort_order,
      p_onboarding_start_date,
      v_item_due_date,
      v_assigned_to,
      v_assigned_to,
      v_item.default_assignee_role is distinct from 'mentor',
      v_item.guide_document_id,
      auth.uid()
    );
  end loop;

  perform public.refresh_onboarding_record(v_onboarding_id);

  return v_onboarding_id;
end;
$$;

revoke all on function public.create_onboarding_record(uuid, date, date, uuid, uuid, text) from public, anon;
grant execute on function public.create_onboarding_record(uuid, date, date, uuid, uuid, text) to authenticated;

create or replace function public.update_onboarding_record(
  p_onboarding_id uuid,
  p_assigned_hr_id uuid,
  p_start_date date,
  p_end_date date,
  p_onboarding_start_date date,
  p_due_date date,
  p_department_id uuid,
  p_mentor_id uuid,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record public.onboarding_records%rowtype;
  v_old_mentor_user uuid;
  v_new_mentor_user uuid;
  v_date_shift integer;
begin
  select * into v_record
  from public.onboarding_records
  where id = p_onboarding_id
  for update;

  if not found then
    raise exception 'ONBOARDING_NOT_FOUND';
  end if;

  if not public.can_manage_onboarding(p_onboarding_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if v_record.status = 'cancelled' then
    raise exception 'ONBOARDING_NOT_EDITABLE';
  end if;

  if v_record.status = 'completed'
    and (
      p_department_id,
      p_mentor_id,
      p_start_date,
      p_end_date,
      p_onboarding_start_date,
      p_due_date
    ) is distinct from (
      v_record.department_id,
      v_record.mentor_id,
      v_record.start_date,
      v_record.end_date,
      v_record.onboarding_start_date,
      v_record.due_date
    ) then
    raise exception 'ONBOARDING_LOCKED' using errcode = '23514';
  end if;

  select m.user_id into v_old_mentor_user
  from public.mentors m
  where m.id = v_record.mentor_id;

  select m.user_id into v_new_mentor_user
  from public.mentors m
  where m.id = p_mentor_id;

  if p_onboarding_start_date is null or p_due_date is null or p_due_date < p_onboarding_start_date then
    raise exception 'INVALID_ONBOARDING_DATES' using errcode = '23514';
  end if;

  if p_end_date is not null and p_start_date is not null and p_end_date < p_start_date then
    raise exception 'INVALID_INTERNSHIP_DATES' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = p_assigned_hr_id
      and p.is_active = true
      and r.code in ('hr', 'admin')
  ) then
    raise exception 'INVALID_ASSIGNED_HR' using errcode = '23514';
  end if;

  if p_department_id is not null and not exists (
    select 1 from public.departments
    where id = p_department_id and is_active = true and deleted_at is null
  ) then
    raise exception 'INVALID_DEPARTMENT' using errcode = '23514';
  end if;

  if p_mentor_id is not null and not exists (
    select 1
    from public.mentors
    where id = p_mentor_id
      and is_active = true
      and deleted_at is null
      and (department_id is null or p_department_id is null or department_id = p_department_id)
  ) then
    raise exception 'INVALID_MENTOR' using errcode = '23514';
  end if;

  update public.internships
  set department_id = p_department_id,
      mentor_id = p_mentor_id,
      start_date = p_start_date,
      end_date = p_end_date
  where id = v_record.internship_id;

  update public.onboarding_records
  set assigned_hr_id = p_assigned_hr_id,
      department_id = p_department_id,
      mentor_id = p_mentor_id,
      start_date = p_start_date,
      end_date = p_end_date,
      onboarding_start_date = p_onboarding_start_date,
      due_date = p_due_date,
      notes = nullif(trim(p_notes), '')
  where id = p_onboarding_id;

  if v_record.status <> 'completed'
    and v_old_mentor_user is not null
    and v_old_mentor_user is distinct from v_new_mentor_user then
    update public.onboarding_checklist_items
    set assigned_to = v_new_mentor_user,
        performer_id = v_new_mentor_user
    where onboarding_id = p_onboarding_id
      and assigned_to = v_old_mentor_user;
  end if;

  if v_record.status <> 'completed' then
    v_date_shift := p_onboarding_start_date - v_record.onboarding_start_date;

    update public.onboarding_checklist_items
    set due_date = least(p_due_date, due_date + v_date_shift)
    where onboarding_id = p_onboarding_id
      and due_date is not null;

    update public.onboarding_checklist_items i
    set due_date = least(p_due_date, p_onboarding_start_date + t.due_offset_days)
    from public.onboarding_checklist_template_items t
    where i.onboarding_id = p_onboarding_id
      and i.template_item_id = t.id
      and t.due_offset_days is not null;

    update public.onboarding_documents
    set due_date = least(p_due_date, due_date + v_date_shift)
    where onboarding_id = p_onboarding_id
      and due_date is not null;
  end if;
end;
$$;

revoke all on function public.update_onboarding_record(uuid, uuid, date, date, date, date, uuid, uuid, text) from public, anon;
grant execute on function public.update_onboarding_record(uuid, uuid, date, date, date, date, uuid, uuid, text) to authenticated;

create or replace function public.sync_onboarding_record_from_internship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_mentor_user uuid;
  v_new_mentor_user uuid;
  v_onboarding_id uuid;
  v_onboarding_status public.onboarding_record_status;
begin
  if (new.intern_id, new.batch_id) is distinct from (old.intern_id, old.batch_id)
    and exists (
      select 1 from public.onboarding_records where internship_id = old.id
    ) then
    raise exception 'ONBOARDING_INTERNSHIP_IDENTITY_IMMUTABLE' using errcode = '42501';
  end if;

  select id, status into v_onboarding_id, v_onboarding_status
  from public.onboarding_records
  where internship_id = new.id
  limit 1;

  if v_onboarding_id is null then
    return new;
  end if;

  if not public.can_manage_onboarding(v_onboarding_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if v_onboarding_status = 'completed'
    and (new.department_id, new.mentor_id, new.start_date, new.end_date)
      is distinct from (old.department_id, old.mentor_id, old.start_date, old.end_date) then
    raise exception 'ONBOARDING_LOCKED' using errcode = '23514';
  end if;

  if v_onboarding_status = 'cancelled'
    and (new.department_id, new.mentor_id, new.start_date, new.end_date)
      is distinct from (old.department_id, old.mentor_id, old.start_date, old.end_date) then
    raise exception 'ONBOARDING_LOCKED' using errcode = '23514';
  end if;

  select m.user_id into v_old_mentor_user
  from public.mentors m
  where m.id = old.mentor_id;
  select m.user_id into v_new_mentor_user
  from public.mentors m
  where m.id = new.mentor_id;

  update public.onboarding_records
  set department_id = new.department_id,
      mentor_id = new.mentor_id,
      start_date = new.start_date,
      end_date = new.end_date
  where id = v_onboarding_id
    and status <> 'cancelled';

  if v_old_mentor_user is not null
    and v_old_mentor_user is distinct from v_new_mentor_user then
    update public.onboarding_checklist_items i
    set assigned_to = v_new_mentor_user,
        performer_id = v_new_mentor_user
    where i.onboarding_id in (
      select id from public.onboarding_records
      where internship_id = new.id
        and status not in ('completed', 'cancelled')
    )
      and i.assigned_to = v_old_mentor_user;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_onboarding_from_internship on public.internships;
create trigger trg_sync_onboarding_from_internship
  after update of intern_id, batch_id, department_id, mentor_id, start_date, end_date on public.internships
  for each row execute function public.sync_onboarding_record_from_internship();

create or replace function public.submit_onboarding_checklist_item(
  p_item_id uuid,
  p_status public.onboarding_checklist_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.onboarding_checklist_items%rowtype;
  v_role public.user_role;
begin
  v_role := public.get_my_role();

  select i.* into v_item
  from public.onboarding_checklist_items i
  join public.onboarding_records r on r.id = i.onboarding_id
  where i.id = p_item_id
    and public.can_read_onboarding(i.onboarding_id)
    and r.status not in ('completed', 'cancelled')
    and (i.assigned_to = auth.uid() or i.performer_id = auth.uid())
  for update of i;

  if not found then
    raise exception 'CHECKLIST_NOT_ASSIGNED' using errcode = '42501';
  end if;

  if p_status is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if v_role = 'intern' and p_status not in ('in_progress', 'pending_review') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if v_role = 'mentor' then
    if v_item.review_required and p_status not in ('in_progress', 'pending_review') then
      raise exception 'PERMISSION_DENIED' using errcode = '42501';
    end if;
    if not v_item.review_required and p_status not in ('in_progress', 'completed') then
      raise exception 'PERMISSION_DENIED' using errcode = '42501';
    end if;
  end if;

  if v_role is null or v_role not in ('intern', 'mentor') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if v_item.status = 'completed' then
    raise exception 'CHECKLIST_ALREADY_COMPLETED';
  end if;

  update public.onboarding_checklist_items
  set status = p_status,
      reviewed_by = case when p_status = 'pending_review' then null else reviewed_by end,
      reviewed_at = case when p_status = 'pending_review' then null else reviewed_at end,
      feedback = case when p_status = 'pending_review' then null else feedback end
  where id = p_item_id;
end;
$$;

revoke all on function public.submit_onboarding_checklist_item(uuid, public.onboarding_checklist_status) from public, anon;
grant execute on function public.submit_onboarding_checklist_item(uuid, public.onboarding_checklist_status) to authenticated;

create or replace function public.review_onboarding_checklist_item(
  p_item_id uuid,
  p_decision text,
  p_feedback text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.onboarding_checklist_items%rowtype;
begin
  select * into v_item
  from public.onboarding_checklist_items
  where id = p_item_id
  for update;

  if not found or not public.can_review_onboarding_item(p_item_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('approved', 'needs_revision') then
    raise exception 'INVALID_REVIEW_DECISION' using errcode = '23514';
  end if;

  if public.get_my_role() is distinct from 'hr'
    and public.get_my_role() is distinct from 'admin'
    and v_item.status <> 'pending_review' then
    raise exception 'CHECKLIST_NOT_PENDING_REVIEW' using errcode = '23514';
  end if;

  if p_decision = 'needs_revision' and nullif(trim(p_feedback), '') is null then
    raise exception 'REVIEW_FEEDBACK_REQUIRED' using errcode = '23514';
  end if;

  update public.onboarding_checklist_items
  set status = case
        when p_decision = 'approved' then 'completed'::public.onboarding_checklist_status
        else 'needs_revision'::public.onboarding_checklist_status
      end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      feedback = nullif(trim(p_feedback), '')
  where id = p_item_id;
end;
$$;

revoke all on function public.review_onboarding_checklist_item(uuid, text, text) from public, anon;
grant execute on function public.review_onboarding_checklist_item(uuid, text, text) to authenticated;

create or replace function public.submit_onboarding_document_version(
  p_document_id uuid,
  p_file_path text,
  p_file_name text,
  p_file_size bigint,
  p_mime_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.onboarding_documents%rowtype;
  v_version integer;
  v_version_id uuid;
  v_parts text[];
  v_stored_metadata jsonb;
  v_storage_owner_id text;
  v_stored_mime text;
  v_stored_size bigint;
begin
  select * into v_document
  from public.onboarding_documents
  where id = p_document_id
  for update;

  if not found or not public.can_submit_onboarding_document(p_document_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_parts := string_to_array(p_file_path, '/');
  if array_length(v_parts, 1) <> 5
    or v_parts[1] <> 'records'
    or v_parts[3] <> 'documents'
    or v_parts[2] <> v_document.onboarding_id::text
    or v_parts[4] <> p_document_id::text then
    raise exception 'INVALID_DOCUMENT_PATH' using errcode = '23514';
  end if;

  if p_file_size <= 0 or p_file_size > 10485760 then
    raise exception 'DOCUMENT_FILE_SIZE_INVALID' using errcode = '23514';
  end if;

  if p_mime_type not in (
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) then
    raise exception 'DOCUMENT_MIME_INVALID' using errcode = '23514';
  end if;

  select metadata, owner_id
  into v_stored_metadata, v_storage_owner_id
  from storage.objects
  where bucket_id = 'onboarding'
    and name = p_file_path
  for update;

  if not found then
    raise exception 'DOCUMENT_FILE_NOT_FOUND';
  end if;

  if v_storage_owner_id is distinct from auth.uid()::text then
    raise exception 'DOCUMENT_FILE_NOT_OWNED' using errcode = '42501';
  end if;

  v_stored_mime := nullif(v_stored_metadata ->> 'mimetype', '');
  v_stored_size := nullif(v_stored_metadata ->> 'size', '')::bigint;
  if v_stored_mime is not null and v_stored_mime <> p_mime_type then
    raise exception 'DOCUMENT_MIME_MISMATCH' using errcode = '23514';
  end if;
  if v_stored_size is not null and v_stored_size <> p_file_size then
    raise exception 'DOCUMENT_SIZE_MISMATCH' using errcode = '23514';
  end if;

  select coalesce(max(version_number), 0) + 1
  into v_version
  from public.onboarding_document_versions
  where document_id = p_document_id;

  insert into public.onboarding_document_versions (
    document_id,
    file_path,
    file_name,
    file_size,
    mime_type,
    uploaded_by,
    version_number
  )
  values (
    p_document_id,
    p_file_path,
    left(regexp_replace(p_file_name, '[^a-zA-Z0-9._ -]', '_', 'g'), 180),
    p_file_size,
    p_mime_type,
    auth.uid(),
    v_version
  )
  returning id into v_version_id;

  update public.onboarding_documents
  set status = 'pending_review',
      current_version_id = v_version_id,
      reviewed_version_id = null,
      submitted_by = auth.uid(),
      submitted_at = now(),
      reviewed_by = null,
      reviewed_at = null,
      feedback = null
  where id = p_document_id;

  return v_version_id;
end;
$$;

revoke all on function public.submit_onboarding_document_version(uuid, text, text, bigint, text) from public, anon;
grant execute on function public.submit_onboarding_document_version(uuid, text, text, bigint, text) to authenticated;

create or replace function public.review_onboarding_document(
  p_document_id uuid,
  p_version_id uuid,
  p_approved boolean,
  p_feedback text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.onboarding_documents%rowtype;
begin
  select * into v_document
  from public.onboarding_documents
  where id = p_document_id
  for update;

  if not found or not public.can_manage_onboarding(v_document.onboarding_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if p_approved is null then
    raise exception 'INVALID_REVIEW_DECISION' using errcode = '23514';
  end if;

  if not p_approved and nullif(trim(p_feedback), '') is null then
    raise exception 'REVIEW_FEEDBACK_REQUIRED' using errcode = '23514';
  end if;

  if v_document.status <> 'pending_review' or v_document.current_version_id is distinct from p_version_id then
    raise exception 'DOCUMENT_VERSION_NOT_PENDING_REVIEW' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.onboarding_document_versions v
    where v.id = p_version_id
      and v.document_id = p_document_id
  ) then
    raise exception 'DOCUMENT_VERSION_INVALID' using errcode = '23514';
  end if;

  update public.onboarding_documents
  set status = case
        when p_approved then 'approved'::public.onboarding_document_status
        else 'needs_revision'::public.onboarding_document_status
      end,
      reviewed_version_id = p_version_id,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      feedback = nullif(trim(p_feedback), '')
  where id = p_document_id;
end;
$$;

revoke all on function public.review_onboarding_document(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.review_onboarding_document(uuid, uuid, boolean, text) to authenticated;

create or replace function public.complete_onboarding(p_onboarding_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.onboarding_record_status;
begin
  select status into v_status
  from public.onboarding_records
  where id = p_onboarding_id
  for update;

  if not found then
    raise exception 'ONBOARDING_NOT_FOUND';
  end if;

  if not public.can_manage_onboarding(p_onboarding_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if v_status = 'completed' then
    return;
  end if;

  if v_status = 'cancelled' then
    raise exception 'ONBOARDING_CANCELLED';
  end if;

  if v_status is distinct from 'pending_review' then
    raise exception 'ONBOARDING_NOT_PENDING_REVIEW' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.onboarding_checklist_items
    where onboarding_id = p_onboarding_id
      and is_required
      and status is distinct from 'completed'
  ) then
    raise exception 'REQUIRED_CHECKLIST_INCOMPLETE' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.onboarding_documents
    where onboarding_id = p_onboarding_id
      and is_required
      and status is distinct from 'approved'
  ) then
    raise exception 'REQUIRED_DOCUMENT_NOT_APPROVED' using errcode = '23514';
  end if;

  update public.onboarding_records
  set status = 'completed',
      completed_at = now(),
      completed_by = auth.uid()
  where id = p_onboarding_id;
end;
$$;

revoke all on function public.complete_onboarding(uuid) from public, anon;
grant execute on function public.complete_onboarding(uuid) to authenticated;

create or replace function public.cancel_onboarding(p_onboarding_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.onboarding_record_status;
  v_intern_id uuid;
begin
  select r.status, ip.intern_id
  into v_status, v_intern_id
  from public.onboarding_records r
  join public.internships ip on ip.id = r.internship_id
  where r.id = p_onboarding_id
  for update of r;

  if not found then
    raise exception 'ONBOARDING_NOT_FOUND';
  end if;

  if not public.can_manage_onboarding(p_onboarding_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'CANCEL_REASON_REQUIRED' using errcode = '23514';
  end if;

  if v_status = 'completed' then
    raise exception 'COMPLETED_ONBOARDING_CANNOT_CANCEL';
  end if;
  if v_status = 'cancelled' then
    return;
  end if;

  update public.onboarding_records
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      notes = concat_ws(E'\n\n', nullif(trim(notes), ''), 'Lý do hủy: ' || trim(p_reason))
  where id = p_onboarding_id
    and status <> 'completed';

  update public.interns i
  set status = 'pending'
  where i.status = 'onboarding'
    and i.id = v_intern_id
    and not exists (
      select 1
      from public.onboarding_records r
      join public.internships ip on ip.id = r.internship_id
      where ip.intern_id = i.id
        and r.status <> 'cancelled'
        and ip.deleted_at is null
    );
end;
$$;

revoke all on function public.cancel_onboarding(uuid, text) from public, anon;
grant execute on function public.cancel_onboarding(uuid, text) to authenticated;

create or replace function public.reopen_onboarding(p_onboarding_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.onboarding_record_status;
begin
  select status into v_status
  from public.onboarding_records
  where id = p_onboarding_id
  for update;

  if not found then
    raise exception 'ONBOARDING_NOT_FOUND';
  end if;

  if not public.can_manage_onboarding(p_onboarding_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'REOPEN_REASON_REQUIRED' using errcode = '23514';
  end if;

  if v_status not in ('pending_review', 'needs_revision', 'completed', 'cancelled') then
    raise exception 'INVALID_ONBOARDING_STATE' using errcode = '23514';
  end if;

  update public.onboarding_records
  set status = case
        when progress_percent > 0 then 'in_progress'::public.onboarding_record_status
        else 'not_started'::public.onboarding_record_status
      end,
      completed_at = null,
      completed_by = null,
      cancelled_at = null,
      cancelled_by = null,
      notes = concat_ws(E'\n\n', nullif(trim(notes), ''), 'Lý do mở lại: ' || trim(p_reason))
  where id = p_onboarding_id
    and status in ('pending_review', 'needs_revision', 'completed', 'cancelled');

  update public.interns ip
  set status = 'onboarding'
  from public.onboarding_records r
  where r.id = p_onboarding_id
    and ip.id = r.intern_id
    and ip.status = 'pending';

  perform public.refresh_onboarding_record(p_onboarding_id);
end;
$$;

revoke all on function public.reopen_onboarding(uuid, text) from public, anon;
grant execute on function public.reopen_onboarding(uuid, text) to authenticated;

create or replace function public.activate_internship(p_internship_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record public.onboarding_records%rowtype;
  v_internship public.internships%rowtype;
  v_intern_status public.intern_status;
  v_batch_status public.internship_status;
begin
  select * into v_record
  from public.onboarding_records
  where internship_id = p_internship_id
    and status <> 'cancelled'
  for update;

  if not found then
    raise exception 'ONBOARDING_NOT_FOUND';
  end if;

  if not public.can_manage_onboarding(v_record.id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if v_record.status <> 'completed' then
    raise exception 'ONBOARDING_NOT_COMPLETED' using errcode = '23514';
  end if;

  select * into v_internship
  from public.internships
  where id = p_internship_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'INTERNSHIP_NOT_FOUND';
  end if;

  if v_internship.status = 'active' then
    return;
  end if;

  if v_internship.status <> 'upcoming' then
    raise exception 'INTERNSHIP_NOT_ACTIVATABLE' using errcode = '23514';
  end if;

  select i.status into v_intern_status
  from public.interns i
  where i.id = v_internship.intern_id
    and i.deleted_at is null;

  select b.status into v_batch_status
  from public.internship_batches b
  where b.id = v_internship.batch_id
    and b.deleted_at is null;

  if v_intern_status in ('cancelled', 'completed', 'converted') then
    raise exception 'INTERN_STATUS_NOT_ACTIVATABLE' using errcode = '23514';
  end if;

  if v_batch_status in ('completed', 'cancelled') then
    raise exception 'BATCH_NOT_ACTIVATABLE' using errcode = '23514';
  end if;

  update public.internships
  set status = 'active'
  where id = p_internship_id;

  update public.interns
  set status = 'active'
  where id = v_internship.intern_id;
end;
$$;

revoke all on function public.activate_internship(uuid) from public, anon;
grant execute on function public.activate_internship(uuid) to authenticated;

create or replace function public.enforce_internship_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active'
    and old.status is distinct from 'active'
    and exists (
      select 1
      from public.onboarding_records r
      where r.internship_id = new.id
        and r.status is distinct from 'completed'
    ) then
    raise exception 'ONBOARDING_NOT_COMPLETED' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_internship_activation_guard on public.internships;
create trigger trg_internship_activation_guard
  before update of status on public.internships
  for each row execute function public.enforce_internship_activation();

create or replace function public.enforce_intern_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active'
    and old.status is distinct from 'active'
    and exists (
      select 1
      from public.internships ip
      join public.onboarding_records r on r.internship_id = ip.id
      where ip.intern_id = new.id
        and ip.deleted_at is null
        and r.status is distinct from 'completed'
    ) then
    raise exception 'ONBOARDING_NOT_COMPLETED' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_intern_activation_guard on public.interns;
create trigger trg_intern_activation_guard
  before update of status on public.interns
  for each row execute function public.enforce_intern_activation();

create or replace function public.update_my_onboarding_profile(
  p_full_name text,
  p_phone text,
  p_address text,
  p_emergency_contact_name text,
  p_emergency_contact_phone text,
  p_emergency_contact_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intern_id uuid;
begin
  if public.get_my_role() is distinct from 'intern'
    or nullif(trim(p_full_name), '') is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_intern_id := public.get_my_intern_id();
  if v_intern_id is null then
    raise exception 'INTERN_PROFILE_NOT_FOUND';
  end if;

  update public.profiles
  set full_name = trim(p_full_name),
      phone = nullif(trim(p_phone), ''),
      address = nullif(trim(p_address), '')
  where id = auth.uid();

  update public.interns
  set full_name = trim(p_full_name),
      phone = nullif(trim(p_phone), ''),
      address = nullif(trim(p_address), ''),
      emergency_contact_name = nullif(trim(p_emergency_contact_name), ''),
      emergency_contact_phone = nullif(trim(p_emergency_contact_phone), ''),
      emergency_contact_email = nullif(trim(p_emergency_contact_email), '')
  where id = v_intern_id;
end;
$$;

revoke all on function public.update_my_onboarding_profile(text, text, text, text, text, text) from public, anon;
grant execute on function public.update_my_onboarding_profile(text, text, text, text, text, text) to authenticated;

create or replace function public.get_onboarding_progress(p_onboarding_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'required_checklists', count(distinct i.id) filter (where i.is_required),
    'completed_checklists', count(distinct i.id) filter (where i.is_required and i.status = 'completed'),
    'required_documents', count(distinct d.id) filter (where d.is_required),
    'approved_documents', count(distinct d.id) filter (where d.is_required and d.status = 'approved'),
    'progress_percent', coalesce(max(r.progress_percent), 0),
    'can_complete', not exists (
      select 1 from public.onboarding_checklist_items x
      where x.onboarding_id = r.id and x.is_required and x.status is distinct from 'completed'
    ) and not exists (
      select 1 from public.onboarding_documents y
      where y.onboarding_id = r.id and y.is_required and y.status is distinct from 'approved'
    )
  )
  from public.onboarding_records r
  left join public.onboarding_checklist_items i on i.onboarding_id = r.id
  left join public.onboarding_documents d on d.onboarding_id = r.id
  where r.id = p_onboarding_id
    and public.can_read_onboarding(r.id)
  group by r.id, r.progress_percent;
$$;

revoke all on function public.get_onboarding_progress(uuid) from public, anon;
grant execute on function public.get_onboarding_progress(uuid) to authenticated;

create or replace function public.list_onboarding_internship_ids_for_hr()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(r.internship_id), '{}'::uuid[])
  from public.onboarding_records r
  where public.get_my_role() = 'admin'
     or (public.get_my_role() = 'hr' and (r.assigned_hr_id is null or r.assigned_hr_id = auth.uid()));
$$;

revoke all on function public.list_onboarding_internship_ids_for_hr() from public, anon;
grant execute on function public.list_onboarding_internship_ids_for_hr() to authenticated;

create or replace function public.get_onboarding_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_result jsonb;
begin
  v_role := public.get_my_role();
  if v_role is null or v_role not in ('admin', 'hr', 'mentor') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  with visible as (
    select r.*
    from public.onboarding_records r
    left join public.mentors m on m.id = r.mentor_id
    where
      v_role = 'admin'
      or (
        v_role = 'hr'
        and (r.assigned_hr_id is null or r.assigned_hr_id = auth.uid())
      )
      or (
        v_role = 'mentor'
        and m.user_id = auth.uid()
        and m.is_active = true
        and m.deleted_at is null
      )
  )
  select jsonb_build_object(
    'total', count(*),
    'not_started', count(*) filter (where status = 'not_started'),
    'in_progress', count(*) filter (where status = 'in_progress'),
    'pending_review', count(*) filter (where status = 'pending_review'),
    'needs_revision', count(*) filter (where status = 'needs_revision'),
    'completed', count(*) filter (where status = 'completed'),
    'cancelled', count(*) filter (where status = 'cancelled'),
    'overdue', count(*) filter (where due_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date and status not in ('completed', 'cancelled')),
    'completion_rate', case
      when count(*) filter (where status <> 'cancelled') = 0 then 0
      else round(
        100.0 * count(*) filter (where status = 'completed') /
        count(*) filter (where status <> 'cancelled'),
        1
      )
    end,
    'by_batch', coalesce((
      select jsonb_agg(row_to_json(batch_stats) order by batch_name)
      from (
        select b.id, b.name as batch_name,
          count(v.id) as total,
          count(v.id) filter (where v.status = 'completed') as completed,
          round(100.0 * count(v.id) filter (where v.status = 'completed') / nullif(count(v.id), 0), 1) as completion_rate
        from public.internship_batches b
        left join visible v on v.batch_id = b.id
        where b.deleted_at is null and v.id is not null
        group by b.id, b.name
      ) batch_stats
    ), '[]'::jsonb),
    'by_department', coalesce((
      select jsonb_agg(row_to_json(department_stats) order by department_name)
      from (
        select d.id, d.name as department_name,
          count(v.id) as total,
          count(v.id) filter (where v.status = 'completed') as completed,
          round(100.0 * count(v.id) filter (where v.status = 'completed') / nullif(count(v.id), 0), 1) as completion_rate
        from public.departments d
        left join visible v on v.department_id = d.id
        where d.deleted_at is null and v.id is not null
        group by d.id, d.name
      ) department_stats
    ), '[]'::jsonb),
    'incomplete', coalesce((
      select jsonb_agg(to_jsonb(incomplete) order by due_date)
      from (
        select r.id, r.code, i.full_name, b.name as batch_name, r.due_date, r.status, r.progress_percent
        from visible r
        join public.internships ip on ip.id = r.internship_id
        join public.interns i on i.id = ip.intern_id
        join public.internship_batches b on b.id = r.batch_id
        where r.status not in ('completed', 'cancelled')
        order by r.due_date
        limit 10
      ) incomplete
    ), '[]'::jsonb)
  )
  into v_result
  from visible;

  return v_result;
end;
$$;

revoke all on function public.get_onboarding_dashboard_stats() from public, anon;
grant execute on function public.get_onboarding_dashboard_stats() to authenticated;

create or replace function public.tg_notify_onboarding_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intern_user uuid;
  v_mentor_user uuid;
  v_type public.notification_type;
  v_body text;
begin
  v_intern_user := public.onboarding_intern_user(new.id);
  v_mentor_user := public.onboarding_mentor_user(new.id);

  if tg_op = 'INSERT' then
    v_type := 'onboarding_assigned';
    v_body := 'HR đã tạo hồ sơ onboarding và giao checklist cho bạn.';
  elsif tg_op = 'UPDATE'
    and old.status = 'completed'
    and new.status is distinct from 'completed' then
    v_type := 'onboarding_reopened';
    v_body := 'HR đã mở lại hồ sơ onboarding để tiếp tục xử lý.';
  elsif tg_op = 'UPDATE' and new.status = 'completed' and old.status is distinct from 'completed' then
    v_type := 'onboarding_completed';
    v_body := 'HR đã xác nhận hoàn tất onboarding.';
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    v_type := 'onboarding_cancelled';
    v_body := 'Hồ sơ onboarding đã được hủy.';
  elsif new.status in ('pending_review', 'needs_revision') and old.status is distinct from new.status then
    v_type := 'onboarding_updated';
    v_body := case new.status
      when 'pending_review' then 'Onboarding đã đủ điều kiện chờ HR xác nhận.'
      else 'HR đã yêu cầu bổ sung hoặc chỉnh sửa.'
    end;
  elsif (
    new.assigned_hr_id,
    new.department_id,
    new.mentor_id,
    new.onboarding_start_date,
    new.due_date,
    new.notes
  ) is distinct from (
    old.assigned_hr_id,
    old.department_id,
    old.mentor_id,
    old.onboarding_start_date,
    old.due_date,
    old.notes
  ) then
    v_type := 'onboarding_updated';
    v_body := 'HR đã cập nhật thông tin onboarding.';
  else
    return new;
  end if;

  perform public.insert_onboarding_notification(
    v_intern_user,
    v_type,
    case when v_type = 'onboarding_completed' then 'Onboarding đã hoàn thành' else 'Cập nhật onboarding' end,
    v_body,
    jsonb_build_object('onboarding_id', new.id, 'path', '/intern/onboarding'),
    'onboarding:' || new.id || ':' || v_type::text || ':' || new.updated_at::text
  );

  if tg_op = 'UPDATE' and new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.insert_onboarding_notification(
      new.assigned_hr_id,
      'onboarding_completed',
      'Onboarding đã hoàn thành',
      v_body,
      jsonb_build_object('onboarding_id', new.id, 'path', '/admin/onboarding/' || new.id),
      'onboarding:' || new.id || ':completed:' || new.completed_at::text || ':hr'
    );
    perform public.insert_onboarding_notification(
      v_mentor_user,
      'onboarding_completed',
      'Onboarding đã hoàn thành',
      v_body,
      jsonb_build_object('onboarding_id', new.id, 'path', '/mentor/onboarding/' || new.id),
      'onboarding:' || new.id || ':completed:' || new.completed_at::text || ':mentor'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_onboarding_record on public.onboarding_records;
create trigger trg_notify_onboarding_record
  after insert or update on public.onboarding_records
  for each row execute function public.tg_notify_onboarding_record();

create or replace function public.tg_notify_onboarding_checklist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record public.onboarding_records%rowtype;
  v_type public.notification_type;
  v_title text;
  v_body text;
  v_user_id uuid;
begin
  if new.onboarding_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' and new.assigned_to is not null then
    v_user_id := new.assigned_to;
    v_type := 'onboarding_assigned';
    v_title := 'Bạn được giao checklist onboarding';
    v_body := new.title;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    select * into v_record from public.onboarding_records where id = new.onboarding_id;
    if new.status = 'pending_review' then
      v_user_id := v_record.assigned_hr_id;
      v_type := 'onboarding_checklist_submitted';
      v_title := 'Checklist chờ duyệt';
      v_body := new.title;
    elsif new.status = 'needs_revision' then
      v_user_id := coalesce(new.performer_id, new.assigned_to);
      v_type := 'onboarding_updated';
      v_title := 'Checklist cần chỉnh sửa';
      v_body := coalesce(new.feedback, new.title);
    elsif new.status = 'completed' then
      v_user_id := coalesce(new.performer_id, new.assigned_to);
      v_type := 'onboarding_updated';
      v_title := 'Checklist đã được duyệt';
      v_body := new.title;
    else
      return new;
    end if;
  else
    return new;
  end if;

  perform public.insert_onboarding_notification(
    v_user_id,
    v_type,
    v_title,
    v_body,
    jsonb_build_object('onboarding_id', new.onboarding_id, 'item_id', new.id, 'path', '/intern/onboarding'),
    'onboarding-checklist:' || new.id || ':' || new.status::text || ':' || new.updated_at::text
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_onboarding_checklist on public.onboarding_checklist_items;
create trigger trg_notify_onboarding_checklist
  after insert or update on public.onboarding_checklist_items
  for each row execute function public.tg_notify_onboarding_checklist();

create or replace function public.tg_notify_onboarding_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intern_user uuid;
  v_type public.notification_type;
  v_title text;
  v_body text;
  v_user_id uuid;
begin
  select public.onboarding_intern_user(new.onboarding_id) into v_intern_user;

  if tg_op = 'INSERT' then
    v_user_id := v_intern_user;
    v_type := 'onboarding_assigned';
    v_title := 'Bạn có tài liệu onboarding mới';
    v_body := new.document_name;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'pending_review' then
      select assigned_hr_id into v_user_id
      from public.onboarding_records
      where id = new.onboarding_id;
      v_type := 'onboarding_document_submitted';
      v_title := 'Tài liệu onboarding chờ duyệt';
      v_body := new.document_name;
    elsif new.status in ('approved', 'needs_revision') then
      v_user_id := v_intern_user;
      v_type := 'onboarding_document_reviewed';
      v_title := case new.status
        when 'approved' then 'Tài liệu đã được duyệt'
        else 'Tài liệu cần bổ sung'
      end;
      v_body := coalesce(new.feedback, new.document_name);
    else
      return new;
    end if;
  else
    return new;
  end if;

  perform public.insert_onboarding_notification(
    v_user_id,
    v_type,
    v_title,
    v_body,
    jsonb_build_object('onboarding_id', new.onboarding_id, 'document_id', new.id, 'path', '/intern/onboarding'),
    'onboarding-document:' || new.id || ':' || new.status::text || ':' || new.updated_at::text
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_onboarding_document on public.onboarding_documents;
create trigger trg_notify_onboarding_document
  after insert or update on public.onboarding_documents
  for each row execute function public.tg_notify_onboarding_document();

create or replace function public.dispatch_onboarding_due_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_business_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  with recipients as (
    select r.id as onboarding_id,
      r.code,
      r.due_date,
      r.assigned_hr_id,
      public.onboarding_intern_user(r.id) as intern_user_id,
      public.onboarding_mentor_user(r.id) as mentor_user_id,
      case
        when r.due_date < v_business_date then 'onboarding_overdue'::public.notification_type
        else 'onboarding_due_soon'::public.notification_type
      end as notification_type
    from public.onboarding_records r
    where r.status not in ('completed', 'cancelled')
      and r.due_date <= v_business_date + 2
  ), expanded as (
    select onboarding_id, notification_type, intern_user_id as user_id, '/intern/onboarding'::text as path
    from recipients where intern_user_id is not null
    union all
    select onboarding_id, notification_type, assigned_hr_id, '/admin/onboarding/' || onboarding_id::text
    from recipients where assigned_hr_id is not null
    union all
    select onboarding_id, notification_type, mentor_user_id, '/mentor/onboarding/' || onboarding_id::text
    from recipients where mentor_user_id is not null
  )
  insert into public.notifications (user_id, type, title, body, data, dedupe_key)
  select e.user_id,
    e.notification_type,
    case e.notification_type
      when 'onboarding_overdue' then 'Onboarding đã quá hạn'
      else 'Onboarding sắp đến hạn'
    end,
    case e.notification_type
      when 'onboarding_overdue' then 'Hồ sơ onboarding chưa hoàn thành đã quá hạn.'
      else 'Hồ sơ onboarding sắp đến hạn, vui lòng kiểm tra các công việc còn thiếu.'
    end,
    jsonb_build_object('onboarding_id', e.onboarding_id, 'path', e.path),
    'onboarding-reminder:' || e.onboarding_id || ':' || e.user_id || ':' || e.notification_type::text || ':' || v_business_date::text
  from expanded e
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.dispatch_onboarding_due_reminders() from public, anon, authenticated;
grant execute on function public.dispatch_onboarding_due_reminders() to service_role;

create or replace function public.enforce_onboarding_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.internship_id is not null and not exists (
    select 1
    from public.internships ip
    where ip.id = new.internship_id
      and ip.intern_id = new.intern_id
      and ip.deleted_at is null
  ) then
    raise exception 'ATTENDANCE_INTERNSHIP_MISMATCH' using errcode = '23514';
  end if;

  if new.status in ('present', 'late', 'wfh', 'early_leave')
    and new.internship_id is not null
    and exists (
      select 1
      from public.onboarding_records r
      where r.internship_id = new.internship_id
        and r.status <> 'completed'
    ) then
    raise exception 'ONBOARDING_NOT_COMPLETED' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_attendance_requires_onboarding on public.attendance;
create trigger trg_attendance_requires_onboarding
  before insert or update of intern_id, status, internship_id on public.attendance
  for each row execute function public.enforce_onboarding_attendance();

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'onboarding_records',
    'onboarding_checklist_items',
    'onboarding_documents',
    'onboarding_document_versions',
    'onboarding_activity_logs'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;
