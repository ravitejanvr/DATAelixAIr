CREATE TABLE IF NOT EXISTS public.diagnosis_suppression_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dominant_diagnosis_id uuid NOT NULL REFERENCES public.diagnoses(id),
  suppressed_diagnosis_id uuid NOT NULL REFERENCES public.diagnoses(id),
  suppression_factor numeric NOT NULL DEFAULT 0.3,
  condition_description text NOT NULL DEFAULT '',
  requires_absence_of text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dominant_diagnosis_id, suppressed_diagnosis_id)
);

ALTER TABLE public.diagnosis_suppression_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on suppression rules" ON public.diagnosis_suppression_rules
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.diagnosis_suppression_rules IS 'Hypothesis competition rules for diagnostic reasoning'