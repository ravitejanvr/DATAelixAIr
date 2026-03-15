
-- Disease System Tags: maps each diagnosis to one or more anatomical systems
-- Used by the localisation-aware candidate generator
CREATE TABLE public.disease_system_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
  system_tag TEXT NOT NULL,
  confidence NUMERIC DEFAULT 0.8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(diagnosis_id, system_tag)
);

-- Index for fast lookup by system_tag during candidate generation
CREATE INDEX idx_disease_system_tags_system ON public.disease_system_tags(system_tag);
CREATE INDEX idx_disease_system_tags_diagnosis ON public.disease_system_tags(diagnosis_id);

-- RLS: public read (knowledge graph data)
ALTER TABLE public.disease_system_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read disease_system_tags" ON public.disease_system_tags FOR SELECT USING (true);

-- Auto-populate from existing diagnosis categories
INSERT INTO public.disease_system_tags (diagnosis_id, system_tag, confidence)
SELECT id, 
  CASE category
    WHEN 'respiratory' THEN 'respiratory'
    WHEN 'cardiovascular' THEN 'cardiovascular'
    WHEN 'neurological' THEN 'neurological'
    WHEN 'gastrointestinal' THEN 'gastrointestinal'
    WHEN 'endocrine' THEN 'endocrine'
    WHEN 'dermatological' THEN 'dermatologic'
    WHEN 'musculoskeletal' THEN 'musculoskeletal'
    WHEN 'infectious' THEN 'infectious'
    WHEN 'hematological' THEN 'hematologic'
    WHEN 'autoimmune' THEN 'immune'
    WHEN 'immunological' THEN 'immune'
    WHEN 'psychiatric' THEN 'neurological'
    WHEN 'oncological' THEN 'oncological'
    WHEN 'ophthalmological' THEN 'ophthalmologic'
    ELSE 'general'
  END,
  0.8
FROM public.diagnoses
WHERE is_active = true
ON CONFLICT (diagnosis_id, system_tag) DO NOTHING;

-- Add cross-system tags for diseases that span multiple systems
-- Respiratory diseases with infectious component
INSERT INTO public.disease_system_tags (diagnosis_id, system_tag, confidence)
SELECT id, 'infectious', 0.6
FROM public.diagnoses
WHERE is_active = true AND category = 'respiratory'
  AND (diagnosis_name ILIKE '%pneumonia%' OR diagnosis_name ILIKE '%bronchitis%' OR diagnosis_name ILIKE '%tuberculosis%')
ON CONFLICT (diagnosis_id, system_tag) DO NOTHING;

-- Neurological diseases with musculoskeletal overlap
INSERT INTO public.disease_system_tags (diagnosis_id, system_tag, confidence)
SELECT id, 'musculoskeletal', 0.5
FROM public.diagnoses
WHERE is_active = true AND category = 'neurological'
  AND (diagnosis_name ILIKE '%guillain%' OR diagnosis_name ILIKE '%neuropathy%')
ON CONFLICT (diagnosis_id, system_tag) DO NOTHING;

-- Endocrine with cardiovascular overlap
INSERT INTO public.disease_system_tags (diagnosis_id, system_tag, confidence)
SELECT id, 'cardiovascular', 0.5
FROM public.diagnoses
WHERE is_active = true AND category = 'endocrine'
  AND (diagnosis_name ILIKE '%thyroid storm%' OR diagnosis_name ILIKE '%pheochromocytoma%')
ON CONFLICT (diagnosis_id, system_tag) DO NOTHING;

-- COPD as respiratory (ensure it's tagged)
INSERT INTO public.disease_system_tags (diagnosis_id, system_tag, confidence)
SELECT id, 'respiratory', 0.95
FROM public.diagnoses
WHERE is_active = true AND diagnosis_name ILIKE '%copd%'
ON CONFLICT (diagnosis_id, system_tag) DO NOTHING;

-- Tension headache as neurological
INSERT INTO public.disease_system_tags (diagnosis_id, system_tag, confidence)
SELECT id, 'neurological', 0.95
FROM public.diagnoses
WHERE is_active = true AND (diagnosis_name ILIKE '%tension headache%' OR diagnosis_name ILIKE '%migraine%')
ON CONFLICT (diagnosis_id, system_tag) DO NOTHING;

-- Renal/urological
INSERT INTO public.disease_system_tags (diagnosis_id, system_tag, confidence)
SELECT id, 'renal', 0.9
FROM public.diagnoses
WHERE is_active = true
  AND (diagnosis_name ILIKE '%pyelonephritis%' OR diagnosis_name ILIKE '%urinary%' OR diagnosis_name ILIKE '%kidney%' OR diagnosis_name ILIKE '%nephr%' OR diagnosis_name ILIKE '%renal%')
ON CONFLICT (diagnosis_id, system_tag) DO NOTHING;

-- Cellulitis as dermatologic + infectious
INSERT INTO public.disease_system_tags (diagnosis_id, system_tag, confidence)
SELECT id, 'dermatologic', 0.9
FROM public.diagnoses
WHERE is_active = true AND diagnosis_name ILIKE '%cellulitis%'
ON CONFLICT (diagnosis_id, system_tag) DO NOTHING;

INSERT INTO public.disease_system_tags (diagnosis_id, system_tag, confidence)
SELECT id, 'infectious', 0.7
FROM public.diagnoses
WHERE is_active = true AND diagnosis_name ILIKE '%cellulitis%'
ON CONFLICT (diagnosis_id, system_tag) DO NOTHING;
