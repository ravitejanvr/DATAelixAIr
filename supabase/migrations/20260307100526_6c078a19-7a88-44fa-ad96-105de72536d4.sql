
-- Monitoring Layer: monitoring_events table for granular AI performance tracking
-- No PHI stored — only event types, timing, and anonymized metrics

CREATE TABLE public.monitoring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  agent_name text,
  duration_ms integer,
  success boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for dashboard queries
CREATE INDEX idx_monitoring_events_type ON public.monitoring_events(event_type, created_at DESC);
CREATE INDEX idx_monitoring_events_agent ON public.monitoring_events(agent_name, created_at DESC);
CREATE INDEX idx_monitoring_events_created ON public.monitoring_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.monitoring_events ENABLE ROW LEVEL SECURITY;

-- Edge functions insert via service role (no user-facing insert needed)
-- Platform admins can read all monitoring data
CREATE POLICY "Platform admins read monitoring events"
  ON public.monitoring_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'::app_role));

-- Authenticated users can insert (for client-side metric emission)
CREATE POLICY "Authenticated users insert monitoring events"
  ON public.monitoring_events FOR INSERT
  TO authenticated
  WITH CHECK (true);
