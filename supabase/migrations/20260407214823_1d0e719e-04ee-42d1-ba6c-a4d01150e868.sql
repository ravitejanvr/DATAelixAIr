
-- =====================================================
-- HARDEN BENCHMARK TABLES: Restrict to platform_admin only
-- These tables contain AI outputs and patient_context
-- No clinic_id exists — clinic scoping not possible
-- =====================================================

-- 1. benchmark_suite_results: Remove USING(true) SELECT
DROP POLICY IF EXISTS "Authenticated users can read benchmark results" ON public.benchmark_suite_results;

CREATE POLICY "Platform admins read benchmark_suite_results"
  ON public.benchmark_suite_results FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'::app_role));

-- 2. benchmark_suite_runs: Remove USING(true) SELECT
DROP POLICY IF EXISTS "Authenticated users can read benchmark runs" ON public.benchmark_suite_runs;

CREATE POLICY "Platform admins read benchmark_suite_runs"
  ON public.benchmark_suite_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'::app_role));

-- 3. benchmark_runs: Replace broad doctor access with platform_admin only
DROP POLICY IF EXISTS "doctors_read_benchmarks" ON public.benchmark_runs;

CREATE POLICY "Platform admins read benchmark_runs"
  ON public.benchmark_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'::app_role));

-- Also restrict doctor INSERT to platform_admin (benchmark writes are admin ops)
DROP POLICY IF EXISTS "doctors_write_benchmarks" ON public.benchmark_runs;

CREATE POLICY "Platform admins insert benchmark_runs"
  ON public.benchmark_runs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::app_role));
