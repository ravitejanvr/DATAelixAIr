ALTER TABLE public.consultations 
  ADD COLUMN IF NOT EXISTS stabilized_transcript text DEFAULT '',
  ADD COLUMN IF NOT EXISTS doctor_final_transcript text DEFAULT '',
  ADD COLUMN IF NOT EXISTS review_confirmed boolean DEFAULT false;