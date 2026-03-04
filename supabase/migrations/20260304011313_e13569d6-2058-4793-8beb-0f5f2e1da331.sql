
-- Create clinics table
CREATE TABLE public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  specialty text,
  phone text,
  email text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- Add clinic_id to existing tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id);

-- Add workflow_type to pilot_requests
ALTER TABLE public.pilot_requests ADD COLUMN IF NOT EXISTS workflow_type text DEFAULT 'general';

-- Clinic workflow configuration
CREATE TABLE public.clinic_workflow_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE UNIQUE,
  intake_enabled boolean DEFAULT true,
  vitals_required boolean DEFAULT true,
  lab_enabled boolean DEFAULT false,
  pharmacy_enabled boolean DEFAULT false,
  billing_enabled boolean DEFAULT true,
  workflow_order jsonb DEFAULT '["intake","vitals","doctor","lab","pharmacy","billing"]'::jsonb,
  default_consultation_fee numeric DEFAULT 0,
  favorite_prescriptions_enabled boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clinic_workflow_config ENABLE ROW LEVEL SECURITY;

-- Doctor favorite prescriptions
CREATE TABLE public.doctor_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL,
  clinic_id uuid REFERENCES public.clinics(id),
  generic_name text NOT NULL,
  preferred_brand text,
  default_dose text,
  frequency text,
  duration text,
  route text DEFAULT 'oral',
  instructions text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.doctor_favorites ENABLE ROW LEVEL SECURITY;

-- Patient visits (live visit tracker)
CREATE TABLE public.patient_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  consultation_id uuid REFERENCES public.consultations(id),
  status text NOT NULL DEFAULT 'registered',
  assigned_to uuid,
  visit_type text DEFAULT 'walk-in',
  check_in_time timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_visits ENABLE ROW LEVEL SECURITY;

-- Vitals (nurse module)
CREATE TABLE public.vitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES public.patient_visits(id),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  recorded_by uuid NOT NULL,
  bp_systolic integer,
  bp_diastolic integer,
  pulse integer,
  temperature numeric,
  spo2 integer,
  weight_kg numeric,
  blood_sugar numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;

-- Invoices (billing)
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid REFERENCES public.consultations(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  doctor_id uuid NOT NULL,
  consultation_fee numeric DEFAULT 0,
  procedures jsonb DEFAULT '[]'::jsonb,
  lab_charges jsonb DEFAULT '[]'::jsonb,
  discount numeric DEFAULT 0,
  total numeric DEFAULT 0,
  payment_mode text DEFAULT 'cash',
  invoice_number text,
  status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS for clinics
CREATE POLICY "Platform admins manage clinics" ON public.clinics FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin')) WITH CHECK (has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "Clinic members view own clinic" ON public.clinics FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND clinic_id = clinics.id));

-- RLS for clinic_workflow_config
CREATE POLICY "Platform admins manage all configs" ON public.clinic_workflow_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin')) WITH CHECK (has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "Clinic admins manage own config" ON public.clinic_workflow_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND clinic_id = clinic_workflow_config.clinic_id) AND has_role(auth.uid(), 'clinic_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND clinic_id = clinic_workflow_config.clinic_id) AND has_role(auth.uid(), 'clinic_admin'));
CREATE POLICY "Clinic staff view own config" ON public.clinic_workflow_config FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND clinic_id = clinic_workflow_config.clinic_id));

-- RLS for doctor_favorites
CREATE POLICY "Doctors manage own favorites" ON public.doctor_favorites FOR ALL TO authenticated
  USING (auth.uid() = doctor_id) WITH CHECK (auth.uid() = doctor_id);

-- RLS for patient_visits
CREATE POLICY "Clinic staff manage visits" ON public.patient_visits FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND clinic_id = patient_visits.clinic_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND clinic_id = patient_visits.clinic_id));

-- RLS for vitals
CREATE POLICY "Clinic staff manage vitals" ON public.vitals FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND clinic_id = vitals.clinic_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND clinic_id = vitals.clinic_id));

-- RLS for invoices
CREATE POLICY "Clinic staff manage invoices" ON public.invoices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND clinic_id = invoices.clinic_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND clinic_id = invoices.clinic_id));

-- Triggers for updated_at
CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clinic_workflow_config_updated_at BEFORE UPDATE ON public.clinic_workflow_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patient_visits_updated_at BEFORE UPDATE ON public.patient_visits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for patient_visits (live tracker)
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_visits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vitals;
