
-- Phase 3: Knowledge Graph edge tables

-- 1. Diagnosis ↔ Guideline mapping
CREATE TABLE public.diagnosis_guideline_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id uuid NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  guideline_id uuid NOT NULL REFERENCES public.guideline_registry(id) ON DELETE CASCADE,
  relevance_score numeric NOT NULL DEFAULT 0.8,
  recommendation_summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(diagnosis_id, guideline_id)
);

CREATE INDEX idx_dgm_diagnosis ON public.diagnosis_guideline_map(diagnosis_id);
CREATE INDEX idx_dgm_guideline ON public.diagnosis_guideline_map(guideline_id);

-- 2. Symptom → Lab shortcut (bypasses diagnosis for urgent workups)
CREATE TABLE public.symptom_lab_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_id uuid NOT NULL REFERENCES public.symptoms(id) ON DELETE CASCADE,
  lab_test_id uuid NOT NULL REFERENCES public.lab_tests(id) ON DELETE CASCADE,
  priority text NOT NULL DEFAULT 'recommended',
  clinical_rationale text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(symptom_id, lab_test_id)
);

CREATE INDEX idx_slm_symptom ON public.symptom_lab_map(symptom_id);

-- 3. Symptom → Drug shortcut (symptomatic treatment)
CREATE TABLE public.symptom_drug_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_id uuid NOT NULL REFERENCES public.symptoms(id) ON DELETE CASCADE,
  generic_name text NOT NULL,
  treatment_type text NOT NULL DEFAULT 'symptomatic',
  priority text NOT NULL DEFAULT 'first_line',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(symptom_id, generic_name)
);

CREATE INDEX idx_sdm_symptom ON public.symptom_drug_map(symptom_id);

-- RLS for all three tables (read-only for authenticated, service_role full)
ALTER TABLE public.diagnosis_guideline_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_lab_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_drug_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read diagnosis_guideline_map"
ON public.diagnosis_guideline_map FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read symptom_lab_map"
ON public.symptom_lab_map FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read symptom_drug_map"
ON public.symptom_drug_map FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manage diagnosis_guideline_map"
ON public.diagnosis_guideline_map FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role manage symptom_lab_map"
ON public.symptom_lab_map FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role manage symptom_drug_map"
ON public.symptom_drug_map FOR ALL TO service_role USING (true) WITH CHECK (true);
