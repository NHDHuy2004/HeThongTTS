alter type public.notification_type add value if not exists 'onboarding_assigned';
alter type public.notification_type add value if not exists 'onboarding_updated';
alter type public.notification_type add value if not exists 'onboarding_due_soon';
alter type public.notification_type add value if not exists 'onboarding_overdue';
alter type public.notification_type add value if not exists 'onboarding_checklist_submitted';
alter type public.notification_type add value if not exists 'onboarding_document_submitted';
alter type public.notification_type add value if not exists 'onboarding_document_reviewed';
alter type public.notification_type add value if not exists 'onboarding_completed';
alter type public.notification_type add value if not exists 'onboarding_reopened';
alter type public.notification_type add value if not exists 'onboarding_cancelled';

alter table public.notifications
  add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_key_unique_idx
  on public.notifications (dedupe_key)
  where dedupe_key is not null;
