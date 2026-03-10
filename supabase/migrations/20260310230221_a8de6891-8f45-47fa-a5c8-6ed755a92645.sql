
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS generic_name text,
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS dose_value numeric,
  ADD COLUMN IF NOT EXISTS dose_unit text DEFAULT 'mg',
  ADD COLUMN IF NOT EXISTS max_daily_dose numeric,
  ADD COLUMN IF NOT EXISTS drug_cui text;
