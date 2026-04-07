
-- =====================================================
-- FIX: BENCHMARK TABLES — Restrict to platform_admin/service_role
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can insert benchmark suite results" ON public.benchmark_suite_results;
DROP POLICY IF EXISTS "Authenticated users can view benchmark suite results" ON public.benchmark_suite_results;
DROP POLICY IF EXISTS "Authenticated users can insert benchmark suite runs" ON public.benchmark_suite_runs;
DROP POLICY IF EXISTS "Authenticated users can read benchmark suite runs" ON public.benchmark_suite_runs;

CREATE POLICY "Platform admins manage benchmark_suite_results"
  ON public.benchmark_suite_results FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Service role manage benchmark_suite_results"
  ON public.benchmark_suite_results FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Platform admins manage benchmark_suite_runs"
  ON public.benchmark_suite_runs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Service role manage benchmark_suite_runs"
  ON public.benchmark_suite_runs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- =====================================================
-- FIX: KNOWLEDGE_CACHE — Restrict writes to service_role
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can insert knowledge_cache" ON public.knowledge_cache;
DROP POLICY IF EXISTS "Authenticated users can update knowledge_cache" ON public.knowledge_cache;

CREATE POLICY "Service role write knowledge_cache"
  ON public.knowledge_cache FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role update knowledge_cache"
  ON public.knowledge_cache FOR UPDATE
  TO service_role
  USING (true) WITH CHECK (true);

-- =====================================================
-- FIX: REASONING_CACHE — Restrict writes to service_role
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can insert reasoning_cache" ON public.reasoning_cache;
DROP POLICY IF EXISTS "Authenticated users can update reasoning_cache" ON public.reasoning_cache;

CREATE POLICY "Service role write reasoning_cache"
  ON public.reasoning_cache FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role update reasoning_cache"
  ON public.reasoning_cache FOR UPDATE
  TO service_role
  USING (true) WITH CHECK (true);

-- =====================================================
-- FIX: BIAS_METRICS — Scope to clinic or platform_admin
-- =====================================================
DROP POLICY IF EXISTS "Authenticated can read bias metrics" ON public.bias_metrics;

CREATE POLICY "Platform admins read all bias_metrics"
  ON public.bias_metrics FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Clinic members read own bias_metrics"
  ON public.bias_metrics FOR SELECT
  TO authenticated
  USING (
    clinic_id IS NOT NULL AND is_clinic_member(auth.uid(), clinic_id)
  );

-- =====================================================
-- FIX: NOTIFICATION_LOGS — Restrict to clinic_admin only
-- =====================================================
DROP POLICY IF EXISTS "Authorized staff view notification logs" ON public.notification_logs;

CREATE POLICY "Clinic admins view notification logs"
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
      OR has_role(auth.uid(), 'platform_admin'::app_role)
    )
  );

-- =====================================================
-- FIX: REALTIME.MESSAGES — Scope subscriptions
-- =====================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scoped realtime subscriptions"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    -- Allow subscription only to channels matching user's clinic
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.clinic_id IS NOT NULL
        AND (
          realtime.messages.extension = 'presence'
          OR realtime.messages.topic LIKE '%' || p.clinic_id::text || '%'
        )
    )
    OR has_role(auth.uid(), 'platform_admin'::app_role)
  );
