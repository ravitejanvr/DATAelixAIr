
-- =============================================
-- CRITICAL FIX 1: Secure report_tokens
-- =============================================

-- Add patient_id column
ALTER TABLE public.report_tokens ADD COLUMN IF NOT EXISTS patient_id uuid;

-- Backfill patient_id from consultations
UPDATE public.report_tokens rt
SET patient_id = c.patient_id
FROM public.consultations c
WHERE c.id = rt.consultation_id AND rt.patient_id IS NULL;

-- Drop unsafe SELECT policies
DROP POLICY IF EXISTS "Anon can read tokens for validation" ON public.report_tokens;
DROP POLICY IF EXISTS "Anyone can validate tokens" ON public.report_tokens;

-- Create secure token validation policy (header-based)
CREATE POLICY "Validate report token by value"
ON public.report_tokens
FOR SELECT
TO anon, authenticated
USING (
  token = current_setting('request.headers', true)::json->>'x-report-token'
  AND expires_at > now()
);

-- =============================================
-- CRITICAL FIX 2: Lock safety table INSERT policies
-- =============================================

-- clinical_alerts
DROP POLICY IF EXISTS "Authenticated insert clinical alerts" ON public.clinical_alerts;
CREATE POLICY "Clinic staff insert clinical alerts"
ON public.clinical_alerts
FOR INSERT
TO authenticated
WITH CHECK (is_clinic_member(auth.uid(), clinic_id));

-- diagnostic_flags
DROP POLICY IF EXISTS "Authenticated insert diagnostic flags" ON public.diagnostic_flags;
CREATE POLICY "Clinic staff insert diagnostic flags"
ON public.diagnostic_flags
FOR INSERT
TO authenticated
WITH CHECK (is_clinic_member(auth.uid(), clinic_id));

-- medication_alerts
DROP POLICY IF EXISTS "Authenticated insert medication alerts" ON public.medication_alerts;
CREATE POLICY "Clinic staff insert medication alerts"
ON public.medication_alerts
FOR INSERT
TO authenticated
WITH CHECK (is_clinic_member(auth.uid(), clinic_id));

-- outcome_tracking
DROP POLICY IF EXISTS "Authenticated insert outcomes" ON public.outcome_tracking;
CREATE POLICY "Clinic staff insert outcomes"
ON public.outcome_tracking
FOR INSERT
TO authenticated
WITH CHECK (is_clinic_member(auth.uid(), clinic_id));

-- population_signals
DROP POLICY IF EXISTS "Authenticated insert population signals" ON public.population_signals;
CREATE POLICY "Clinic staff insert population signals"
ON public.population_signals
FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id IS NULL AND has_role(auth.uid(), 'platform_admin'::app_role)
  OR clinic_id IS NOT NULL AND is_clinic_member(auth.uid(), clinic_id)
);

-- =============================================
-- HIGH FIX 2: Secure notification_logs INSERT
-- =============================================
DROP POLICY IF EXISTS "Authenticated insert notification logs" ON public.notification_logs;
CREATE POLICY "Clinic staff insert notification logs"
ON public.notification_logs
FOR INSERT
TO authenticated
WITH CHECK (is_clinic_member(auth.uid(), clinic_id));

-- =============================================
-- HIGH FIX 3: Secure risk_flags INSERT
-- =============================================
DROP POLICY IF EXISTS "Authenticated insert risk flags" ON public.risk_flags;
CREATE POLICY "Service role insert risk flags"
ON public.risk_flags
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- =============================================
-- HIGH FIX 4: Enforce clinic isolation on doctor policies
-- =============================================

-- Consultations: doctors must be clinic members
DROP POLICY IF EXISTS "Doctors see own consultations" ON public.consultations;
CREATE POLICY "Doctors see own consultations"
ON public.consultations FOR SELECT TO authenticated
USING (auth.uid() = doctor_id AND (clinic_id IS NULL OR is_clinic_member(auth.uid(), clinic_id)));

DROP POLICY IF EXISTS "Doctors update own consultations" ON public.consultations;
CREATE POLICY "Doctors update own consultations"
ON public.consultations FOR UPDATE TO authenticated
USING (auth.uid() = doctor_id AND (clinic_id IS NULL OR is_clinic_member(auth.uid(), clinic_id)));

DROP POLICY IF EXISTS "Doctors delete own consultations" ON public.consultations;
CREATE POLICY "Doctors delete own consultations"
ON public.consultations FOR DELETE TO authenticated
USING (auth.uid() = doctor_id AND (clinic_id IS NULL OR is_clinic_member(auth.uid(), clinic_id)));

-- Prescriptions: doctors must be clinic members
DROP POLICY IF EXISTS "Doctors see own prescriptions" ON public.prescriptions;
CREATE POLICY "Doctors see own prescriptions"
ON public.prescriptions FOR SELECT TO authenticated
USING (auth.uid() = doctor_id AND (clinic_id IS NULL OR is_clinic_member(auth.uid(), clinic_id)));

DROP POLICY IF EXISTS "Doctors update own prescriptions" ON public.prescriptions;
CREATE POLICY "Doctors update own prescriptions"
ON public.prescriptions FOR UPDATE TO authenticated
USING (auth.uid() = doctor_id AND (clinic_id IS NULL OR is_clinic_member(auth.uid(), clinic_id)));

DROP POLICY IF EXISTS "Doctors create prescriptions" ON public.prescriptions;
CREATE POLICY "Doctors create prescriptions"
ON public.prescriptions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = doctor_id AND is_doctor_for_patient(patient_id) AND (clinic_id IS NULL OR is_clinic_member(auth.uid(), clinic_id)));

-- Patients: doctors must be clinic members
DROP POLICY IF EXISTS "Doctors see own patients" ON public.patients;
CREATE POLICY "Doctors see own patients"
ON public.patients FOR SELECT TO authenticated
USING (auth.uid() = doctor_id AND (clinic_id IS NULL OR is_clinic_member(auth.uid(), clinic_id)));

DROP POLICY IF EXISTS "Doctors update own patients" ON public.patients;
CREATE POLICY "Doctors update own patients"
ON public.patients FOR UPDATE TO authenticated
USING (auth.uid() = doctor_id AND (clinic_id IS NULL OR is_clinic_member(auth.uid(), clinic_id)));

DROP POLICY IF EXISTS "Doctors delete own patients" ON public.patients;
CREATE POLICY "Doctors delete own patients"
ON public.patients FOR DELETE TO authenticated
USING (auth.uid() = doctor_id AND (clinic_id IS NULL OR is_clinic_member(auth.uid(), clinic_id)));

-- =============================================
-- HIGH FIX 5: Enable realtime for consultations
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.consultations;
