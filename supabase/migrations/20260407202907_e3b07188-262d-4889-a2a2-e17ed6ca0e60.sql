
-- =====================================================
-- FIX 1: ROLE ESCALATION — Remove self-insert on user_roles
-- =====================================================
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;

CREATE POLICY "Service role insert user_roles"
  ON public.user_roles FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Platform admins manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- =====================================================
-- FIX 2: CLINICAL REASONING TRACES — Remove public access
-- =====================================================
DROP POLICY IF EXISTS "Allow service insert on clinical_reasoning_traces" ON public.clinical_reasoning_traces;
DROP POLICY IF EXISTS "Allow public read on clinical_reasoning_traces" ON public.clinical_reasoning_traces;

CREATE POLICY "Service role insert clinical_reasoning_traces"
  ON public.clinical_reasoning_traces FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Platform admins read clinical_reasoning_traces"
  ON public.clinical_reasoning_traces FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Doctors read own visit traces"
  ON public.clinical_reasoning_traces FOR SELECT
  TO authenticated
  USING (
    visit_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.patient_visits pv
      WHERE pv.id = clinical_reasoning_traces.visit_id
        AND pv.assigned_to = auth.uid()
    )
  );

-- =====================================================
-- FIX 3: AUDIT LOGS — Remove client-side INSERT
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;

CREATE POLICY "Service role insert audit_logs"
  ON public.audit_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =====================================================
-- FIX 4: PIPELINE EXECUTION LOGS — Restrict read access
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view pipeline logs" ON public.pipeline_execution_logs;
DROP POLICY IF EXISTS "Authenticated users can insert pipeline logs" ON public.pipeline_execution_logs;

CREATE POLICY "Service role insert pipeline_execution_logs"
  ON public.pipeline_execution_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Platform admins read pipeline_execution_logs"
  ON public.pipeline_execution_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- =====================================================
-- FIX 5: CLINICAL ENGINE LOGS — Restrict read access
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can read clinical_engine_logs" ON public.clinical_engine_logs;

CREATE POLICY "Platform admins read clinical_engine_logs"
  ON public.clinical_engine_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- =====================================================
-- FIX 6: NOTIFICATION LOGS — Restrict to authorized roles
-- =====================================================
DROP POLICY IF EXISTS "Clinic staff view notification logs" ON public.notification_logs;

CREATE POLICY "Authorized staff view notification logs"
  ON public.notification_logs FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.clinic_id = notification_logs.clinic_id
    ))
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'doctor'::app_role)
      OR has_role(auth.uid(), 'platform_admin'::app_role)
    )
  );

-- =====================================================
-- FIX 7: CLINIC SETTINGS — Restrict API key column
-- =====================================================
REVOKE SELECT (notification_api_key) ON public.clinic_settings FROM authenticated;
REVOKE SELECT (notification_api_key) ON public.clinic_settings FROM anon;
GRANT SELECT (notification_api_key) ON public.clinic_settings TO service_role;
