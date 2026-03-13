-- Phase 1: Symptom Specificity Scoring table
CREATE TABLE public.symptom_specificity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_id uuid REFERENCES public.symptoms(id) ON DELETE CASCADE,
  symptom_name text NOT NULL,
  specificity_score numeric(3,2) NOT NULL DEFAULT 0.5,
  organ_system text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_symptom_specificity_symptom_id ON public.symptom_specificity(symptom_id);
CREATE INDEX idx_symptom_specificity_organ_system ON public.symptom_specificity(organ_system);

ALTER TABLE public.symptom_specificity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on symptom_specificity" ON public.symptom_specificity FOR SELECT USING (true);

-- Phase 2: Organ System Weighting table
CREATE TABLE public.symptom_organ_system_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom text NOT NULL,
  organ_system text NOT NULL,
  weight numeric(3,2) NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_symptom_organ_system_unique ON public.symptom_organ_system_map(symptom, organ_system);
CREATE INDEX idx_symptom_organ_system_system ON public.symptom_organ_system_map(organ_system);

ALTER TABLE public.symptom_organ_system_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on symptom_organ_system_map" ON public.symptom_organ_system_map FOR SELECT USING (true);
