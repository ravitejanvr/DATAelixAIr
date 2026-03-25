
-- Benchmark v10 persistent storage (immutable runs)
CREATE TABLE public.benchmark_suite_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  benchmark_version text NOT NULL DEFAULT 'v10',
  pipeline_phase text NOT NULL,
  pipeline_mode text NOT NULL,
  total_cases integer NOT NULL DEFAULT 0,
  passed integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  metrics_summary jsonb NOT NULL DEFAULT '{}',
  layer_metrics jsonb NOT NULL DEFAULT '[]',
  regression_count integer NOT NULL DEFAULT 0,
  improvement_count integer NOT NULL DEFAULT 0,
  comparison_summary jsonb,
  locked boolean NOT NULL DEFAULT true
);

CREATE TABLE public.benchmark_suite_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL REFERENCES public.benchmark_suite_runs(run_id) ON DELETE CASCADE,
  case_id text NOT NULL,
  layer text NOT NULL,
  case_name text NOT NULL,
  predicted_top5 jsonb NOT NULL DEFAULT '[]',
  gold_rank integer,
  top1_match boolean NOT NULL DEFAULT false,
  top3_match boolean NOT NULL DEFAULT false,
  top5_match boolean NOT NULL DEFAULT false,
  candidate_recall boolean NOT NULL DEFAULT false,
  safety_triggered boolean NOT NULL DEFAULT false,
  safety_expected boolean NOT NULL DEFAULT false,
  safety_correct boolean NOT NULL DEFAULT false,
  safety_alerts jsonb NOT NULL DEFAULT '[]',
  clinical_acceptability numeric NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  failure_reasons text[] NOT NULL DEFAULT '{}',
  score_breakdown jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id, case_id)
);

-- Prevent updates/deletes (immutability)
ALTER TABLE public.benchmark_suite_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benchmark_suite_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert benchmark runs"
  ON public.benchmark_suite_runs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read benchmark runs"
  ON public.benchmark_suite_runs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert benchmark results"
  ON public.benchmark_suite_results FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read benchmark results"
  ON public.benchmark_suite_results FOR SELECT TO authenticated
  USING (true);
