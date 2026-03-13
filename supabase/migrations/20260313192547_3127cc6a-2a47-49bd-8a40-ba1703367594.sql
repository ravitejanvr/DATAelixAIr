CREATE POLICY "doctors_write_benchmarks"
ON public.benchmark_runs
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'doctor'::app_role));

DROP POLICY IF EXISTS "doctors_read_benchmarks" ON public.benchmark_runs;

CREATE POLICY "doctors_read_benchmarks"
ON public.benchmark_runs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'doctor'::app_role)
  OR has_role(auth.uid(), 'platform_admin'::app_role)
);