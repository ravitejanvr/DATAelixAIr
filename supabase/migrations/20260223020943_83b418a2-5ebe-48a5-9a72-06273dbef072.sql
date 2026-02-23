-- Add additional patient parameters for regulatory compliance and bias elimination
ALTER TABLE public.patients 
  ADD COLUMN IF NOT EXISTS height_cm numeric NULL,
  ADD COLUMN IF NOT EXISTS weight_kg numeric NULL,
  ADD COLUMN IF NOT EXISTS bmi numeric GENERATED ALWAYS AS (
    CASE WHEN height_cm > 0 AND weight_kg > 0 
    THEN ROUND(weight_kg / ((height_cm / 100.0) * (height_cm / 100.0)), 1) 
    ELSE NULL END
  ) STORED,
  ADD COLUMN IF NOT EXISTS blood_group text NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lifestyle_factors jsonb NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS occupation text NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS smoking_status text NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS alcohol_use text NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS exercise_frequency text NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS dietary_preference text NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS family_history jsonb NULL DEFAULT '[]';

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_patients_doctor_id ON public.patients(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_doctor_id ON public.consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON public.consultations(patient_id);