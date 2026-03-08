-- Allow anon users to SELECT patient_visits by ID (for self-intake form validation)
CREATE POLICY "Anon can read visit for self-intake"
ON public.patient_visits
FOR SELECT
TO anon
USING (true);

-- Allow anon users to UPDATE visit status (for self-intake completion)
CREATE POLICY "Anon can update visit status for self-intake"
ON public.patient_visits
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Allow anon users to read patient name (for self-intake header)
CREATE POLICY "Anon can read patient name for self-intake"
ON public.patients
FOR SELECT
TO anon
USING (true);

-- Allow anon to update patient allergies/meds from self-intake
CREATE POLICY "Anon can update patient from self-intake"
ON public.patients
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Allow anon users to insert triage records (patient self-intake)
CREATE POLICY "Anon can insert triage for self-intake"
ON public.triage
FOR INSERT
TO anon
WITH CHECK (true);