
-- Patient context snapshots table
CREATE TABLE public.patient_context_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.patient_visits(id) ON DELETE CASCADE,
  context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_context_snapshots ENABLE ROW LEVEL SECURITY;

-- Clinic staff can read/insert snapshots for their clinic's visits
CREATE POLICY "Clinic staff manage context snapshots"
ON public.patient_context_snapshots
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patient_visits pv
    WHERE pv.id = patient_context_snapshots.visit_id
    AND is_clinic_member(auth.uid(), pv.clinic_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patient_visits pv
    WHERE pv.id = patient_context_snapshots.visit_id
    AND is_clinic_member(auth.uid(), pv.clinic_id)
  )
);
