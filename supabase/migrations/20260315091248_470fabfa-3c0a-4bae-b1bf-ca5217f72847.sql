
-- ═══════════════════════════════════════════════════
-- TIER-1 SIGNAL MODIFIER TABLES
-- Duration, Onset, Vital Sign, and Cluster modifiers
-- ═══════════════════════════════════════════════════

-- 1. Duration modifiers: acute/subacute/chronic symptom duration affects disease probability
CREATE TABLE IF NOT EXISTS public.duration_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  duration_category TEXT NOT NULL CHECK (duration_category IN ('acute', 'subacute', 'chronic')),
  modifier_weight NUMERIC NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(diagnosis_id, duration_category)
);

-- 2. Onset pattern modifiers: sudden/gradual/progressive onset affects disease probability
CREATE TABLE IF NOT EXISTS public.onset_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  onset_pattern TEXT NOT NULL CHECK (onset_pattern IN ('sudden', 'gradual', 'progressive', 'intermittent', 'episodic')),
  modifier_weight NUMERIC NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(diagnosis_id, onset_pattern)
);

-- 3. Vital sign modifiers: specific vital sign abnormalities affecting disease likelihood
CREATE TABLE IF NOT EXISTS public.vital_sign_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  vital_parameter TEXT NOT NULL,
  condition TEXT NOT NULL,
  threshold_value NUMERIC,
  modifier_weight NUMERIC NOT NULL DEFAULT 1.2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(diagnosis_id, vital_parameter, condition)
);

-- 4. Symptom cluster modifiers: multi-symptom patterns that strongly predict specific diseases
CREATE TABLE IF NOT EXISTS public.symptom_cluster_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  cluster_name TEXT NOT NULL,
  required_symptoms TEXT[] NOT NULL,
  min_match_count INTEGER NOT NULL DEFAULT 2,
  modifier_weight NUMERIC NOT NULL DEFAULT 2.0,
  evidence_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(diagnosis_id, cluster_name)
);

-- Enable RLS
ALTER TABLE public.duration_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onset_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vital_sign_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_cluster_modifiers ENABLE ROW LEVEL SECURITY;

-- Read-only policies for authenticated users
CREATE POLICY "Authenticated read duration_modifiers" ON public.duration_modifiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read onset_modifiers" ON public.onset_modifiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read vital_sign_modifiers" ON public.vital_sign_modifiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read symptom_cluster_modifiers" ON public.symptom_cluster_modifiers FOR SELECT TO authenticated USING (true);

-- Service role needs full access for edge functions
CREATE POLICY "Service role full access duration_modifiers" ON public.duration_modifiers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access onset_modifiers" ON public.onset_modifiers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access vital_sign_modifiers" ON public.vital_sign_modifiers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access symptom_cluster_modifiers" ON public.symptom_cluster_modifiers FOR ALL TO service_role USING (true) WITH CHECK (true);
