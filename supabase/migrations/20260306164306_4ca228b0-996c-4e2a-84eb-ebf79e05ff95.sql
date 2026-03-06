
-- Fix RLS policies that still reference old 'admin' role instead of 'platform_admin'

DROP POLICY IF EXISTS "Admins can manage pilot requests" ON public.pilot_requests;
CREATE POLICY "Platform admins manage pilot requests"
ON public.pilot_requests FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Platform admins read audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS "Admins can read usage metrics" ON public.usage_metrics;
DROP POLICY IF EXISTS "System can insert usage metrics" ON public.usage_metrics;
CREATE POLICY "Platform admins read metrics"
ON public.usage_metrics FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::app_role));
CREATE POLICY "Platform admins insert metrics"
ON public.usage_metrics FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage lexicon" ON public.regional_lexicon;
CREATE POLICY "Platform admins manage lexicon"
ON public.regional_lexicon FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS "Doctors create patients" ON public.patients;
CREATE POLICY "Clinical staff create patients"
ON public.patients FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = doctor_id
  OR public.has_role(auth.uid(), 'receptionist'::app_role)
  OR public.has_role(auth.uid(), 'clinic_admin'::app_role)
  OR public.has_role(auth.uid(), 'front_desk'::app_role)
);

CREATE POLICY "Clinic staff view patients by clinic"
ON public.patients FOR SELECT TO authenticated
USING (
  clinic_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.clinic_id = patients.clinic_id
  )
);
