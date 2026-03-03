ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS edited_transcript text DEFAULT '';
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS extracted_data jsonb DEFAULT '{}'::jsonb;