
-- Create guideline_sources registry table
CREATE TABLE IF NOT EXISTS public.guideline_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization text NOT NULL,
  guideline_name text NOT NULL DEFAULT '',
  disease_category text NOT NULL DEFAULT 'general',
  region text NOT NULL DEFAULT 'global',
  version text NOT NULL DEFAULT '1.0',
  source_url text,
  priority integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guideline_sources ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated read guideline_sources" ON public.guideline_sources
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Platform admins manage guideline_sources" ON public.guideline_sources
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Service role manage guideline_sources" ON public.guideline_sources
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed with 8 organizations (priority: lower = higher priority)
INSERT INTO public.guideline_sources (organization, guideline_name, disease_category, region, priority) VALUES
  ('ICMR', 'Indian Council of Medical Research Guidelines', 'general', 'India', 1),
  ('WHO', 'World Health Organization Guidelines', 'general', 'global', 2),
  ('NICE', 'National Institute for Health and Care Excellence', 'general', 'UK', 3),
  ('CDC', 'Centers for Disease Control and Prevention', 'infectious_disease', 'USA', 4),
  ('IDSA', 'Infectious Diseases Society of America', 'infectious_disease', 'USA', 5),
  ('AHA', 'American Heart Association', 'cardiology', 'USA', 5),
  ('ESC', 'European Society of Cardiology', 'cardiology', 'Europe', 5),
  ('ADA', 'American Diabetes Association', 'endocrinology', 'USA', 5);

-- Add guideline_name column to guideline_usage_logs if not exists
ALTER TABLE public.guideline_usage_logs
  ADD COLUMN IF NOT EXISTS guideline_name text,
  ADD COLUMN IF NOT EXISTS recommendation_checked text,
  ADD COLUMN IF NOT EXISTS compliance_result text DEFAULT 'pending';
