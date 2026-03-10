
-- Guideline Authorities table
CREATE TABLE public.guideline_authorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_name TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL DEFAULT 'global',
  priority INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.guideline_authorities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read guideline_authorities" ON public.guideline_authorities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage guideline_authorities" ON public.guideline_authorities FOR ALL TO authenticated USING (has_role(auth.uid(), 'platform_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- Guideline Rules table
CREATE TABLE public.guideline_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  treatment_generic_name TEXT NOT NULL REFERENCES public.drug_master(generic_name) ON DELETE CASCADE,
  recommendation TEXT NOT NULL DEFAULT '',
  authority_id UUID NOT NULL REFERENCES public.guideline_authorities(id) ON DELETE CASCADE,
  evidence_level TEXT NOT NULL DEFAULT 'moderate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (diagnosis_id, treatment_generic_name, authority_id)
);
ALTER TABLE public.guideline_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read guideline_rules" ON public.guideline_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage guideline_rules" ON public.guideline_rules FOR ALL TO authenticated USING (has_role(auth.uid(), 'platform_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- Seed guideline authorities
INSERT INTO public.guideline_authorities (authority_name, country, priority) VALUES
  ('ICMR', 'India', 1),
  ('NHS', 'UK', 2),
  ('WHO', 'global', 3),
  ('PubMed', 'global', 4);
