-- Phase 1: Canonical diagnosis synonyms for benchmark matching improvement
-- Fixed: correct ectopic pregnancy ID

-- Hypertension → essential hypertension
INSERT INTO diagnosis_synonyms (canonical_diagnosis_id, synonym_term) VALUES
  ('539a2d13-ec01-4206-9b1d-c6951bd095fb', 'hypertension'),
  ('539a2d13-ec01-4206-9b1d-c6951bd095fb', 'high blood pressure')
ON CONFLICT DO NOTHING;

-- Tension Headache → tension-type headache  
INSERT INTO diagnosis_synonyms (canonical_diagnosis_id, synonym_term) VALUES
  ('cd34114e-086c-4e86-adf4-baf5b787dd66', 'tension-type headache')
ON CONFLICT DO NOTHING;

-- Meningitis → bacterial meningitis
INSERT INTO diagnosis_synonyms (canonical_diagnosis_id, synonym_term) VALUES
  ('b0000001-0000-0000-0000-000000000059', 'meningitis')
ON CONFLICT DO NOTHING;

-- Hepatitis → acute hepatitis
INSERT INTO diagnosis_synonyms (canonical_diagnosis_id, synonym_term) VALUES
  ('2e431e8c-5735-442f-a4a1-f0b8954269d2', 'hepatitis')
ON CONFLICT DO NOTHING;

-- Acute Glaucoma → acute angle-closure glaucoma
INSERT INTO diagnosis_synonyms (canonical_diagnosis_id, synonym_term) VALUES
  ('f76f903f-b9b2-455e-8f94-1a56ba564fe5', 'acute glaucoma'),
  ('f76f903f-b9b2-455e-8f94-1a56ba564fe5', 'glaucoma acute')
ON CONFLICT DO NOTHING;

-- Guillain Barre (no hyphen) → Guillain-Barre syndrome
INSERT INTO diagnosis_synonyms (canonical_diagnosis_id, synonym_term) VALUES
  ('821bde74-ce8c-4e0c-9149-a45b88e5fdaa', 'Guillain Barre syndrome'),
  ('821bde74-ce8c-4e0c-9149-a45b88e5fdaa', 'GBS')
ON CONFLICT DO NOTHING;

-- Acute Upper GI Bleed → gastrointestinal bleeding upper
INSERT INTO diagnosis_synonyms (canonical_diagnosis_id, synonym_term) VALUES
  ('fa4f9a60-9bed-4335-ac98-4eaec37dc16c', 'acute upper GI bleed'),
  ('fa4f9a60-9bed-4335-ac98-4eaec37dc16c', 'upper GI bleed'),
  ('fa4f9a60-9bed-4335-ac98-4eaec37dc16c', 'upper gastrointestinal bleeding')
ON CONFLICT DO NOTHING;

-- Acute Adrenal Crisis → Addison disease
INSERT INTO diagnosis_synonyms (canonical_diagnosis_id, synonym_term) VALUES
  ('93054fdf-0b55-41ad-91c1-f1b0c4aa23a6', 'acute adrenal crisis'),
  ('93054fdf-0b55-41ad-91c1-f1b0c4aa23a6', 'adrenal crisis'),
  ('93054fdf-0b55-41ad-91c1-f1b0c4aa23a6', 'adrenal insufficiency')
ON CONFLICT DO NOTHING;

-- Acute Myocardial Infarction → myocardial infarction
INSERT INTO diagnosis_synonyms (canonical_diagnosis_id, synonym_term) VALUES
  ('b0000001-0000-0000-0000-000000000011', 'acute myocardial infarction'),
  ('b0000001-0000-0000-0000-000000000011', 'AMI'),
  ('b0000001-0000-0000-0000-000000000011', 'heart attack')
ON CONFLICT DO NOTHING;

-- Acute Coronary Syndrome abbreviation
INSERT INTO diagnosis_synonyms (canonical_diagnosis_id, synonym_term) VALUES
  ('b0000001-0000-0000-0000-000000000043', 'ACS')
ON CONFLICT DO NOTHING;

-- Pneumonia → community acquired pneumonia
INSERT INTO diagnosis_synonyms (canonical_diagnosis_id, synonym_term) VALUES
  ('b0000001-0000-0000-0000-000000000008', 'pneumonia')
ON CONFLICT DO NOTHING;

-- Depression → major depressive disorder
INSERT INTO diagnosis_synonyms (canonical_diagnosis_id, synonym_term) VALUES
  ('15d2a45e-6854-41e7-8d84-f3c107fb7df5', 'depression'),
  ('15d2a45e-6854-41e7-8d84-f3c107fb7df5', 'MDD'),
  ('15d2a45e-6854-41e7-8d84-f3c107fb7df5', 'clinical depression')
ON CONFLICT DO NOTHING;

-- Ruptured Ectopic Pregnancy → ectopic pregnancy (correct ID)
INSERT INTO diagnosis_synonyms (canonical_diagnosis_id, synonym_term) VALUES
  ('b0000001-0000-0000-0000-000000000031', 'ruptured ectopic pregnancy'),
  ('b0000001-0000-0000-0000-000000000031', 'ruptured ectopic')
ON CONFLICT DO NOTHING;

-- Primary Hyperaldosteronism → hyperaldosteronism
INSERT INTO diagnosis_synonyms (canonical_diagnosis_id, synonym_term) VALUES
  ('da2e9ccd-636c-4bfb-9ace-ad8ee97beac8', 'primary hyperaldosteronism'),
  ('da2e9ccd-636c-4bfb-9ace-ad8ee97beac8', 'Conn syndrome')
ON CONFLICT DO NOTHING;

-- PE and DVT abbreviations
INSERT INTO diagnosis_synonyms (canonical_diagnosis_id, synonym_term) VALUES
  ('b0000001-0000-0000-0000-000000000012', 'PE')
ON CONFLICT DO NOTHING;

INSERT INTO diagnosis_synonyms (canonical_diagnosis_id, synonym_term) VALUES
  ('1e1b0a0b-fef3-487d-a45e-67b8a0ad9857', 'DVT')
ON CONFLICT DO NOTHING;