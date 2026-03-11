
-- Clinical Context Objects table — canonical patient state for all pipeline modules
CREATE TABLE public.clinical_context_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.patient_visits(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,

  -- Patient Profile
  patient_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Episode Context
  episode_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Medical History
  medical_history jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Clinical Observations
  clinical_observations jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Derived Context
  derived_context jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Metadata
  context_confidence numeric NOT NULL DEFAULT 0,
  fields_populated integer NOT NULL DEFAULT 0,
  total_fields integer NOT NULL DEFAULT 0,
  missing_fields text[] NOT NULL DEFAULT '{}',
  evidence_sources jsonb NOT NULL DEFAULT '[]'::jsonb,

  status text NOT NULL DEFAULT 'draft',
  built_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by visit
CREATE INDEX idx_cco_visit ON public.clinical_context_objects(visit_id);
CREATE INDEX idx_cco_patient ON public.clinical_context_objects(patient_id);
CREATE INDEX idx_cco_visit_version ON public.clinical_context_objects(visit_id, version DESC);

-- Enable RLS
ALTER TABLE public.clinical_context_objects ENABLE ROW LEVEL SECURITY;

-- Clinic members can read CCOs for their clinic
CREATE POLICY "Clinic members can read CCOs"
ON public.clinical_context_objects
FOR SELECT TO authenticated
USING (public.is_clinic_member(auth.uid(), clinic_id));

-- Clinic members can insert CCOs for their clinic
CREATE POLICY "Clinic members can insert CCOs"
ON public.clinical_context_objects
FOR INSERT TO authenticated
WITH CHECK (public.is_clinic_member(auth.uid(), clinic_id));

-- Clinic members can update CCOs for their clinic
CREATE POLICY "Clinic members can update CCOs"
ON public.clinical_context_objects
FOR UPDATE TO authenticated
USING (public.is_clinic_member(auth.uid(), clinic_id))
WITH CHECK (public.is_clinic_member(auth.uid(), clinic_id));

-- Service role policy for edge functions
CREATE POLICY "Service role full access CCOs"
ON public.clinical_context_objects
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_cco_updated_at
  BEFORE UPDATE ON public.clinical_context_objects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
