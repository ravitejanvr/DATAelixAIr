
-- =============================================
-- Bayesian Reasoning Layer Tables
-- =============================================

-- 1. Disease Priors
CREATE TABLE IF NOT EXISTS public.disease_priors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  base_prevalence NUMERIC NOT NULL DEFAULT 0.05,
  age_modifier JSONB NOT NULL DEFAULT '{"pediatric": 1.0, "adult": 1.0, "elderly": 1.0}',
  sex_modifier JSONB NOT NULL DEFAULT '{"male": 1.0, "female": 1.0}',
  region_modifier JSONB NOT NULL DEFAULT '{"south_asia": 1.0, "global": 1.0}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(diagnosis_id)
);

-- 2. Symptom Likelihoods
CREATE TABLE IF NOT EXISTS public.symptom_likelihoods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  symptom_id UUID NOT NULL REFERENCES public.symptoms(id) ON DELETE CASCADE,
  likelihood_value NUMERIC NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(diagnosis_id, symptom_id)
);

-- 3. Physiology Likelihoods
CREATE TABLE IF NOT EXISTS public.physiology_likelihoods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  physiological_state_id UUID NOT NULL REFERENCES public.physiological_states(id) ON DELETE CASCADE,
  likelihood_value NUMERIC NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(diagnosis_id, physiological_state_id)
);

-- 4. Risk Factor Modifiers
CREATE TABLE IF NOT EXISTS public.risk_factor_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  risk_factor TEXT NOT NULL,
  modifier_weight NUMERIC NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(diagnosis_id, risk_factor)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_disease_priors_diagnosis ON public.disease_priors(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_symptom_likelihoods_diagnosis ON public.symptom_likelihoods(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_symptom_likelihoods_symptom ON public.symptom_likelihoods(symptom_id);
CREATE INDEX IF NOT EXISTS idx_physiology_likelihoods_diagnosis ON public.physiology_likelihoods(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_physiology_likelihoods_state ON public.physiology_likelihoods(physiological_state_id);
CREATE INDEX IF NOT EXISTS idx_risk_factor_modifiers_diagnosis ON public.risk_factor_modifiers(diagnosis_id);

-- RLS
ALTER TABLE public.disease_priors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_likelihoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physiology_likelihoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_factor_modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read disease_priors" ON public.disease_priors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read symptom_likelihoods" ON public.symptom_likelihoods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read physiology_likelihoods" ON public.physiology_likelihoods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read risk_factor_modifiers" ON public.risk_factor_modifiers FOR SELECT TO authenticated USING (true);

-- Service role insert/update
CREATE POLICY "Service insert disease_priors" ON public.disease_priors FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service insert symptom_likelihoods" ON public.symptom_likelihoods FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service insert physiology_likelihoods" ON public.physiology_likelihoods FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service insert risk_factor_modifiers" ON public.risk_factor_modifiers FOR INSERT TO service_role WITH CHECK (true);
