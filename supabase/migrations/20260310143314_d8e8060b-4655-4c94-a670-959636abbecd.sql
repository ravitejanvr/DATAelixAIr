
-- 1. drug_master table
CREATE TABLE public.drug_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generic_name text UNIQUE NOT NULL,
  drug_class text NOT NULL DEFAULT '',
  mechanism text NOT NULL DEFAULT '',
  max_daily_dose_mg integer,
  pregnancy_category text DEFAULT 'unknown',
  renal_adjustment text DEFAULT '',
  hepatic_adjustment text DEFAULT '',
  common_indications text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.drug_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read drug_master" ON public.drug_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage drug_master" ON public.drug_master FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- 2. drug_brands table
CREATE TABLE public.drug_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text NOT NULL,
  generic_name text NOT NULL REFERENCES public.drug_master(generic_name) ON DELETE CASCADE,
  strength text DEFAULT '',
  manufacturer text DEFAULT '',
  country text DEFAULT 'India',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.drug_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read drug_brands" ON public.drug_brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage drug_brands" ON public.drug_brands FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- 3. drug_interactions table
CREATE TABLE public.drug_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_a text NOT NULL,
  drug_b text NOT NULL,
  severity text NOT NULL DEFAULT 'moderate',
  interaction_description text NOT NULL DEFAULT '',
  recommended_action text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.drug_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read drug_interactions" ON public.drug_interactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage drug_interactions" ON public.drug_interactions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- 4. dose_frequency_dictionary table
CREATE TABLE public.dose_frequency_dictionary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  meaning text NOT NULL DEFAULT '',
  times_per_day integer NOT NULL DEFAULT 1
);
ALTER TABLE public.dose_frequency_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read dose_frequency" ON public.dose_frequency_dictionary FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage dose_frequency" ON public.dose_frequency_dictionary FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));
