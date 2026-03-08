
-- Add token_number to patient_visits
ALTER TABLE public.patient_visits ADD COLUMN IF NOT EXISTS token_number integer;

-- Function to auto-generate daily token numbers per clinic
CREATE OR REPLACE FUNCTION public.generate_token_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_token integer;
BEGIN
  SELECT COALESCE(MAX(token_number), 0) + 1
  INTO next_token
  FROM public.patient_visits
  WHERE clinic_id = NEW.clinic_id
    AND check_in_time::date = CURRENT_DATE;
  
  NEW.token_number := next_token;
  RETURN NEW;
END;
$$;

-- Trigger to auto-assign token on insert
DROP TRIGGER IF EXISTS trg_generate_token ON public.patient_visits;
CREATE TRIGGER trg_generate_token
  BEFORE INSERT ON public.patient_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_token_number();
