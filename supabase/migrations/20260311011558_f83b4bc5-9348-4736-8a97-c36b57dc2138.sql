
-- Add structured medication fields to prescriptions
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS frequency_code text,
  ADD COLUMN IF NOT EXISTS duration_days integer,
  ADD COLUMN IF NOT EXISTS guideline_reference text;

-- Add PRN and other frequency codes  
INSERT INTO public.dose_frequency_dictionary (code, meaning, times_per_day) VALUES
  ('PRN', 'as needed', 0),
  ('BID', 'twice daily', 2),
  ('QHS', 'at bedtime', 1),
  ('Q8H', 'every 8 hours', 3),
  ('Q6H', 'every 6 hours', 4),
  ('Q4H', 'every 4 hours', 6),
  ('Q12H', 'every 12 hours', 2),
  ('STAT', 'immediately once', 1),
  ('WEEKLY', 'once weekly', 0)
ON CONFLICT DO NOTHING;
