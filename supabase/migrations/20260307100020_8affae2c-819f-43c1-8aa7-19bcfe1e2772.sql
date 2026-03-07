
-- Learning Layer: doctor_learning_signals table
-- Stores anonymized learning corrections after doctor validation
-- NO patient-identifiable data stored (no patient_id, no demographics)

CREATE TABLE public.doctor_learning_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL,
  clinic_id uuid REFERENCES public.clinics(id),
  signal_type text NOT NULL DEFAULT 'transcript_edit',
  signal_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for doctor-specific learning queries
CREATE INDEX idx_learning_signals_doctor ON public.doctor_learning_signals(doctor_id, signal_type);

-- Enable RLS
ALTER TABLE public.doctor_learning_signals ENABLE ROW LEVEL SECURITY;

-- Doctors can insert their own learning signals
CREATE POLICY "Doctors insert own learning signals"
  ON public.doctor_learning_signals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = doctor_id);

-- Doctors can read their own learning signals
CREATE POLICY "Doctors read own learning signals"
  ON public.doctor_learning_signals FOR SELECT
  TO authenticated
  USING (auth.uid() = doctor_id);

-- Platform admins can read all (for aggregate analytics, no PHI)
CREATE POLICY "Platform admins read all learning signals"
  ON public.doctor_learning_signals FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'::app_role));

-- Doctor documentation style preferences
CREATE TABLE public.doctor_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL UNIQUE,
  soap_style jsonb NOT NULL DEFAULT '{}'::jsonb,
  terminology_overrides jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred_templates jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_doctor_preferences_doctor ON public.doctor_preferences(doctor_id);

ALTER TABLE public.doctor_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors manage own preferences"
  ON public.doctor_preferences FOR ALL
  TO authenticated
  USING (auth.uid() = doctor_id)
  WITH CHECK (auth.uid() = doctor_id);
