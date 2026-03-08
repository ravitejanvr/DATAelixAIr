
-- Clinic settings table for billing/payment configuration
CREATE TABLE IF NOT EXISTS public.clinic_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  consultation_fee numeric DEFAULT 500,
  followup_fee numeric DEFAULT 300,
  currency text DEFAULT 'INR',
  payment_methods jsonb DEFAULT '["cash","upi","card"]'::jsonb,
  lab_margin numeric DEFAULT 0,
  default_prescription_templates jsonb DEFAULT '[]'::jsonb,
  doctor_templates jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id)
);

ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff view settings" ON public.clinic_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = clinic_settings.clinic_id)
  );

CREATE POLICY "Clinic admins manage settings" ON public.clinic_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = clinic_settings.clinic_id)
    AND has_role(auth.uid(), 'clinic_admin'::app_role)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = clinic_settings.clinic_id)
    AND has_role(auth.uid(), 'clinic_admin'::app_role)
  );

CREATE POLICY "Platform admins manage all settings" ON public.clinic_settings
  FOR ALL USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- Lab catalog table
CREATE TABLE IF NOT EXISTS public.lab_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  test_name text NOT NULL,
  test_code text,
  category text DEFAULT 'general',
  price numeric DEFAULT 0,
  external_lab_partner text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.lab_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff view lab catalog" ON public.lab_catalog
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = lab_catalog.clinic_id)
  );

CREATE POLICY "Clinic admins manage lab catalog" ON public.lab_catalog
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = lab_catalog.clinic_id)
    AND has_role(auth.uid(), 'clinic_admin'::app_role)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = lab_catalog.clinic_id)
    AND has_role(auth.uid(), 'clinic_admin'::app_role)
  );

CREATE POLICY "Platform admins manage all lab catalogs" ON public.lab_catalog
  FOR ALL USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- Pharmacy orders table
CREATE TABLE IF NOT EXISTS public.pharmacy_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL,
  pharmacy_id text,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  status text DEFAULT 'pending',
  delivery_address text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.pharmacy_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff manage pharmacy orders" ON public.pharmacy_orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = pharmacy_orders.clinic_id)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = pharmacy_orders.clinic_id)
  );

-- Lab partner orders table
CREATE TABLE IF NOT EXISTS public.lab_partner_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id uuid NOT NULL REFERENCES public.lab_orders(id),
  lab_partner_id text,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  status text DEFAULT 'pending',
  appointment_time timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.lab_partner_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff manage lab partner orders" ON public.lab_partner_orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = lab_partner_orders.clinic_id)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = lab_partner_orders.clinic_id)
  );
