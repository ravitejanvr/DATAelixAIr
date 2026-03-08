-- Allow any authenticated user to insert triage for self-intake
CREATE POLICY "Authenticated can insert triage for self-intake"
ON public.triage
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow any authenticated user to update visit status for self-intake
CREATE POLICY "Authenticated can update visit for self-intake"
ON public.patient_visits
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow any authenticated user to update patient for self-intake
CREATE POLICY "Authenticated can update patient for self-intake"
ON public.patients
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);