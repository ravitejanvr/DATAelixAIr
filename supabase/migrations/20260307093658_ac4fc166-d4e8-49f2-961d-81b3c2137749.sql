
-- Add triage table
CREATE TABLE IF NOT EXISTS public.triage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.patient_visits(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  recorded_by uuid NOT NULL,
  chief_complaint text NOT NULL DEFAULT '',
  symptom_duration text,
  pain_score integer,
  allergies_noted text,
  pregnancy_status text DEFAULT 'not_applicable',
  priority text DEFAULT 'routine',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.triage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff manage triage"
  ON public.triage FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = triage.clinic_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = triage.clinic_id
  ));

CREATE INDEX IF NOT EXISTS idx_triage_visit_id ON public.triage(visit_id);
CREATE INDEX IF NOT EXISTS idx_triage_patient_id ON public.triage(patient_id);
CREATE INDEX IF NOT EXISTS idx_triage_clinic_id ON public.triage(clinic_id);

-- Add missing vitals columns
ALTER TABLE public.vitals ADD COLUMN IF NOT EXISTS respiratory_rate integer;
ALTER TABLE public.vitals ADD COLUMN IF NOT EXISTS height_cm numeric;

-- Add triage_enabled to workflow config
ALTER TABLE public.clinic_workflow_config ADD COLUMN IF NOT EXISTS triage_enabled boolean DEFAULT true;

-- Add triage step to visit statuses (just expanding the workflow_order default)
-- Update default workflow_order to include triage
ALTER TABLE public.clinic_workflow_config 
  ALTER COLUMN workflow_order SET DEFAULT '["intake", "triage", "vitals", "doctor", "lab", "pharmacy", "billing"]'::jsonb;

-- Trigger for triage updated_at
CREATE TRIGGER update_triage_updated_at
  BEFORE UPDATE ON public.triage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime for triage
ALTER PUBLICATION supabase_realtime ADD TABLE public.triage;
