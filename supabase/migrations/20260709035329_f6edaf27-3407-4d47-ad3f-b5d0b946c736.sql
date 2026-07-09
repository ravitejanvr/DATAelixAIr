CREATE TABLE public.kg_concept_bindings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnosis_name TEXT NOT NULL UNIQUE,
  canonical_id TEXT,
  snomed_id TEXT,
  score REAL,
  source TEXT NOT NULL DEFAULT 'terminology_canonicalize',
  resolved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX kg_concept_bindings_snomed_idx ON public.kg_concept_bindings (snomed_id);
CREATE INDEX kg_concept_bindings_canonical_idx ON public.kg_concept_bindings (canonical_id);

GRANT SELECT ON public.kg_concept_bindings TO authenticated;
GRANT SELECT ON public.kg_concept_bindings TO anon;
GRANT ALL ON public.kg_concept_bindings TO service_role;

ALTER TABLE public.kg_concept_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kg_concept_bindings readable by all"
  ON public.kg_concept_bindings FOR SELECT
  USING (true);

CREATE POLICY "kg_concept_bindings writable by platform admins"
  ON public.kg_concept_bindings FOR ALL
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER update_kg_concept_bindings_updated_at
  BEFORE UPDATE ON public.kg_concept_bindings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();