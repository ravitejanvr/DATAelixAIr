-- Remove the overly broad policy that allows ANY profile-matched user to see patients
DROP POLICY IF EXISTS "Clinic staff view patients by clinic" ON public.patients;

-- Update the role-specific policy to also include receptionist (needed for registration flow)
DROP POLICY IF EXISTS "Clinical staff see clinic patients" ON public.patients;
CREATE POLICY "Clinical staff see clinic patients"
ON public.patients
FOR SELECT
TO authenticated
USING (
  clinic_id IS NOT NULL
  AND is_clinic_member(auth.uid(), clinic_id)
  AND (
    has_role(auth.uid(), 'nurse'::app_role)
    OR has_role(auth.uid(), 'allied_health'::app_role)
    OR has_role(auth.uid(), 'pharmacist'::app_role)
    OR has_role(auth.uid(), 'lab'::app_role)
    OR has_role(auth.uid(), 'care_coordinator'::app_role)
    OR has_role(auth.uid(), 'front_desk'::app_role)
    OR has_role(auth.uid(), 'clinic_admin'::app_role)
    OR has_role(auth.uid(), 'receptionist'::app_role)
  )
);