
CREATE TABLE public.ai_pipeline_tests_v4 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name text NOT NULL,
  pipeline_version text NOT NULL DEFAULT 'benchmark_v4',
  patient_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  modular_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  legacy_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  diagnosis_match numeric NOT NULL DEFAULT 0,
  lab_match numeric NOT NULL DEFAULT 0,
  medication_match numeric NOT NULL DEFAULT 0,
  guideline_count integer NOT NULL DEFAULT 0,
  confidence_score numeric NOT NULL DEFAULT 0,
  confidence_label text,
  latency_ms integer NOT NULL DEFAULT 0,
  ddx_latency_ms integer,
  uncertainty_latency_ms integer,
  safety_alerts integer NOT NULL DEFAULT 0,
  safety_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  dangerous_diagnosis_detected boolean NOT NULL DEFAULT false,
  module_logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  passed boolean NOT NULL DEFAULT false,
  failure_reasons text[] NOT NULL DEFAULT '{}',
  run_group_id text,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_pipeline_tests_v4 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage v4 tests"
ON public.ai_pipeline_tests_v4
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Doctors can view v4 tests"
ON public.ai_pipeline_tests_v4
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'doctor'));
