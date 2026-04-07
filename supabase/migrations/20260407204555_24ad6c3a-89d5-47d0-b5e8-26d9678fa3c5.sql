-- FIX 1: benchmark_suite_results — restrict INSERT to platform_admin + service_role
DROP POLICY IF EXISTS "Authenticated users can insert benchmark results" ON public.benchmark_suite_results;

CREATE POLICY "Platform admins insert benchmark results"
  ON public.benchmark_suite_results FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::app_role));

-- FIX 2: benchmark_suite_runs — restrict INSERT to platform_admin + service_role
DROP POLICY IF EXISTS "Authenticated users can insert benchmark runs" ON public.benchmark_suite_runs;

CREATE POLICY "Platform admins insert benchmark runs"
  ON public.benchmark_suite_runs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::app_role));

-- FIX 3: clinic_settings — revoke notification_api_key from regular authenticated users
REVOKE SELECT (notification_api_key) ON public.clinic_settings FROM authenticated;
GRANT SELECT (notification_api_key) ON public.clinic_settings TO service_role;