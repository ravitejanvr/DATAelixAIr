
CREATE TABLE IF NOT EXISTS public.medical_history_modifiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnosis_id UUID REFERENCES public.diagnoses(id) ON DELETE CASCADE NOT NULL,
  history_condition TEXT NOT NULL,
  prior_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  confidence NUMERIC NOT NULL DEFAULT 0.8,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(diagnosis_id, history_condition)
);

ALTER TABLE public.medical_history_modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on medical_history_modifiers"
  ON public.medical_history_modifiers
  FOR SELECT
  TO authenticated
  USING (true);
