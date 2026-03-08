
-- Drop all existing RESTRICTIVE policies on consultations
DROP POLICY IF EXISTS "Doctors see own consultations" ON public.consultations;
DROP POLICY IF EXISTS "Doctors create consultations" ON public.consultations;
DROP POLICY IF EXISTS "Doctors update own consultations" ON public.consultations;
DROP POLICY IF EXISTS "Doctors delete own consultations" ON public.consultations;
DROP POLICY IF EXISTS "Clinical staff see consultations" ON public.consultations;
DROP POLICY IF EXISTS "Patients see own consultations" ON public.consultations;

-- Recreate as PERMISSIVE policies (default)
CREATE POLICY "Doctors see own consultations"
  ON public.consultations FOR SELECT
  TO authenticated
  USING (auth.uid() = doctor_id);

CREATE POLICY "Doctors create consultations"
  ON public.consultations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = doctor_id AND is_doctor_for_patient(patient_id));

CREATE POLICY "Doctors update own consultations"
  ON public.consultations FOR UPDATE
  TO authenticated
  USING (auth.uid() = doctor_id);

CREATE POLICY "Doctors delete own consultations"
  ON public.consultations FOR DELETE
  TO authenticated
  USING (auth.uid() = doctor_id);

CREATE POLICY "Clinical staff see consultations"
  ON public.consultations FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'nurse'::app_role)
    OR has_role(auth.uid(), 'allied_health'::app_role)
    OR has_role(auth.uid(), 'pharmacist'::app_role)
    OR has_role(auth.uid(), 'lab'::app_role)
    OR has_role(auth.uid(), 'care_coordinator'::app_role)
  );

CREATE POLICY "Patients see own consultations"
  ON public.consultations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM patients
      WHERE patients.id = consultations.patient_id
        AND patients.patient_user_id = auth.uid()
    )
  );
