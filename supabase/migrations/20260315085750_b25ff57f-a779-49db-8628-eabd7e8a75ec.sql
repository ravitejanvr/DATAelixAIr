
-- Add is_active column to diagnoses to allow triaging zero-edge specialty diseases
ALTER TABLE public.diagnoses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Mark zero-edge diagnoses as inactive (specialty-only, unreachable by engine)
UPDATE public.diagnoses d
SET is_active = false
WHERE NOT EXISTS (
  SELECT 1 FROM public.symptom_likelihoods sl WHERE sl.diagnosis_id = d.id
);
