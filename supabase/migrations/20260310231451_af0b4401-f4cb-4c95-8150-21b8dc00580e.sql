
-- Create clinical_condition_map for semantic diagnosis matching
CREATE TABLE IF NOT EXISTS public.clinical_condition_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_id text NOT NULL,
  canonical_condition text NOT NULL,
  synonyms text[] NOT NULL DEFAULT '{}',
  icd10_codes text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.clinical_condition_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read clinical_condition_map" ON public.clinical_condition_map
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Platform admins manage clinical_condition_map" ON public.clinical_condition_map
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Service role manage clinical_condition_map" ON public.clinical_condition_map
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX idx_condition_map_condition_id ON public.clinical_condition_map(condition_id);

-- Create lab_test_equivalence for semantic lab matching
CREATE TABLE IF NOT EXISTS public.lab_test_equivalence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  loinc_code text,
  category text NOT NULL DEFAULT 'general',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_test_equivalence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read lab_test_equivalence" ON public.lab_test_equivalence
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Platform admins manage lab_test_equivalence" ON public.lab_test_equivalence
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Service role manage lab_test_equivalence" ON public.lab_test_equivalence
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed clinical conditions
INSERT INTO public.clinical_condition_map (condition_id, canonical_condition, synonyms, icd10_codes) VALUES
  ('viral_syndrome', 'Viral Syndrome', ARRAY['viral fever', 'influenza', 'flu', 'common cold', 'upper respiratory tract infection', 'urti', 'viral infection', 'acute viral illness', 'viral pharyngitis'], ARRAY['J06.9', 'J11.1', 'B34.9']),
  ('acute_coronary_syndrome', 'Acute Coronary Syndrome', ARRAY['myocardial infarction', 'mi', 'heart attack', 'unstable angina', 'nstemi', 'stemi', 'acute mi', 'coronary event', 'acs'], ARRAY['I21.9', 'I20.0', 'I24.9']),
  ('gastroenteritis', 'Gastroenteritis', ARRAY['stomach flu', 'food poisoning', 'acute gastroenteritis', 'age', 'gastro', 'gi infection', 'viral gastroenteritis', 'bacterial gastroenteritis', 'diarrheal disease'], ARRAY['K52.9', 'A09', 'K59.1']),
  ('pneumonia', 'Pneumonia', ARRAY['community acquired pneumonia', 'cap', 'lower respiratory infection', 'lrti', 'lung infection', 'bronchopneumonia', 'lobar pneumonia', 'bacterial pneumonia', 'viral pneumonia'], ARRAY['J18.9', 'J15.9', 'J12.9']),
  ('urinary_tract_infection', 'Urinary Tract Infection', ARRAY['uti', 'cystitis', 'bladder infection', 'urinary infection', 'acute cystitis', 'pyelonephritis'], ARRAY['N39.0', 'N30.0', 'N10']),
  ('hypertension', 'Hypertension', ARRAY['high blood pressure', 'htn', 'essential hypertension', 'elevated bp', 'hypertensive disorder'], ARRAY['I10', 'I11.9']),
  ('type_2_diabetes', 'Type 2 Diabetes Mellitus', ARRAY['diabetes', 'dm', 't2dm', 'type 2 dm', 'diabetes mellitus', 'sugar', 'hyperglycemia', 'diabetic'], ARRAY['E11.9', 'E11.65']),
  ('asthma', 'Asthma', ARRAY['bronchial asthma', 'reactive airway disease', 'asthmatic bronchitis', 'wheezing', 'bronchospasm'], ARRAY['J45.9', 'J45.20']),
  ('migraine', 'Migraine', ARRAY['migraine headache', 'vascular headache', 'migraine with aura', 'migraine without aura', 'hemicranial headache'], ARRAY['G43.9', 'G43.0']),
  ('pharyngitis', 'Pharyngitis', ARRAY['sore throat', 'strep throat', 'tonsillitis', 'acute pharyngitis', 'tonsillopharyngitis', 'streptococcal pharyngitis'], ARRAY['J02.9', 'J03.9']),
  ('bronchitis', 'Bronchitis', ARRAY['acute bronchitis', 'chest cold', 'tracheobronchitis', 'bronchial infection'], ARRAY['J20.9', 'J40']),
  ('dengue', 'Dengue Fever', ARRAY['dengue', 'dengue hemorrhagic fever', 'dhf', 'breakbone fever', 'dengue shock syndrome'], ARRAY['A90', 'A91']),
  ('malaria', 'Malaria', ARRAY['plasmodium infection', 'p. vivax', 'p. falciparum', 'malarial fever'], ARRAY['B54', 'B50.9']);

-- Seed lab test equivalences
INSERT INTO public.lab_test_equivalence (canonical_name, aliases, category) VALUES
  ('Complete Blood Count', ARRAY['cbc', 'full blood count', 'fbc', 'hemogram', 'complete hemogram', 'blood count'], 'hematology'),
  ('Troponin', ARRAY['hs-ctn', 'hs-ctni', 'troponin i', 'troponin t', 'cardiac troponin', 'trop', 'high sensitivity troponin'], 'cardiac'),
  ('Blood Glucose', ARRAY['blood sugar', 'fasting glucose', 'fbs', 'rbs', 'random blood sugar', 'fasting blood sugar', 'glucose level', 'sugar level'], 'biochemistry'),
  ('HbA1c', ARRAY['glycated hemoglobin', 'a1c', 'hemoglobin a1c', 'hba1c test', 'glycosylated hemoglobin'], 'biochemistry'),
  ('Liver Function Test', ARRAY['lft', 'hepatic panel', 'liver panel', 'liver enzymes', 'sgot', 'sgpt', 'alt', 'ast', 'bilirubin'], 'biochemistry'),
  ('Renal Function Test', ARRAY['rft', 'kidney function test', 'kft', 'renal panel', 'bun', 'creatinine', 'serum creatinine'], 'biochemistry'),
  ('Lipid Profile', ARRAY['lipid panel', 'cholesterol test', 'cholesterol panel', 'fasting lipids', 'total cholesterol', 'ldl', 'hdl', 'triglycerides'], 'biochemistry'),
  ('Chest X-Ray', ARRAY['cxr', 'chest radiograph', 'chest xray', 'pa chest', 'x-ray chest'], 'radiology'),
  ('Urinalysis', ARRAY['urine analysis', 'urine routine', 'urine r/m', 'urine test', 'urine examination'], 'pathology'),
  ('ECG', ARRAY['electrocardiogram', 'ekg', '12 lead ecg', 'ecg test', 'cardiac rhythm test'], 'cardiac'),
  ('Thyroid Function Test', ARRAY['tft', 'thyroid panel', 'tsh', 't3', 't4', 'thyroid test', 'free t4'], 'endocrine'),
  ('Dengue NS1', ARRAY['ns1 antigen', 'dengue antigen', 'ns1', 'dengue ns1 antigen test'], 'infectious'),
  ('Malaria Smear', ARRAY['peripheral smear for malaria', 'mp', 'malaria parasite', 'thick smear', 'thin smear', 'malarial smear'], 'infectious'),
  ('Blood Culture', ARRAY['blood c/s', 'blood culture sensitivity', 'aerobic culture', 'anaerobic culture'], 'microbiology'),
  ('C-Reactive Protein', ARRAY['crp', 'hs-crp', 'high sensitivity crp', 'c reactive protein'], 'biochemistry'),
  ('Erythrocyte Sedimentation Rate', ARRAY['esr', 'sed rate', 'sedimentation rate'], 'hematology'),
  ('Procalcitonin', ARRAY['pct', 'procalcitonin level'], 'biochemistry'),
  ('D-Dimer', ARRAY['d dimer', 'fibrin degradation', 'd-dimer test'], 'hematology'),
  ('BNP', ARRAY['bnp', 'nt-probnp', 'brain natriuretic peptide', 'pro-bnp', 'natriuretic peptide'], 'cardiac');
