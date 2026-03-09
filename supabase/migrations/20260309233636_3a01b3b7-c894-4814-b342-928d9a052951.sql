
-- Guideline hierarchy table (extends existing clinical_guidelines with tier system)
-- The existing clinical_guidelines table has different columns, so we create a new
-- structured guideline registry for the hierarchy engine.
CREATE TABLE public.guideline_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization text NOT NULL,
  country text NOT NULL DEFAULT 'global',
  specialty text NOT NULL DEFAULT 'general',
  tier integer NOT NULL DEFAULT 5 CHECK (tier >= 1 AND tier <= 5),
  version text NOT NULL DEFAULT '1.0',
  publication_date date,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  recommendation_text text NOT NULL DEFAULT '',
  condition text NOT NULL DEFAULT '',
  keywords text[] NOT NULL DEFAULT '{}',
  applicable_drugs text[] NOT NULL DEFAULT '{}',
  applicable_tests text[] NOT NULL DEFAULT '{}',
  guideline_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.guideline_registry ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read guidelines
CREATE POLICY "Authenticated read guidelines"
ON public.guideline_registry
FOR SELECT
TO authenticated
USING (is_active = true);

-- Platform admins manage guidelines
CREATE POLICY "Platform admins manage guidelines"
ON public.guideline_registry
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- Guideline usage logs
CREATE TABLE public.guideline_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.patient_visits(id) ON DELETE CASCADE,
  guideline_id uuid NOT NULL REFERENCES public.guideline_registry(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  tier integer NOT NULL,
  matched_condition text,
  recommendation_used text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.guideline_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff manage guideline logs"
ON public.guideline_usage_logs
FOR ALL
TO authenticated
USING (is_clinic_member(auth.uid(), clinic_id))
WITH CHECK (is_clinic_member(auth.uid(), clinic_id));

-- Platform admins read all logs
CREATE POLICY "Platform admins read guideline logs"
ON public.guideline_usage_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'platform_admin'::app_role));
