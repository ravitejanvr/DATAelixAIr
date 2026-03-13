
CREATE TABLE IF NOT EXISTS public.clinical_engine_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_name text NOT NULL,
  visit_id text,
  validation_run_id text,
  execution_time_ms integer NOT NULL DEFAULT 0,
  input_context_id text,
  status text NOT NULL DEFAULT 'ok',
  error_message text,
  output_summary jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clinical_engine_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on clinical_engine_logs"
  ON public.clinical_engine_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read clinical_engine_logs"
  ON public.clinical_engine_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX idx_clinical_engine_logs_engine ON public.clinical_engine_logs (engine_name);
CREATE INDEX idx_clinical_engine_logs_run ON public.clinical_engine_logs (validation_run_id);
