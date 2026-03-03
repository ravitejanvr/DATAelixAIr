
-- Phase 4: Regional lexicon table
CREATE TABLE public.regional_lexicon (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language text NOT NULL DEFAULT 'telugu',
  regional_phrase text NOT NULL,
  clinical_term text NOT NULL,
  category text NOT NULL DEFAULT 'symptom',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.regional_lexicon ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read lexicon" ON public.regional_lexicon
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage lexicon" ON public.regional_lexicon
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Phase 5: Pilot requests table
CREATE TABLE public.pilot_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_name text NOT NULL,
  location text NOT NULL,
  speciality text NOT NULL,
  estimated_patient_volume text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pilot_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit pilot request" ON public.pilot_requests
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can manage pilot requests" ON public.pilot_requests
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Phase 5: Audit logs table (immutable)
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  actor_id uuid NOT NULL,
  target_type text DEFAULT '',
  target_id text DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);

-- Phase 5: Usage metrics table (anonymized)
CREATE TABLE public.usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type text NOT NULL,
  metric_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  period_start date NOT NULL DEFAULT CURRENT_DATE,
  period_end date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read usage metrics" ON public.usage_metrics
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert usage metrics" ON public.usage_metrics
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed regional lexicon with Telugu phrases
INSERT INTO public.regional_lexicon (language, regional_phrase, clinical_term, category) VALUES
('telugu', 'gas problem', 'Dyspepsia', 'symptom'),
('telugu', 'acidity', 'Gastroesophageal Reflux Disease', 'symptom'),
('telugu', 'sugar', 'Diabetes Mellitus', 'condition'),
('telugu', 'BP', 'Hypertension', 'condition'),
('telugu', 'giddiness', 'Vertigo', 'symptom'),
('telugu', 'body pains', 'Myalgia', 'symptom'),
('telugu', 'loose motions', 'Diarrhea', 'symptom'),
('telugu', 'burning micturition', 'Dysuria', 'symptom'),
('telugu', 'breathlessness', 'Dyspnea', 'symptom'),
('telugu', 'cold', 'Upper Respiratory Tract Infection', 'symptom'),
('telugu', 'headache', 'Cephalgia', 'symptom'),
('telugu', 'chest pain', 'Angina Pectoris', 'symptom'),
('telugu', 'weakness', 'Asthenia', 'symptom'),
('telugu', 'joint pains', 'Arthralgia', 'symptom'),
('telugu', 'swelling', 'Edema', 'symptom'),
('telugu', 'fever', 'Pyrexia', 'symptom'),
('telugu', 'vomitings', 'Emesis', 'symptom'),
('telugu', 'piles', 'Hemorrhoids', 'condition'),
('telugu', 'kidney stone', 'Nephrolithiasis', 'condition'),
('telugu', 'thyroid', 'Thyroid Disorder', 'condition'),
('telugu', 'crocin', 'Paracetamol', 'medication'),
('telugu', 'combiflam', 'Ibuprofen + Paracetamol', 'medication'),
('telugu', 'dolo', 'Paracetamol 650mg', 'medication'),
('telugu', 'pan-d', 'Pantoprazole + Domperidone', 'medication'),
('telugu', 'rantac', 'Ranitidine', 'medication'),
('telugu', 'metformin', 'Metformin', 'medication'),
('telugu', 'glycomet', 'Metformin', 'medication'),
('telugu', 'telma', 'Telmisartan', 'medication'),
('telugu', 'ecosprin', 'Aspirin', 'medication'),
('telugu', 'shelcal', 'Calcium + Vitamin D3', 'medication');
