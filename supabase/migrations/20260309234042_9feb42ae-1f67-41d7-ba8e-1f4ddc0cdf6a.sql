
-- Vital alerts table for dangerous vital sign detection
CREATE TABLE public.vital_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.patient_visits(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  parameter text NOT NULL,
  value numeric NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  action_hint text,
  acknowledged_at timestamp with time zone,
  acknowledged_by uuid,
  override_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vital_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff manage vital alerts"
ON public.vital_alerts
FOR ALL
TO authenticated
USING (is_clinic_member(auth.uid(), clinic_id))
WITH CHECK (is_clinic_member(auth.uid(), clinic_id));
