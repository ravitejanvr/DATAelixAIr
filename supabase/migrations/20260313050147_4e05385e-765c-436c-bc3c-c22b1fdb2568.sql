
-- Create disease_tests table for diagnostic investigations
CREATE TABLE IF NOT EXISTS public.disease_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disease_name TEXT NOT NULL,
  test_name TEXT NOT NULL,
  test_category TEXT NOT NULL DEFAULT 'laboratory',
  diagnostic_strength TEXT NOT NULL DEFAULT 'moderate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create disease_treatments table for guideline-based treatments
CREATE TABLE IF NOT EXISTS public.disease_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disease_name TEXT NOT NULL,
  drug_name TEXT NOT NULL,
  drug_class TEXT NOT NULL DEFAULT '',
  line_of_treatment TEXT NOT NULL DEFAULT 'first_line',
  guideline_source TEXT NOT NULL DEFAULT 'WHO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS (public read for clinical reference data)
ALTER TABLE public.disease_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disease_treatments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read disease_tests" ON public.disease_tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read disease_treatments" ON public.disease_treatments FOR SELECT TO authenticated USING (true);

-- Allow service role to insert (edge functions)
CREATE POLICY "Service role can insert disease_tests" ON public.disease_tests FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can insert disease_treatments" ON public.disease_treatments FOR INSERT TO service_role WITH CHECK (true);

-- Also allow service role to read/delete for maintenance
CREATE POLICY "Service role can manage disease_tests" ON public.disease_tests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage disease_treatments" ON public.disease_treatments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes for fast lookups
CREATE INDEX idx_disease_tests_disease ON public.disease_tests(disease_name);
CREATE INDEX idx_disease_treatments_disease ON public.disease_treatments(disease_name);
