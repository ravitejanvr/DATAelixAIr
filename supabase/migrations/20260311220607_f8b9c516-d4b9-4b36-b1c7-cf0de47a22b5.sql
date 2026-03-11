
-- Anatomical Systems
CREATE TABLE public.anatomical_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.anatomical_systems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read anatomical_systems" ON public.anatomical_systems FOR SELECT TO authenticated USING (true);

-- Physiological States
CREATE TABLE public.physiological_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  system_id uuid NOT NULL REFERENCES public.anatomical_systems(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.physiological_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read physiological_states" ON public.physiological_states FOR SELECT TO authenticated USING (true);

-- Symptom → Physiological State Map
CREATE TABLE public.symptom_physiology_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_id uuid NOT NULL REFERENCES public.symptoms(id) ON DELETE CASCADE,
  physiological_state_id uuid NOT NULL REFERENCES public.physiological_states(id) ON DELETE CASCADE,
  confidence_score numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(symptom_id, physiological_state_id)
);
ALTER TABLE public.symptom_physiology_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read symptom_physiology_map" ON public.symptom_physiology_map FOR SELECT TO authenticated USING (true);

-- Physiological State → Diagnosis Map
CREATE TABLE public.physiology_diagnosis_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  physiological_state_id uuid NOT NULL REFERENCES public.physiological_states(id) ON DELETE CASCADE,
  diagnosis_id uuid NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  relevance_score numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(physiological_state_id, diagnosis_id)
);
ALTER TABLE public.physiology_diagnosis_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read physiology_diagnosis_map" ON public.physiology_diagnosis_map FOR SELECT TO authenticated USING (true);

-- Indexes for performance
CREATE INDEX idx_symptom_physiology_symptom ON public.symptom_physiology_map(symptom_id);
CREATE INDEX idx_symptom_physiology_state ON public.symptom_physiology_map(physiological_state_id);
CREATE INDEX idx_physiology_diagnosis_state ON public.physiology_diagnosis_map(physiological_state_id);
CREATE INDEX idx_physiology_diagnosis_diag ON public.physiology_diagnosis_map(diagnosis_id);
CREATE INDEX idx_physiological_states_system ON public.physiological_states(system_id);

-- Seed anatomical systems
INSERT INTO public.anatomical_systems (system_name, description) VALUES
  ('cardiovascular', 'Heart and blood vessel system'),
  ('respiratory', 'Lungs and airways'),
  ('neurological', 'Brain, spinal cord, and nerves'),
  ('gastrointestinal', 'Digestive tract and accessory organs'),
  ('renal', 'Kidneys and urinary tract'),
  ('endocrine', 'Hormone-producing glands'),
  ('immune', 'Immune defense system'),
  ('hematologic', 'Blood and blood-forming organs'),
  ('musculoskeletal', 'Bones, muscles, joints, and connective tissue'),
  ('dermatologic', 'Skin, hair, and nails'),
  ('reproductive', 'Reproductive organs and hormones');

-- Seed physiological states
INSERT INTO public.physiological_states (state_name, description, system_id) VALUES
  ('immune_activation', 'Systemic immune response with inflammatory mediators', (SELECT id FROM public.anatomical_systems WHERE system_name = 'immune')),
  ('respiratory_inflammation', 'Inflammation of airways or lung parenchyma', (SELECT id FROM public.anatomical_systems WHERE system_name = 'respiratory')),
  ('cardiac_ischemia', 'Reduced blood flow to myocardium', (SELECT id FROM public.anatomical_systems WHERE system_name = 'cardiovascular')),
  ('neurological_irritation', 'Irritation or inflammation of neural structures', (SELECT id FROM public.anatomical_systems WHERE system_name = 'neurological')),
  ('neurological_inflammation', 'Inflammatory process affecting CNS or meninges', (SELECT id FROM public.anatomical_systems WHERE system_name = 'neurological')),
  ('metabolic_dysregulation', 'Disruption of metabolic homeostasis', (SELECT id FROM public.anatomical_systems WHERE system_name = 'endocrine')),
  ('coagulation_disorder', 'Abnormality in blood clotting cascade', (SELECT id FROM public.anatomical_systems WHERE system_name = 'hematologic')),
  ('electrolyte_imbalance', 'Disruption of electrolyte homeostasis', (SELECT id FROM public.anatomical_systems WHERE system_name = 'renal')),
  ('renal_filtration_impairment', 'Reduced glomerular filtration or tubular function', (SELECT id FROM public.anatomical_systems WHERE system_name = 'renal')),
  ('gastrointestinal_irritation', 'Mucosal irritation or motility disruption in GI tract', (SELECT id FROM public.anatomical_systems WHERE system_name = 'gastrointestinal')),
  ('vascular_inflammation', 'Inflammation of blood vessel walls', (SELECT id FROM public.anatomical_systems WHERE system_name = 'cardiovascular')),
  ('bronchospasm', 'Constriction of bronchial smooth muscle', (SELECT id FROM public.anatomical_systems WHERE system_name = 'respiratory')),
  ('autonomic_dysregulation', 'Imbalance in sympathetic/parasympathetic activity', (SELECT id FROM public.anatomical_systems WHERE system_name = 'neurological')),
  ('hepatic_dysfunction', 'Impaired liver metabolic or synthetic function', (SELECT id FROM public.anatomical_systems WHERE system_name = 'gastrointestinal')),
  ('musculoskeletal_inflammation', 'Inflammation of joints, muscles, or connective tissue', (SELECT id FROM public.anatomical_systems WHERE system_name = 'musculoskeletal'));
