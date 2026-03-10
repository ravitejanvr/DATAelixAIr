
CREATE TABLE public.ai_pipeline_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  legacy_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  modular_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  comparison_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_pipeline_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage pipeline tests"
ON public.ai_pipeline_tests
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));
