
-- Latent clinical states (infection, perfusion, inflammation, cardiac, etc.)
CREATE TABLE public.latent_clinical_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state_name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- P(feature | latent_state) — how clinical features update latent states
CREATE TABLE public.feature_state_likelihoods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  latent_state_id UUID NOT NULL REFERENCES public.latent_clinical_states(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  log_likelihood_ratio DOUBLE PRECISION NOT NULL DEFAULT 0,
  context_notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(latent_state_id, feature_name)
);

-- P(diagnosis | latent_state) — how latent states activate diagnoses
CREATE TABLE public.diagnosis_state_likelihoods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnosis_id UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  latent_state_id UUID NOT NULL REFERENCES public.latent_clinical_states(id) ON DELETE CASCADE,
  log_likelihood_ratio DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(diagnosis_id, latent_state_id)
);

-- Disease category tags (replaces string-based classification)
CREATE TABLE public.diagnosis_category_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnosis_id UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(diagnosis_id, category)
);

-- RLS: read-only for authenticated users
ALTER TABLE public.latent_clinical_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_state_likelihoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnosis_state_likelihoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnosis_category_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read latent_clinical_states"
  ON public.latent_clinical_states FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read feature_state_likelihoods"
  ON public.feature_state_likelihoods FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read diagnosis_state_likelihoods"
  ON public.diagnosis_state_likelihoods FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read diagnosis_category_tags"
  ON public.diagnosis_category_tags FOR SELECT TO authenticated USING (true);
