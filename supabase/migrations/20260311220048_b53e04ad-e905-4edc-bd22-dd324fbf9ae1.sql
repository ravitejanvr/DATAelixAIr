
-- Outcome feedback table: tracks diagnosis → treatment → lab → recovery chain
CREATE TABLE IF NOT EXISTS public.outcome_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL,
  consultation_id uuid,
  patient_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  
  -- Clinical chain
  ai_diagnosis text NOT NULL,
  doctor_final_diagnosis text NOT NULL,
  diagnosis_match boolean DEFAULT false,
  treatment_prescribed jsonb DEFAULT '[]',
  lab_results_summary jsonb DEFAULT '{}',
  
  -- Outcome
  outcome_status text DEFAULT 'pending' CHECK (outcome_status IN ('pending', 'improved', 'unchanged', 'worsened', 'resolved', 'referred', 'unknown')),
  follow_up_required boolean DEFAULT false,
  days_to_resolution integer,
  readmission boolean DEFAULT false,
  
  -- Anonymized learning
  learning_signals jsonb DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_outcome_feedback_visit ON public.outcome_feedback(visit_id);
CREATE INDEX idx_outcome_feedback_clinic ON public.outcome_feedback(clinic_id);
CREATE INDEX idx_outcome_feedback_doctor ON public.outcome_feedback(doctor_id);
CREATE INDEX idx_outcome_feedback_status ON public.outcome_feedback(outcome_status);
CREATE INDEX idx_outcome_feedback_diagnosis ON public.outcome_feedback(ai_diagnosis);

ALTER TABLE public.outcome_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic members can view outcome feedback" ON public.outcome_feedback
  FOR SELECT TO authenticated USING (public.is_clinic_member(auth.uid(), clinic_id));
CREATE POLICY "Doctors can insert outcome feedback" ON public.outcome_feedback
  FOR INSERT TO authenticated WITH CHECK (doctor_id = auth.uid());
CREATE POLICY "Doctors can update own outcome feedback" ON public.outcome_feedback
  FOR UPDATE TO authenticated USING (doctor_id = auth.uid());

-- Bias metrics table for fairness monitoring
CREATE TABLE IF NOT EXISTS public.bias_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid,
  metric_type text NOT NULL CHECK (metric_type IN ('selection_bias', 'measurement_bias', 'label_bias', 'algorithmic_bias', 'demographic_parity', 'equalized_odds')),
  dimension text NOT NULL, -- e.g., 'age_group', 'gender', 'condition'
  dimension_value text NOT NULL, -- e.g., 'male', 'female', '18-30'
  
  -- Metrics
  sample_count integer DEFAULT 0,
  positive_rate numeric(5,4) DEFAULT 0,
  false_positive_rate numeric(5,4) DEFAULT 0,
  false_negative_rate numeric(5,4) DEFAULT 0,
  acceptance_rate numeric(5,4) DEFAULT 0,
  override_rate numeric(5,4) DEFAULT 0,
  
  -- Fairness scores
  disparity_score numeric(5,4) DEFAULT 0, -- deviation from baseline
  fairness_threshold numeric(5,4) DEFAULT 0.8, -- 80% rule threshold
  passes_fairness boolean DEFAULT true,
  
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bias_metrics_type ON public.bias_metrics(metric_type);
CREATE INDEX idx_bias_metrics_dimension ON public.bias_metrics(dimension, dimension_value);
CREATE INDEX idx_bias_metrics_period ON public.bias_metrics(period_start, period_end);

ALTER TABLE public.bias_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read bias metrics" ON public.bias_metrics
  FOR SELECT TO authenticated USING (true);
