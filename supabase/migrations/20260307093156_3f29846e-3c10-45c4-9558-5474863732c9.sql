
-- ============================================================
-- VISIT-BASED CLINICAL SCHEMA MIGRATION
-- Transition from document-based to visit-centric timeline model
-- ============================================================

-- 1. Add visit_id to consultations (link clinical notes to visits)
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS visit_id uuid REFERENCES public.patient_visits(id);

-- 2. Add visit_id to prescriptions
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS visit_id uuid REFERENCES public.patient_visits(id);

-- 3. Add visit_id to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS visit_id uuid REFERENCES public.patient_visits(id);

-- 4. Create lab_orders table
CREATE TABLE IF NOT EXISTS public.lab_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.patient_visits(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  doctor_id uuid NOT NULL,
  order_number text,
  test_name text NOT NULL,
  test_code text,
  category text DEFAULT 'general',
  priority text DEFAULT 'routine',
  status text NOT NULL DEFAULT 'ordered',
  notes text,
  ordered_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Create lab_results table
CREATE TABLE IF NOT EXISTS public.lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id uuid NOT NULL REFERENCES public.lab_orders(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL REFERENCES public.patient_visits(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  parameter_name text NOT NULL,
  value text NOT NULL,
  unit text,
  reference_range text,
  is_abnormal boolean DEFAULT false,
  notes text,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Enable RLS
ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for lab_orders
CREATE POLICY "Clinic staff manage lab orders"
  ON public.lab_orders FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = lab_orders.clinic_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = lab_orders.clinic_id
  ));

CREATE POLICY "Doctors see own lab orders"
  ON public.lab_orders FOR SELECT TO authenticated
  USING (auth.uid() = doctor_id);

-- 8. RLS policies for lab_results
CREATE POLICY "Clinic staff manage lab results"
  ON public.lab_results FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = lab_results.clinic_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = lab_results.clinic_id
  ));

CREATE POLICY "Patients see own lab results"
  ON public.lab_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM patients WHERE patients.id = lab_results.patient_id AND patients.patient_user_id = auth.uid()
  ));

-- 9. Performance indexes for visit-based queries
-- patient_visits (central entity)
CREATE INDEX IF NOT EXISTS idx_patient_visits_clinic_id ON public.patient_visits(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_patient_id ON public.patient_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_status ON public.patient_visits(status);
CREATE INDEX IF NOT EXISTS idx_patient_visits_check_in ON public.patient_visits(check_in_time DESC);

-- consultations
CREATE INDEX IF NOT EXISTS idx_consultations_visit_id ON public.consultations(visit_id);
CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON public.consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_doctor_id ON public.consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_clinic_id ON public.consultations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON public.consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_created ON public.consultations(created_at DESC);

-- prescriptions
CREATE INDEX IF NOT EXISTS idx_prescriptions_visit_id ON public.prescriptions(visit_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation_id ON public.prescriptions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic_id ON public.prescriptions(clinic_id);

-- vitals
CREATE INDEX IF NOT EXISTS idx_vitals_visit_id ON public.vitals(visit_id);
CREATE INDEX IF NOT EXISTS idx_vitals_patient_id ON public.vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_clinic_id ON public.vitals(clinic_id);
CREATE INDEX IF NOT EXISTS idx_vitals_created ON public.vitals(created_at DESC);

-- invoices
CREATE INDEX IF NOT EXISTS idx_invoices_visit_id ON public.invoices(visit_id);
CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON public.invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_clinic_id ON public.invoices(clinic_id);

-- lab_orders
CREATE INDEX IF NOT EXISTS idx_lab_orders_visit_id ON public.lab_orders(visit_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient_id ON public.lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_clinic_id ON public.lab_orders(clinic_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_doctor_id ON public.lab_orders(doctor_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON public.lab_orders(status);

-- lab_results
CREATE INDEX IF NOT EXISTS idx_lab_results_lab_order_id ON public.lab_results(lab_order_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_visit_id ON public.lab_results(visit_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_patient_id ON public.lab_results(patient_id);

-- patients
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON public.patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_doctor_id ON public.patients(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_patient_user_id ON public.patients(patient_user_id);

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON public.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_clinic_id ON public.profiles(clinic_id);

-- Enable realtime for lab tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_results;

-- updated_at triggers
CREATE TRIGGER update_lab_orders_updated_at
  BEFORE UPDATE ON public.lab_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
