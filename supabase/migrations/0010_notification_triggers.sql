-- ==========================================================================
-- IMS – 0010_notification_triggers.sql
-- Tự tạo dòng `notifications` khi mentor/hr/admin DUYỆT hoặc TỪ CHỐI
-- đơn (leave/wfh/late) hoặc báo cáo (daily/weekly).
-- Client mobile/web chỉ cần subscribe Realtime là thấy tin mới ngay.
-- FCM push khi app đóng: client gọi EF `send-notification` với `push_only: true`.
-- ==========================================================================
-- (chạy sau 0005 — phụ thuộc bảng interns, notifications, enum notification_type)

-- --------------------------------------------------------------------------
-- Helper: user_id của intern (qua interns.user_id), null nếu không có.
-- --------------------------------------------------------------------------
create or replace function public.intern_owner(p_intern_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.interns where id = p_intern_id and deleted_at is null;
$$;

-- --------------------------------------------------------------------------
-- Đơn: leave_requests / work_from_home_requests / late_requests
-- --------------------------------------------------------------------------
create or replace function public.tg_notify_request_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid;
  v_label  text;
  v_type   public.notification_type;
  v_verb   text;
begin
  if NEW.status not in ('approved', 'rejected') then
    return null;
  end if;
  -- chỉ kích hoạt khi có CHUYỂN trạng thái (tránh lặp khi update cùng trạng thái)
  if OLD.status is not distinct from NEW.status then
    return null;
  end if;

  v_uid := public.intern_owner(NEW.intern_id);
  if v_uid is null then
    return null;
  end if;

  v_label := case TG_TABLE_NAME
    when 'leave_requests' then 'Đơn nghỉ phép'
    when 'work_from_home_requests' then 'Đơn làm từ xa'
    else 'Đơn đi muộn / về sớm'
  end;
  v_verb := case NEW.status when 'approved' then 'đã được duyệt' else 'đã bị từ chối' end;
  v_type := case NEW.status
    when 'approved' then 'request_approved'::public.notification_type
    else 'request_rejected'::public.notification_type
  end;

  insert into public.notifications (user_id, type, title, body, data)
  values (v_uid,
          v_type,
          v_label,
          format('%s %s.', v_label, v_verb),
          jsonb_build_object('table', TG_TABLE_NAME, 'id', NEW.id));

  return null;
end;
$$;

drop trigger if exists trg_notif_leave on public.leave_requests;
create trigger trg_notif_leave
after update on public.leave_requests
for each row execute function public.tg_notify_request_review();

drop trigger if exists trg_notif_wfh on public.work_from_home_requests;
create trigger trg_notif_wfh
after update on public.work_from_home_requests
for each row execute function public.tg_notify_request_review();

drop trigger if exists trg_notif_late on public.late_requests;
create trigger trg_notif_late
after update on public.late_requests
for each row execute function public.tg_notify_request_review();

-- --------------------------------------------------------------------------
-- Báo cáo: daily_reports / weekly_reports
-- --------------------------------------------------------------------------
create or replace function public.tg_notify_report_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid;
  v_label text;
  v_type  public.notification_type;
  v_verb  text;
begin
  if NEW.status not in ('approved', 'rejected') then
    return null;
  end if;
  if OLD.status is not distinct from NEW.status then
    return null;
  end if;

  v_uid := public.intern_owner(NEW.intern_id);
  if v_uid is null then
    return null;
  end if;

  v_label := case TG_TABLE_NAME
    when 'daily_reports' then coalesce(NEW.report_date::text, '')  -- null-safe: daily có report_date
    else 'Báo cáo tuần'
  end;
  v_type := case NEW.status
    when 'approved' then 'report_approved'::public.notification_type
    else 'report_rejected'::public.notification_type
  end;
  v_verb := case NEW.status when 'approved' then 'đã được duyệt' else 'đã bị từ chối' end;

  insert into public.notifications (user_id, type, title, body, data)
  values (v_uid,
          v_type,
          'Báo cáo',
          format('Báo cáo %s %s.', v_label, v_verb),
          jsonb_build_object('table', TG_TABLE_NAME, 'id', NEW.id));

  return null;
end;
$$;

drop trigger if exists trg_notif_daily on public.daily_reports;
create trigger trg_notif_daily
after update on public.daily_reports
for each row execute function public.tg_notify_report_review();

drop trigger if exists trg_notif_weekly on public.weekly_reports;
create trigger trg_notif_weekly
after update on public.weekly_reports
for each row execute function public.tg_notify_report_review();