alter table terminology.import_jobs
  add column if not exists attempted_storage_path text,
  add column if not exists last_error_stack text;

alter table terminology.releases
  add column if not exists import_paused_at timestamptz;

update terminology.import_jobs
set attempted_storage_path = storage_path
where attempted_storage_path is null;

drop policy if exists "Clinic staff view settings" on public.clinic_settings;

create policy "Clinic admins view settings"
on public.clinic_settings
for select
to authenticated
using (
  public.has_role(auth.uid(), 'platform_admin'::public.app_role)
  or (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    and exists (
      select 1
      from public.profiles
      where profiles.user_id = auth.uid()
        and profiles.clinic_id = clinic_settings.clinic_id
    )
  )
);

drop policy if exists "Clinic staff view notification logs" on public.notification_logs;

drop policy if exists "Clinic admins view notification logs" on public.notification_logs;

drop policy if exists "Platform admins view all notification logs" on public.notification_logs;

create policy "Admins view notification logs"
on public.notification_logs
for select
to authenticated
using (
  public.has_role(auth.uid(), 'platform_admin'::public.app_role)
  or (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    and public.is_clinic_member(auth.uid(), clinic_id)
  )
);