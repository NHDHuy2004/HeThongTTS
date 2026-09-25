-- Lời nhắc onboarding.
-- Job chạy theo timezone của PostgreSQL/Supabase (UTC): 01:15 UTC = 08:15 Asia/Ho_Chi_Minh.
do $$
begin
  if exists (
    select 1 from pg_available_extensions where name = 'pg_cron'
  ) then
    begin
      execute 'create extension if not exists pg_cron';
    exception when others then
      raise warning 'onboarding reminders: khong tao duoc pg_cron extension (%)', sqlerrm;
    end;
  end if;

  begin
    if exists (select 1 from pg_extension where extname = 'pg_cron')
      and to_regnamespace('cron') is not null then
      perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'onboarding-due-reminders';

      perform cron.schedule(
        'onboarding-due-reminders',
        '15 1 * * *',
        $cron$select public.dispatch_onboarding_due_reminders();$cron$
      );
    end if;
  exception when others then
    raise warning 'onboarding reminders: khong len lich duoc cron job (%)', sqlerrm;
  end;
end;
$$;
