
-- Symptoms table
CREATE TABLE public.symptoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.symptoms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read symptoms" ON public.symptoms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage symptoms" ON public.symptoms FOR ALL TO authenticated USING (has_role(auth.uid(), 'platform_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- Diagnoses table
CREATE TABLE public.diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT '',
  icd10_code TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read diagnoses" ON public.diagnoses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage diagnoses" ON public.diagnoses FOR ALL TO authenticated USING (has_role(auth.uid(), 'platform_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- Lab tests reference table
CREATE TABLE public.lab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lab_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read lab_tests" ON public.lab_tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage lab_tests" ON public.lab_tests FOR ALL TO authenticated USING (has_role(auth.uid(), 'platform_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- Symptom → Diagnosis mapping
CREATE TABLE public.symptom_diagnosis_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_id UUID NOT NULL REFERENCES public.symptoms(id) ON DELETE CASCADE,
  diagnosis_id UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  confidence_score FLOAT NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (symptom_id, diagnosis_id)
);
ALTER TABLE public.symptom_diagnosis_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read symptom_diagnosis_map" ON public.symptom_diagnosis_map FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage symptom_diagnosis_map" ON public.symptom_diagnosis_map FOR ALL TO authenticated USING (has_role(auth.uid(), 'platform_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- Diagnosis → Drug mapping
CREATE TABLE public.diagnosis_drug_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  generic_name TEXT NOT NULL REFERENCES public.drug_master(generic_name) ON DELETE CASCADE,
  line_of_treatment TEXT NOT NULL DEFAULT 'first_line',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (diagnosis_id, generic_name)
);
ALTER TABLE public.diagnosis_drug_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read diagnosis_drug_map" ON public.diagnosis_drug_map FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage diagnosis_drug_map" ON public.diagnosis_drug_map FOR ALL TO authenticated USING (has_role(auth.uid(), 'platform_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- Diagnosis → Lab test mapping
CREATE TABLE public.diagnosis_lab_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  lab_test_id UUID NOT NULL REFERENCES public.lab_tests(id) ON DELETE CASCADE,
  priority TEXT NOT NULL DEFAULT 'routine',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (diagnosis_id, lab_test_id)
);
ALTER TABLE public.diagnosis_lab_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read diagnosis_lab_map" ON public.diagnosis_lab_map FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage diagnosis_lab_map" ON public.diagnosis_lab_map FOR ALL TO authenticated USING (has_role(auth.uid(), 'platform_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));
