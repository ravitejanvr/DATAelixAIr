
-- Pipeline execution logs for observability (Phase 11)
CREATE TABLE IF NOT EXISTS public.pipeline_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id TEXT NOT NULL,
  engine_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  latency_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX idx_pipeline_logs_visit ON public.pipeline_execution_logs(visit_id);
CREATE INDEX idx_pipeline_logs_engine ON public.pipeline_execution_logs(engine_name);
CREATE INDEX idx_pipeline_logs_created ON public.pipeline_execution_logs(created_at DESC);

-- RLS: allow authenticated users to insert/select their own pipeline logs
ALTER TABLE public.pipeline_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert pipeline logs"
  ON public.pipeline_execution_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view pipeline logs"
  ON public.pipeline_execution_logs FOR SELECT
  TO authenticated
  USING (true);
