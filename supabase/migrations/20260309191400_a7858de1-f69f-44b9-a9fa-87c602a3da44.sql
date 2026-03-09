
-- Fix remaining linter warning: monitoring_events INSERT WITH CHECK (true)
DROP POLICY IF EXISTS "Authenticated users insert monitoring events" ON public.monitoring_events;
CREATE POLICY "Clinic staff insert monitoring events"
ON public.monitoring_events
FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id IS NULL AND has_role(auth.uid(), 'platform_admin'::app_role)
  OR clinic_id IS NOT NULL AND is_clinic_member(auth.uid(), clinic_id)
);
