
CREATE TABLE public.ai_decision_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.patient_visits(id) ON DELETE CASCADE,
  consultation_id uuid REFERENCES public.consultations(id) ON DELETE SET NULL,
  doctor_id uuid NOT NULL,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  ai_output text NOT NULL,
  ai_output_type text NOT NULL DEFAULT 'suggestion',
  guideline_source text,
  evidence_reference text,
  model_version text,
  confidence numeric,
  safety_status text NOT NULL DEFAULT 'safe',
  doctor_action text NOT NULL DEFAULT 'pending',
  override_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_decision_ledger ENABLE ROW LEVEL SECURITY;

-- Doctors see own ledger entries
CREATE POLICY "Doctors see own ledger"
ON public.ai_decision_ledger
FOR SELECT
TO authenticated
USING (auth.uid() = doctor_id);

-- Clinic staff insert ledger entries
CREATE POLICY "Clinic staff insert ledger"
ON public.ai_decision_ledger
FOR INSERT
TO authenticated
WITH CHECK (is_clinic_member(auth.uid(), clinic_id));

-- Doctors update own ledger (for recording action)
CREATE POLICY "Doctors update own ledger"
ON public.ai_decision_ledger
FOR UPDATE
TO authenticated
USING (auth.uid() = doctor_id);

-- Platform admins read all for audit
CREATE POLICY "Platform admins read ledger"
ON public.ai_decision_ledger
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Immutable: no deletes
