
-- Benchmark runs table for versioned benchmark storage
CREATE TABLE public.benchmark_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  benchmark_version TEXT NOT NULL DEFAULT 'benchmark_v4_full_reasoning',
  pipeline_type TEXT NOT NULL DEFAULT 'modular_pipeline',
  run_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  test_case TEXT NOT NULL,
  test_case_index INTEGER NOT NULL DEFAULT 0,
  patient_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Metrics
  diagnosis_agreement INTEGER NOT NULL DEFAULT 0,
  lab_agreement INTEGER NOT NULL DEFAULT 0,
  medication_agreement INTEGER NOT NULL DEFAULT 0,
  guideline_citations INTEGER NOT NULL DEFAULT 0,
  safety_alerts INTEGER NOT NULL DEFAULT 0,
  confidence_score NUMERIC(4,2) DEFAULT NULL,
  confidence_label TEXT DEFAULT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  -- Module latencies
  ddx_latency_ms INTEGER DEFAULT NULL,
  uncertainty_latency_ms INTEGER DEFAULT NULL,
  -- Detailed outputs
  pipeline_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  comparison_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Pass/fail
  passed BOOLEAN NOT NULL DEFAULT false,
  failure_reasons TEXT[] NOT NULL DEFAULT '{}',
  -- Run grouping
  run_group_id UUID DEFAULT NULL,
  triggered_by UUID DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by version and run group
CREATE INDEX idx_benchmark_runs_version ON public.benchmark_runs(benchmark_version);
CREATE INDEX idx_benchmark_runs_group ON public.benchmark_runs(run_group_id);
CREATE INDEX idx_benchmark_runs_timestamp ON public.benchmark_runs(run_timestamp DESC);

-- RLS
ALTER TABLE public.benchmark_runs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users with platform_admin role to read/write
CREATE POLICY "platform_admins_manage_benchmarks"
  ON public.benchmark_runs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- Allow doctors to read benchmarks
CREATE POLICY "doctors_read_benchmarks"
  ON public.benchmark_runs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'doctor'));
