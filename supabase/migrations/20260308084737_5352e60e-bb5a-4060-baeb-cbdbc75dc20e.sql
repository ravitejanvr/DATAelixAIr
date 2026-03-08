-- Allow any authenticated user to SELECT patient_visits (for self-intake form)
CREATE POLICY "Authenticated can read visit for self-intake"
ON public.patient_visits
FOR SELECT
TO authenticated
USING (true);

-- Allow any authenticated user to read patients (for self-intake name display)
CREATE POLICY "Authenticated can read patient for self-intake" 
ON public.patients
FOR SELECT
TO authenticated
USING (true);