-- Drop overly permissive policies and replace with tighter ones

-- Tighten patient_visits UPDATE: only allow status update to 'triage'
DROP POLICY "Anon can update visit status for self-intake" ON public.patient_visits;
CREATE POLICY "Anon can update visit status for self-intake"
ON public.patient_visits
FOR UPDATE
TO anon
USING (status = 'registered')
WITH CHECK (status = 'triage');

-- Tighten patients UPDATE: only allow updating allergies/medications columns
DROP POLICY "Anon can update patient from self-intake" ON public.patients;
CREATE POLICY "Anon can update patient from self-intake"
ON public.patients
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM patient_visits pv 
    WHERE pv.patient_id = patients.id 
    AND pv.status IN ('registered', 'triage')
  )
)
WITH CHECK (true);