
-- ============================================================
-- COGNITIVE LAYER DATABASE SCHEMA
-- ============================================================

-- 1. Episodic Case Memory — stores symptom vectors + final diagnoses for similarity retrieval
CREATE TABLE public.episodic_case_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID NOT NULL,
  symptom_vector TEXT[] NOT NULL DEFAULT '{}',
  chief_complaint TEXT,
  final_diagnosis TEXT,
  final_diagnosis_id UUID REFERENCES public.diagnoses(id) ON DELETE SET NULL,
  differential_diagnoses JSONB DEFAULT '[]',
  ai_top_diagnosis TEXT,
  was_ai_correct BOOLEAN,
  patient_age INTEGER,
  patient_sex TEXT,
  organ_system TEXT,
  confidence_score NUMERIC,
  outcome_status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_episodic_case_clinic ON public.episodic_case_memory(clinic_id);
CREATE INDEX idx_episodic_case_diagnosis ON public.episodic_case_memory(final_diagnosis);
CREATE INDEX idx_episodic_case_organ ON public.episodic_case_memory(organ_system);
CREATE INDEX idx_episodic_case_created ON public.episodic_case_memory(created_at DESC);

-- 2. Diagnostic Outcomes — confirmed diagnoses after clinical follow-up
CREATE TABLE public.diagnostic_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID NOT NULL,
  ai_diagnosis TEXT NOT NULL,
  ai_diagnosis_id UUID REFERENCES public.diagnoses(id) ON DELETE SET NULL,
  doctor_final_diagnosis TEXT NOT NULL,
  doctor_diagnosis_id UUID REFERENCES public.diagnoses(id) ON DELETE SET NULL,
  confirmed_diagnosis TEXT,
  confirmed_diagnosis_id UUID REFERENCES public.diagnoses(id) ON DELETE SET NULL,
  outcome_status TEXT NOT NULL DEFAULT 'pending',
  days_to_resolution INTEGER,
  treatment_effective BOOLEAN,
  follow_up_required BOOLEAN DEFAULT false,
  correction_type TEXT,
  similarity_score NUMERIC,
  metadata JSONB DEFAULT '{}',
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diag_outcomes_clinic ON public.diagnostic_outcomes(clinic_id);
CREATE INDEX idx_diag_outcomes_ai ON public.diagnostic_outcomes(ai_diagnosis);
CREATE INDEX idx_diag_outcomes_confirmed ON public.diagnostic_outcomes(confirmed_diagnosis);
CREATE INDEX idx_diag_outcomes_status ON public.diagnostic_outcomes(outcome_status);
CREATE INDEX idx_diag_outcomes_created ON public.diagnostic_outcomes(created_at DESC);

-- 3. Counterfactual Simulations — alternate reasoning outcomes
CREATE TABLE public.counterfactual_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  original_symptoms TEXT[] NOT NULL DEFAULT '{}',
  modified_symptoms TEXT[] NOT NULL DEFAULT '{}',
  modification_type TEXT NOT NULL DEFAULT 'removal',
  original_top_diagnosis TEXT,
  counterfactual_top_diagnosis TEXT,
  diagnosis_changed BOOLEAN DEFAULT false,
  fragility_score NUMERIC,
  critical_symptoms TEXT[] DEFAULT '{}',
  supporting_symptoms TEXT[] DEFAULT '{}',
  reasoning_trace JSONB DEFAULT '{}',
  execution_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_counterfactual_clinic ON public.counterfactual_simulations(clinic_id);
CREATE INDEX idx_counterfactual_created ON public.counterfactual_simulations(created_at DESC);

-- 4. Clustered Symptom Patterns — unsupervised discovery
CREATE TABLE public.clustered_symptom_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  cluster_id TEXT NOT NULL,
  symptom_set TEXT[] NOT NULL DEFAULT '{}',
  patient_count INTEGER NOT NULL DEFAULT 0,
  associated_diagnoses JSONB DEFAULT '[]',
  centroid_vector JSONB DEFAULT '[]',
  cluster_confidence NUMERIC,
  discovery_method TEXT DEFAULT 'frequency',
  first_detected TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  alert_level TEXT DEFAULT 'none',
  is_novel BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_clustered_clinic ON public.clustered_symptom_patterns(clinic_id);
CREATE INDEX idx_clustered_alert ON public.clustered_symptom_patterns(alert_level);
CREATE INDEX idx_clustered_novel ON public.clustered_symptom_patterns(is_novel) WHERE is_novel = true;
CREATE UNIQUE INDEX idx_clustered_unique ON public.clustered_symptom_patterns(clinic_id, cluster_id);

-- 5. Model Calibration Metrics — accuracy, calibration curves, uncertainty tracking
CREATE TABLE public.model_calibration_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  metric_period TEXT NOT NULL DEFAULT 'weekly',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_cases INTEGER NOT NULL DEFAULT 0,
  top1_accuracy NUMERIC DEFAULT 0,
  top3_accuracy NUMERIC DEFAULT 0,
  top5_accuracy NUMERIC DEFAULT 0,
  avg_confidence NUMERIC DEFAULT 0,
  calibration_error NUMERIC DEFAULT 0,
  overconfidence_rate NUMERIC DEFAULT 0,
  underconfidence_rate NUMERIC DEFAULT 0,
  danger_detection_rate NUMERIC DEFAULT 0,
  avg_latency_ms NUMERIC DEFAULT 0,
  correction_rate NUMERIC DEFAULT 0,
  learning_updates_applied INTEGER DEFAULT 0,
  breakdown_by_specialty JSONB DEFAULT '{}',
  breakdown_by_organ_system JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calibration_clinic ON public.model_calibration_metrics(clinic_id);
CREATE INDEX idx_calibration_period ON public.model_calibration_metrics(period_start DESC);

-- 6. Diagnostic Information Gain — evidence planning calculations
CREATE TABLE public.diagnostic_information_gain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  test_category TEXT,
  information_gain NUMERIC NOT NULL DEFAULT 0,
  discrimination_score NUMERIC DEFAULT 0,
  differentiates_between TEXT[] DEFAULT '{}',
  supports_diagnoses TEXT[] DEFAULT '{}',
  rules_out_diagnoses TEXT[] DEFAULT '{}',
  was_ordered BOOLEAN DEFAULT false,
  result_confirmed_hypothesis BOOLEAN,
  priority TEXT DEFAULT 'recommended',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_info_gain_clinic ON public.diagnostic_information_gain(clinic_id);
CREATE INDEX idx_info_gain_test ON public.diagnostic_information_gain(test_name);
CREATE INDEX idx_info_gain_created ON public.diagnostic_information_gain(created_at DESC);

-- 7. Learning Updates Log — tracks probability updates applied to graph
CREATE TABLE public.learning_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL DEFAULT 'prior_calibration',
  target_entity TEXT NOT NULL,
  target_id UUID,
  old_value NUMERIC,
  new_value NUMERIC,
  delta NUMERIC,
  direction TEXT,
  sample_size INTEGER DEFAULT 0,
  confidence TEXT DEFAULT 'low',
  source TEXT DEFAULT 'outcome_feedback',
  batch_id UUID,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reverted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_learning_updates_clinic ON public.learning_updates(clinic_id);
CREATE INDEX idx_learning_updates_type ON public.learning_updates(update_type);
CREATE INDEX idx_learning_updates_applied ON public.learning_updates(applied_at DESC);

-- Enable RLS on all cognitive tables
ALTER TABLE public.episodic_case_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counterfactual_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clustered_symptom_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_calibration_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_information_gain ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_updates ENABLE ROW LEVEL SECURITY;

-- RLS Policies — clinic member access
CREATE POLICY "Clinic members can read episodic_case_memory" ON public.episodic_case_memory FOR SELECT TO authenticated USING (public.is_clinic_member(auth.uid(), clinic_id));
CREATE POLICY "Clinic members can insert episodic_case_memory" ON public.episodic_case_memory FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can read diagnostic_outcomes" ON public.diagnostic_outcomes FOR SELECT TO authenticated USING (public.is_clinic_member(auth.uid(), clinic_id));
CREATE POLICY "Clinic members can insert diagnostic_outcomes" ON public.diagnostic_outcomes FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can read counterfactual_simulations" ON public.counterfactual_simulations FOR SELECT TO authenticated USING (public.is_clinic_member(auth.uid(), clinic_id));
CREATE POLICY "Clinic members can insert counterfactual_simulations" ON public.counterfactual_simulations FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can read clustered_symptom_patterns" ON public.clustered_symptom_patterns FOR SELECT TO authenticated USING (public.is_clinic_member(auth.uid(), clinic_id));
CREATE POLICY "Clinic members can insert clustered_symptom_patterns" ON public.clustered_symptom_patterns FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can read model_calibration_metrics" ON public.model_calibration_metrics FOR SELECT TO authenticated USING (public.is_clinic_member(auth.uid(), clinic_id));
CREATE POLICY "Clinic members can insert model_calibration_metrics" ON public.model_calibration_metrics FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can read diagnostic_information_gain" ON public.diagnostic_information_gain FOR SELECT TO authenticated USING (public.is_clinic_member(auth.uid(), clinic_id));
CREATE POLICY "Clinic members can insert diagnostic_information_gain" ON public.diagnostic_information_gain FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can read learning_updates" ON public.learning_updates FOR SELECT TO authenticated USING (public.is_clinic_member(auth.uid(), clinic_id));
CREATE POLICY "Clinic members can insert learning_updates" ON public.learning_updates FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(auth.uid(), clinic_id));

-- Service role policies for edge functions (benchmarks, async learning)
CREATE POLICY "Service role full access episodic_case_memory" ON public.episodic_case_memory FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access diagnostic_outcomes" ON public.diagnostic_outcomes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access counterfactual_simulations" ON public.counterfactual_simulations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access clustered_symptom_patterns" ON public.clustered_symptom_patterns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access model_calibration_metrics" ON public.model_calibration_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access diagnostic_information_gain" ON public.diagnostic_information_gain FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access learning_updates" ON public.learning_updates FOR ALL TO service_role USING (true) WITH CHECK (true);
