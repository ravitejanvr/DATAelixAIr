
-- Add visit_token column to patient_visits
ALTER TABLE public.patient_visits
ADD COLUMN visit_token text UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex');

-- Backfill existing rows
UPDATE public.patient_visits SET visit_token = encode(gen_random_bytes(24), 'hex') WHERE visit_token IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE public.patient_visits ALTER COLUMN visit_token SET NOT NULL;

-- Index for fast token lookups
CREATE INDEX idx_patient_visits_visit_token ON public.patient_visits (visit_token);

-- Create auto-generate trigger for visit_token
CREATE OR REPLACE FUNCTION public.generate_visit_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.visit_token IS NULL OR NEW.visit_token = '' THEN
    NEW.visit_token := encode(gen_random_bytes(24), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_visit_token
  BEFORE INSERT ON public.patient_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_visit_token();

-- =====================================================
-- Remove ALL overly permissive anon policies on clinical tables
-- =====================================================

-- patients: remove anon SELECT USING (true)
DROP POLICY IF EXISTS "Anon can read patient name for self-intake" ON public.patients;

-- patient_visits: remove anon SELECT USING (true)
DROP POLICY IF EXISTS "Anon can read visit for self-intake" ON public.patient_visits;

-- patient_visits: remove anon UPDATE (status scoped but still anon)
DROP POLICY IF EXISTS "Anon can update visit status for self-intake" ON public.patient_visits;

-- triage: remove anon INSERT WITH CHECK (true)
DROP POLICY IF EXISTS "Anon can insert triage for self-intake" ON public.triage;

-- patients: remove anon UPDATE (was already scoped but anon is risky)
DROP POLICY IF EXISTS "Anon can update patient from self-intake" ON public.patients;

-- =====================================================
-- Add minimal token-scoped anon policy for visit validation
-- (only returns visit_token match — no broad access)
-- =====================================================
CREATE POLICY "Anon validate visit by token"
ON public.patient_visits FOR SELECT TO anon
USING (
  visit_token = current_setting('request.headers', true)::json->>'x-visit-token'
);
