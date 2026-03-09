-- Clinical Alerts Table (Risk Detection Module)
CREATE TABLE public.clinical_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid REFERENCES public.consultations(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id uuid NOT NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  alert_type text NOT NULL DEFAULT 'symptom_combination',
  severity text NOT NULL DEFAULT 'warning',
  category text NOT NULL DEFAULT 'clinical_risk',
  title text NOT NULL,
  message text NOT NULL,
  matched_indicators jsonb DEFAULT '[]'::jsonb,
  action_hint text,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  override_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Medication Alerts Table (Medication Safety Monitor)
CREATE TABLE public.medication_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid REFERENCES public.consultations(id) ON DELETE CASCADE,
  prescription_id uuid REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id uuid NOT NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  alert_type text NOT NULL DEFAULT 'interaction',
  severity text NOT NULL DEFAULT 'warning',
  drug_a text,
  drug_b text,
  allergy_conflict text,
  dose_issue text,
  message text NOT NULL,
  rxnorm_ids jsonb DEFAULT '[]'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  override_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Diagnostic Flags Table (Diagnostic Consistency Checker)
CREATE TABLE public.diagnostic_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid REFERENCES public.consultations(id) ON DELETE CASCADE NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id uuid NOT NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  flag_type text NOT NULL DEFAULT 'inconsistency',
  severity text NOT NULL DEFAULT 'advisory',
  symptoms jsonb DEFAULT '[]'::jsonb,
  diagnosis text,
  tests_ordered jsonb DEFAULT '[]'::jsonb,
  treatment_plan text,
  inconsistency_detail text NOT NULL,
  recommendation text,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Risk Patterns Table (High-Risk Pattern Storage)
CREATE TABLE public.risk_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name text NOT NULL,
  pattern_type text NOT NULL DEFAULT 'symptom_combination',
  indicators jsonb NOT NULL DEFAULT '[]'::jsonb,
  severity text NOT NULL DEFAULT 'high',
  description text NOT NULL,
  action_hint text,
  specialty text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Population Signals Table (Population Pattern Monitor)
CREATE TABLE public.population_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  signal_type text NOT NULL DEFAULT 'outbreak',
  signal_name text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  affected_count integer NOT NULL DEFAULT 1,
  time_window_hours integer NOT NULL DEFAULT 24,
  indicators jsonb NOT NULL DEFAULT '[]'::jsonb,
  geographic_scope text,
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Outcome Tracking Table (Outcome Feedback Monitor)
CREATE TABLE public.outcome_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid REFERENCES public.consultations(id) ON DELETE CASCADE NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id uuid NOT NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  follow_up_scheduled_date date,
  follow_up_actual_date date,
  follow_up_missed boolean DEFAULT false,
  outcome_status text DEFAULT 'pending',
  outcome_notes text,
  treatment_effective boolean,
  adverse_events jsonb DEFAULT '[]'::jsonb,
  readmission_within_days integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_clinical_alerts_consultation ON public.clinical_alerts(consultation_id);
CREATE INDEX idx_clinical_alerts_clinic_date ON public.clinical_alerts(clinic_id, created_at DESC);
CREATE INDEX idx_clinical_alerts_severity ON public.clinical_alerts(severity) WHERE acknowledged_at IS NULL;

CREATE INDEX idx_medication_alerts_consultation ON public.medication_alerts(consultation_id);
CREATE INDEX idx_medication_alerts_clinic_date ON public.medication_alerts(clinic_id, created_at DESC);
CREATE INDEX idx_medication_alerts_severity ON public.medication_alerts(severity) WHERE acknowledged_at IS NULL;

CREATE INDEX idx_diagnostic_flags_consultation ON public.diagnostic_flags(consultation_id);
CREATE INDEX idx_diagnostic_flags_clinic ON public.diagnostic_flags(clinic_id, created_at DESC);

CREATE INDEX idx_population_signals_clinic ON public.population_signals(clinic_id, created_at DESC);
CREATE INDEX idx_population_signals_active ON public.population_signals(is_resolved, severity);

CREATE INDEX idx_outcome_tracking_consultation ON public.outcome_tracking(consultation_id);
CREATE INDEX idx_outcome_tracking_followup ON public.outcome_tracking(follow_up_scheduled_date) WHERE follow_up_missed = false;

-- Enable RLS
ALTER TABLE public.clinical_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.population_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcome_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clinical_alerts
CREATE POLICY "Doctors see own clinical alerts" ON public.clinical_alerts
  FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "Clinic staff see clinic alerts" ON public.clinical_alerts
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = clinical_alerts.clinic_id
  ));

CREATE POLICY "Authenticated insert clinical alerts" ON public.clinical_alerts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Doctors acknowledge own alerts" ON public.clinical_alerts
  FOR UPDATE USING (auth.uid() = doctor_id);

-- RLS Policies for medication_alerts
CREATE POLICY "Doctors see own medication alerts" ON public.medication_alerts
  FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "Clinic staff see clinic medication alerts" ON public.medication_alerts
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = medication_alerts.clinic_id
  ));

CREATE POLICY "Authenticated insert medication alerts" ON public.medication_alerts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Doctors acknowledge medication alerts" ON public.medication_alerts
  FOR UPDATE USING (auth.uid() = doctor_id);

-- RLS Policies for diagnostic_flags
CREATE POLICY "Doctors see own diagnostic flags" ON public.diagnostic_flags
  FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "Clinic staff see clinic diagnostic flags" ON public.diagnostic_flags
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = diagnostic_flags.clinic_id
  ));

CREATE POLICY "Authenticated insert diagnostic flags" ON public.diagnostic_flags
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Doctors acknowledge diagnostic flags" ON public.diagnostic_flags
  FOR UPDATE USING (auth.uid() = doctor_id);

-- RLS Policies for risk_patterns (platform managed)
CREATE POLICY "Anyone can read risk patterns" ON public.risk_patterns
  FOR SELECT USING (is_active = true);

CREATE POLICY "Platform admins manage risk patterns" ON public.risk_patterns
  FOR ALL USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- RLS Policies for population_signals
CREATE POLICY "Clinic staff see clinic signals" ON public.population_signals
  FOR SELECT USING (
    clinic_id IS NULL OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = population_signals.clinic_id
    )
  );

CREATE POLICY "Platform admins see all signals" ON public.population_signals
  FOR SELECT USING (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Authenticated insert population signals" ON public.population_signals
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Platform admins manage signals" ON public.population_signals
  FOR ALL USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- RLS Policies for outcome_tracking
CREATE POLICY "Doctors see own outcomes" ON public.outcome_tracking
  FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "Clinic staff see clinic outcomes" ON public.outcome_tracking
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = outcome_tracking.clinic_id
  ));

CREATE POLICY "Authenticated insert outcomes" ON public.outcome_tracking
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Doctors update own outcomes" ON public.outcome_tracking
  FOR UPDATE USING (auth.uid() = doctor_id);

-- Seed default risk patterns
INSERT INTO public.risk_patterns (pattern_name, pattern_type, indicators, severity, description, action_hint, specialty) VALUES
('Acute Coronary Syndrome', 'symptom_combination', '["chest pain", "shortness of breath", "radiating arm pain", "diaphoresis"]', 'critical', 'Symptoms suggestive of acute myocardial infarction or unstable angina', 'Consider urgent ECG and troponin testing. Evaluate for emergency referral.', 'cardiology'),
('Meningitis Alert', 'symptom_combination', '["severe headache", "neck stiffness", "fever", "photophobia"]', 'critical', 'Classic triad suggestive of bacterial meningitis', 'Urgent lumbar puncture and empiric antibiotics if suspected. Consider emergency referral.', 'neurology'),
('Dengue Warning Signs', 'symptom_combination', '["fever", "low platelet count", "abdominal pain", "persistent vomiting"]', 'high', 'Warning signs of severe dengue requiring close monitoring', 'Monitor for plasma leakage, bleeding, and organ impairment. Consider hospitalization.', 'infectious_disease'),
('Sepsis Alert', 'vitals_pattern', '["fever", "tachycardia", "tachypnea", "altered mental status"]', 'critical', 'Systemic inflammatory response with suspected infection', 'Urgent blood cultures, lactate, and broad-spectrum antibiotics. qSOFA assessment recommended.', 'emergency'),
('Diabetic Ketoacidosis', 'symptom_combination', '["polyuria", "polydipsia", "abdominal pain", "fruity breath", "high blood sugar"]', 'critical', 'Signs consistent with DKA requiring urgent management', 'Check blood glucose, ketones, ABG, and electrolytes. IV fluids and insulin therapy.', 'endocrinology'),
('Stroke Warning', 'symptom_combination', '["sudden weakness", "facial droop", "speech difficulty", "severe headache"]', 'critical', 'FAST symptoms suggestive of acute stroke', 'Time-critical. Document symptom onset time. Urgent CT and neurology consultation.', 'neurology'),
('Respiratory Distress', 'vitals_pattern', '["low oxygen saturation", "tachypnea", "accessory muscle use", "cyanosis"]', 'critical', 'Signs of acute respiratory failure', 'Supplemental oxygen, ABG, chest X-ray. Consider intubation if deteriorating.', 'pulmonology'),
('Pediatric Dehydration', 'symptom_combination', '["decreased urine output", "dry mucous membranes", "sunken eyes", "lethargy"]', 'high', 'Signs of moderate to severe dehydration in pediatric patient', 'Assess dehydration severity. ORS or IV fluids based on severity.', 'pediatrics');

-- Add realtime for critical alert tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.clinical_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.medication_alerts;