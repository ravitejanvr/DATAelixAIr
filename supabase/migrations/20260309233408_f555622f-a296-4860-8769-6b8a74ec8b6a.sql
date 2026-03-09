
CREATE TABLE public.diagnostic_hypotheses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.patient_visits(id) ON DELETE CASCADE,
  hypothesis jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_score numeric NOT NULL DEFAULT 0,
  evidence_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.diagnostic_hypotheses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff manage hypotheses"
ON public.diagnostic_hypotheses
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patient_visits pv
    WHERE pv.id = diagnostic_hypotheses.visit_id
    AND is_clinic_member(auth.uid(), pv.clinic_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patient_visits pv
    WHERE pv.id = diagnostic_hypotheses.visit_id
    AND is_clinic_member(auth.uid(), pv.clinic_id)
  )
);
