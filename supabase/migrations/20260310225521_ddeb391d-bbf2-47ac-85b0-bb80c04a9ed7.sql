
-- Drug ingredients table (RxNorm CUI-based)
CREATE TABLE public.drug_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rxnorm_cui text UNIQUE NOT NULL,
  generic_name text NOT NULL,
  ingredient_type text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drug_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read drug_ingredients" ON public.drug_ingredients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Platform admins manage drug_ingredients" ON public.drug_ingredients
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- Drug dosage forms
CREATE TABLE public.drug_dosage_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_cui text NOT NULL REFERENCES public.drug_ingredients(rxnorm_cui),
  dose text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'mg',
  route text NOT NULL DEFAULT 'oral',
  form text NOT NULL DEFAULT 'tablet',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drug_dosage_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read drug_dosage_forms" ON public.drug_dosage_forms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Platform admins manage drug_dosage_forms" ON public.drug_dosage_forms
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- Drug dose guidelines
CREATE TABLE public.drug_dose_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_cui text NOT NULL REFERENCES public.drug_ingredients(rxnorm_cui),
  adult_standard_dose text NOT NULL DEFAULT '',
  adult_max_dose text NOT NULL DEFAULT '',
  pediatric_dose text NOT NULL DEFAULT '',
  frequency_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration_defaults jsonb NOT NULL DEFAULT '[]'::jsonb,
  contraindications jsonb NOT NULL DEFAULT '[]'::jsonb,
  renal_adjustment text NOT NULL DEFAULT '',
  hepatic_adjustment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drug_dose_guidelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read drug_dose_guidelines" ON public.drug_dose_guidelines
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Platform admins manage drug_dose_guidelines" ON public.drug_dose_guidelines
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- Brand-to-generic mapping table
CREATE TABLE public.drug_brand_generic_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text NOT NULL,
  generic_name text NOT NULL,
  rxnorm_cui text,
  ingredient_cui text REFERENCES public.drug_ingredients(rxnorm_cui),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_drug_brand_generic_map_brand ON public.drug_brand_generic_map(lower(brand_name));
CREATE INDEX idx_drug_brand_generic_map_generic ON public.drug_brand_generic_map(lower(generic_name));
CREATE INDEX idx_drug_ingredients_generic ON public.drug_ingredients(lower(generic_name));

ALTER TABLE public.drug_brand_generic_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read drug_brand_generic_map" ON public.drug_brand_generic_map
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Platform admins manage drug_brand_generic_map" ON public.drug_brand_generic_map
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- Service role policies for ingestion functions
CREATE POLICY "Service role manage drug_ingredients" ON public.drug_ingredients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role manage drug_dosage_forms" ON public.drug_dosage_forms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role manage drug_dose_guidelines" ON public.drug_dose_guidelines
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role manage drug_brand_generic_map" ON public.drug_brand_generic_map
  FOR ALL TO service_role USING (true) WITH CHECK (true);
