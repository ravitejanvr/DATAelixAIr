
-- Patient Context Intelligence Engine (PCIE) tables

-- 1. patient_context_objects — structured output of the PCIE pipeline
CREATE TABLE public.patient_context_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.patient_visits(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  chief_complaint text NOT NULL DEFAULT '',
  symptoms jsonb NOT NULL DEFAULT '[]'::jsonb,
  associated_symptoms jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration text DEFAULT '',
  severity text DEFAULT 'unknown',
  risk_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  allergies jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_medications jsonb NOT NULL DEFAULT '[]'::jsonb,
  previous_conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  vitals jsonb DEFAULT '{}'::jsonb,
  lab_results jsonb DEFAULT '[]'::jsonb,
  risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_information jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_confidence numeric NOT NULL DEFAULT 0.0,
  input_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  built_by text NOT NULL DEFAULT 'pcie_v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_context_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can read patient context objects"
  ON public.patient_context_objects FOR SELECT TO authenticated
  USING (public.is_clinic_member(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can insert patient context objects"
  ON public.patient_context_objects FOR INSERT TO authenticated
  WITH CHECK (public.is_clinic_member(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can update patient context objects"
  ON public.patient_context_objects FOR UPDATE TO authenticated
  USING (public.is_clinic_member(auth.uid(), clinic_id));

-- 2. symptom_language_map — multilingual phrase to clinical concept mapping
CREATE TABLE public.symptom_language_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  normalized_phrase text NOT NULL,
  clinical_concept text NOT NULL,
  snomed_id text,
  confidence_score numeric NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(phrase, language)
);

ALTER TABLE public.symptom_language_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read symptom_language_map"
  ON public.symptom_language_map FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role can manage symptom_language_map"
  ON public.symptom_language_map FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. intake_raw_inputs — stores raw intake data for audit trail
CREATE TABLE public.intake_raw_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.patient_visits(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  input_type text NOT NULL DEFAULT 'form',
  raw_text text NOT NULL DEFAULT '',
  language text DEFAULT 'en',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intake_raw_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can read intake_raw_inputs"
  ON public.intake_raw_inputs FOR SELECT TO authenticated
  USING (public.is_clinic_member(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can insert intake_raw_inputs"
  ON public.intake_raw_inputs FOR INSERT TO authenticated
  WITH CHECK (public.is_clinic_member(auth.uid(), clinic_id));

-- Indexes for performance
CREATE INDEX idx_pco_visit_id ON public.patient_context_objects(visit_id);
CREATE INDEX idx_pco_patient_id ON public.patient_context_objects(patient_id);
CREATE INDEX idx_intake_raw_visit ON public.intake_raw_inputs(visit_id);
CREATE INDEX idx_slm_phrase_lang ON public.symptom_language_map(phrase, language);

-- Trigger for updated_at on patient_context_objects
CREATE TRIGGER set_pco_updated_at
  BEFORE UPDATE ON public.patient_context_objects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
