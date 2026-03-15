
-- Create diagnosis_synonyms table for ontology normalization
CREATE TABLE public.diagnosis_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  synonym_term text NOT NULL,
  canonical_diagnosis_id uuid NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  source_reference text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(synonym_term)
);

ALTER TABLE public.diagnosis_synonyms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on diagnosis_synonyms"
ON public.diagnosis_synonyms FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow service role full access on diagnosis_synonyms"
ON public.diagnosis_synonyms FOR ALL TO service_role USING (true);
