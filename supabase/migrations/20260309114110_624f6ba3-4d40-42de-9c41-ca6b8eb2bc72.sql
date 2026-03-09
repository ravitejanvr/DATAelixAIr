
-- Clinical Guidelines Knowledge Base
CREATE TABLE public.clinical_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source text NOT NULL DEFAULT '',
  source_organization text NOT NULL DEFAULT '',
  year integer NOT NULL,
  clinical_topic text NOT NULL DEFAULT '',
  condition text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  recommendation_text text NOT NULL DEFAULT '',
  evidence_grade text NOT NULL DEFAULT 'moderate',
  guideline_url text DEFAULT '',
  keywords text[] NOT NULL DEFAULT '{}',
  applicable_drugs text[] NOT NULL DEFAULT '{}',
  applicable_tests text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast keyword and condition search
CREATE INDEX idx_clinical_guidelines_condition ON public.clinical_guidelines (condition);
CREATE INDEX idx_clinical_guidelines_topic ON public.clinical_guidelines (clinical_topic);
CREATE INDEX idx_clinical_guidelines_source ON public.clinical_guidelines (source_organization);

-- RLS
ALTER TABLE public.clinical_guidelines ENABLE ROW LEVEL SECURITY;

-- Anyone can read active guidelines
CREATE POLICY "Anyone can read active guidelines"
  ON public.clinical_guidelines
  FOR SELECT
  TO public
  USING (is_active = true);

-- Platform admins manage guidelines
CREATE POLICY "Platform admins manage guidelines"
  ON public.clinical_guidelines
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));
