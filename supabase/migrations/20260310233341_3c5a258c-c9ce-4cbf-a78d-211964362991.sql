
-- SECTION 3: Create drug_contraindication_map relational table
CREATE TABLE IF NOT EXISTS public.drug_contraindication_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  drug_id UUID REFERENCES public.drug_master(id) ON DELETE CASCADE NOT NULL,
  condition_id UUID REFERENCES public.diagnoses(id) ON DELETE CASCADE NOT NULL,
  severity TEXT NOT NULL DEFAULT 'moderate',
  source_guideline TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.drug_contraindication_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on drug_contraindication_map"
  ON public.drug_contraindication_map FOR SELECT TO authenticated USING (true);

-- SECTION 4: Create dangerous_diagnoses table
CREATE TABLE IF NOT EXISTS public.dangerous_diagnoses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnosis_id UUID REFERENCES public.diagnoses(id) ON DELETE CASCADE NOT NULL,
  trigger_symptom TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dangerous_diagnoses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on dangerous_diagnoses"
  ON public.dangerous_diagnoses FOR SELECT TO authenticated USING (true);

-- SECTION 7: Performance indexes
CREATE INDEX IF NOT EXISTS idx_symptom_diagnosis_map_symptom_id ON public.symptom_diagnosis_map(symptom_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_drug_map_diagnosis_id ON public.diagnosis_drug_map(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_lab_map_diagnosis_id ON public.diagnosis_lab_map(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_guideline_rules_diagnosis_id ON public.guideline_rules(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_dangerous_diagnoses_trigger ON public.dangerous_diagnoses(trigger_symptom);
CREATE INDEX IF NOT EXISTS idx_drug_contraindication_map_drug_id ON public.drug_contraindication_map(drug_id);
CREATE INDEX IF NOT EXISTS idx_drug_contraindication_map_condition_id ON public.drug_contraindication_map(condition_id);
