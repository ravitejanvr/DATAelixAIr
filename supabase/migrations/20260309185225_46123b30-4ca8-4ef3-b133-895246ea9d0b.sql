
-- =====================================================
-- CLINICAL DATA RLS HARDENING: Enforce clinic_id isolation
-- =====================================================

-- =====================================================
-- 1. PATIENTS — Remove overly permissive authenticated policies
-- =====================================================

-- Drop the blanket "any authenticated user can read ALL patients" policy
DROP POLICY IF EXISTS "Authenticated can read patient for self-intake" ON public.patients;
-- Drop the blanket "any authenticated user can update ALL patients" policy
DROP POLICY IF EXISTS "Authenticated can update patient for self-intake" ON public.patients;

-- Replace: authenticated patients can only see their OWN record via patient_user_id
CREATE POLICY "Patients read own record via user id"
ON public.patients FOR SELECT TO authenticated
USING (patient_user_id = auth.uid());

-- Replace: authenticated patients can only update their OWN record
CREATE POLICY "Patients update own record via user id"
ON public.patients FOR UPDATE TO authenticated
USING (patient_user_id = auth.uid())
WITH CHECK (patient_user_id = auth.uid());

-- Fix: Clinical staff see assigned patients — add clinic filter
DROP POLICY IF EXISTS "Clinical staff see assigned patients" ON public.patients;
CREATE POLICY "Clinical staff see clinic patients"
ON public.patients FOR SELECT TO authenticated
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
  )
);

-- Fix: Clinical staff create patients — add clinic check
DROP POLICY IF EXISTS "Clinical staff create patients" ON public.patients;
CREATE POLICY "Clinical staff create patients"
ON public.patients FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = doctor_id
  OR (
    clinic_id IS NOT NULL
    AND is_clinic_member(auth.uid(), clinic_id)
    AND (
      has_role(auth.uid(), 'receptionist'::app_role)
      OR has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'front_desk'::app_role)
    )
  )
);

-- =====================================================
-- 2. PATIENT_VISITS — Remove overly permissive authenticated policies
-- =====================================================

DROP POLICY IF EXISTS "Authenticated can read visit for self-intake" ON public.patient_visits;
DROP POLICY IF EXISTS "Authenticated can update visit for self-intake" ON public.patient_visits;

-- Patients can see their own visits
CREATE POLICY "Patients read own visits"
ON public.patient_visits FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = patient_visits.patient_id
    AND p.patient_user_id = auth.uid()
  )
);

-- Patients can update their own visit (for self-intake status transition)
CREATE POLICY "Patients update own visits for intake"
ON public.patient_visits FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = patient_visits.patient_id
    AND p.patient_user_id = auth.uid()
  )
  AND status IN ('registered', 'triage')
)
WITH CHECK (status IN ('registered', 'triage', 'intake_complete'));

-- =====================================================
-- 3. CONSULTATIONS — Add clinic isolation for clinical staff
-- =====================================================

DROP POLICY IF EXISTS "Clinical staff see consultations" ON public.consultations;
CREATE POLICY "Clinical staff see clinic consultations"
ON public.consultations FOR SELECT TO authenticated
USING (
  clinic_id IS NOT NULL
  AND is_clinic_member(auth.uid(), clinic_id)
  AND (
    has_role(auth.uid(), 'nurse'::app_role)
    OR has_role(auth.uid(), 'allied_health'::app_role)
    OR has_role(auth.uid(), 'pharmacist'::app_role)
    OR has_role(auth.uid(), 'lab'::app_role)
    OR has_role(auth.uid(), 'care_coordinator'::app_role)
  )
);

-- =====================================================
-- 4. PRESCRIPTIONS — Add clinic isolation for pharmacists
-- =====================================================

DROP POLICY IF EXISTS "Pharmacists see prescriptions" ON public.prescriptions;
CREATE POLICY "Pharmacists see clinic prescriptions"
ON public.prescriptions FOR SELECT TO authenticated
USING (
  clinic_id IS NOT NULL
  AND is_clinic_member(auth.uid(), clinic_id)
  AND has_role(auth.uid(), 'pharmacist'::app_role)
);

-- =====================================================
-- 5. VITALS — Ensure using is_clinic_member for consistency
-- =====================================================

DROP POLICY IF EXISTS "Clinic staff manage vitals" ON public.vitals;
CREATE POLICY "Clinic staff manage vitals"
ON public.vitals FOR ALL TO authenticated
USING (is_clinic_member(auth.uid(), clinic_id))
WITH CHECK (is_clinic_member(auth.uid(), clinic_id));

-- =====================================================
-- 6. TRIAGE — Tighten authenticated insert (scope to clinic member)
-- =====================================================

DROP POLICY IF EXISTS "Authenticated can insert triage for self-intake" ON public.triage;
CREATE POLICY "Patients insert triage for self-intake"
ON public.triage FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = triage.patient_id
    AND p.patient_user_id = auth.uid()
  )
  OR is_clinic_member(auth.uid(), clinic_id)
);
