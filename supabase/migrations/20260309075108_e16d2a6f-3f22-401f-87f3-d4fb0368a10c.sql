CREATE TABLE public.innovation_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  evidence_source text NOT NULL DEFAULT '',
  problem_detected text NOT NULL DEFAULT '',
  clinical_impact text NOT NULL DEFAULT '',
  suggested_improvement text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  category text NOT NULL DEFAULT 'ai_performance',
  status text NOT NULL DEFAULT 'pending',
  source_urls text[] NOT NULL DEFAULT '{}',
  keywords text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}',
  reviewed_by uuid,
  reviewed_at timestamptz,
  roadmap_task text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.innovation_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage innovation insights"
  ON public.innovation_insights FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));