
-- Clinical World Model tables

-- Component 2: Organ System Activation Rules
CREATE TABLE IF NOT EXISTS public.organ_system_activation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom text NOT NULL,
  organ_system text NOT NULL,
  activation_weight numeric(3,2) NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_osar_symptom_system ON public.organ_system_activation_rules(symptom, organ_system);
CREATE INDEX IF NOT EXISTS idx_osar_organ_system ON public.organ_system_activation_rules(organ_system);

ALTER TABLE public.organ_system_activation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on organ_system_activation_rules" ON public.organ_system_activation_rules FOR SELECT USING (true);

-- Component 9: Clinical Reasoning Traces
CREATE TABLE IF NOT EXISTS public.clinical_reasoning_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid REFERENCES public.patient_visits(id) ON DELETE CASCADE,
  validation_run_id text,
  scenario_id text,
  symptom text NOT NULL,
  physiology_process text NOT NULL,
  disease text NOT NULL,
  evidence_chain text NOT NULL,
  confidence numeric(4,3) DEFAULT 0.5,
  organ_system text,
  source text DEFAULT 'world_model',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crt_visit_id ON public.clinical_reasoning_traces(visit_id);
CREATE INDEX IF NOT EXISTS idx_crt_validation_run ON public.clinical_reasoning_traces(validation_run_id);

ALTER TABLE public.clinical_reasoning_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on clinical_reasoning_traces" ON public.clinical_reasoning_traces FOR SELECT USING (true);
CREATE POLICY "Allow service insert on clinical_reasoning_traces" ON public.clinical_reasoning_traces FOR INSERT WITH CHECK (true);
