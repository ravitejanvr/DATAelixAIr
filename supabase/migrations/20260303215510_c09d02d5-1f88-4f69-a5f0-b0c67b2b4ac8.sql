
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS safety_flags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS normalization_results jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS confidence_score text DEFAULT 'moderate';
