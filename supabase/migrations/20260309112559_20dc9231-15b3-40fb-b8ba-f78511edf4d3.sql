
-- Step 1: Create evidence_sources table
CREATE TABLE public.evidence_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT NOT NULL DEFAULT '',
  journal TEXT NOT NULL DEFAULT '',
  year INTEGER NOT NULL,
  source_link TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  related_feature TEXT NOT NULL DEFAULT '',
  evidence_strength TEXT NOT NULL DEFAULT 'moderate',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.evidence_sources ENABLE ROW LEVEL SECURITY;

-- Public read access (evidence should be visible to everyone)
CREATE POLICY "Anyone can read evidence sources"
  ON public.evidence_sources
  FOR SELECT
  TO public
  USING (true);

-- Platform admins manage evidence sources
CREATE POLICY "Platform admins manage evidence sources"
  ON public.evidence_sources
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- Add updated_at trigger
CREATE TRIGGER update_evidence_sources_updated_at
  BEFORE UPDATE ON public.evidence_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for feature lookups
CREATE INDEX idx_evidence_sources_related_feature ON public.evidence_sources(related_feature);
CREATE INDEX idx_evidence_sources_year ON public.evidence_sources(year DESC);
