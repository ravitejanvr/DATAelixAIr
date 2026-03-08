
-- ============================================================
-- SCHEMA ALIGNMENT: Add missing columns to match ideal schema
-- ============================================================

-- 1. clinics: add country, timezone
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS country text DEFAULT 'IN';
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Asia/Kolkata';

-- 2. patients: add date_of_birth, address (keep existing doctor_id for backward compat)
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS address text DEFAULT '';

-- 3. patient_visits: add chief_complaint, created_by, visit_date
ALTER TABLE public.patient_visits ADD COLUMN IF NOT EXISTS chief_complaint text DEFAULT '';
ALTER TABLE public.patient_visits ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.patient_visits ADD COLUMN IF NOT EXISTS visit_date date DEFAULT CURRENT_DATE;

-- 4. monitoring_events: add clinic_id for tenant scoping
ALTER TABLE public.monitoring_events ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);

-- 5. lab_orders: add consultation_id for direct consultation link
ALTER TABLE public.lab_orders ADD COLUMN IF NOT EXISTS consultation_id uuid REFERENCES public.consultations(id);

-- 6. lab_results: simplify - ensure reported_at exists
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS reported_at timestamptz;

-- 7. invoices: add payment_status alias (currently 'status' serves this)
-- Already has status column, no change needed

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

-- Patients: phone lookup for returning patient detection
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON public.patients(clinic_id);

-- Patient visits: clinic scoping + date filtering
CREATE INDEX IF NOT EXISTS idx_patient_visits_clinic_id ON public.patient_visits(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_patient_id ON public.patient_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_visits_status ON public.patient_visits(status);
CREATE INDEX IF NOT EXISTS idx_patient_visits_visit_date ON public.patient_visits(visit_date);

-- Consultations: visit-based lookups
CREATE INDEX IF NOT EXISTS idx_consultations_visit_id ON public.consultations(visit_id);
CREATE INDEX IF NOT EXISTS idx_consultations_doctor_id ON public.consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_clinic_id ON public.consultations(clinic_id);

-- Prescriptions: consultation chain
CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation_id ON public.prescriptions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic_id ON public.prescriptions(clinic_id);

-- Lab orders: visit + consultation chain
CREATE INDEX IF NOT EXISTS idx_lab_orders_visit_id ON public.lab_orders(visit_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_consultation_id ON public.lab_orders(consultation_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_clinic_id ON public.lab_orders(clinic_id);

-- Lab results: order chain
CREATE INDEX IF NOT EXISTS idx_lab_results_lab_order_id ON public.lab_results(lab_order_id);

-- Vitals: visit-based
CREATE INDEX IF NOT EXISTS idx_vitals_visit_id ON public.vitals(visit_id);
CREATE INDEX IF NOT EXISTS idx_vitals_clinic_id ON public.vitals(clinic_id);

-- Invoices: visit-based
CREATE INDEX IF NOT EXISTS idx_invoices_visit_id ON public.invoices(visit_id);
CREATE INDEX IF NOT EXISTS idx_invoices_clinic_id ON public.invoices(clinic_id);

-- Triage: visit-based
CREATE INDEX IF NOT EXISTS idx_triage_visit_id ON public.triage(visit_id);
CREATE INDEX IF NOT EXISTS idx_triage_clinic_id ON public.triage(clinic_id);

-- Audit logs: clinic scoping + time queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_clinic_id ON public.audit_logs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- Clinic members: user lookup
CREATE INDEX IF NOT EXISTS idx_clinic_members_user_id ON public.clinic_members(user_id);
CREATE INDEX IF NOT EXISTS idx_clinic_members_clinic_id ON public.clinic_members(clinic_id);

-- Doctor favorites: doctor lookup
CREATE INDEX IF NOT EXISTS idx_doctor_favorites_doctor_id ON public.doctor_favorites(doctor_id);
