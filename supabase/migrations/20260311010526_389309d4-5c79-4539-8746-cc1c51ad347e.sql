
-- Add new columns to dangerous_diagnoses
ALTER TABLE public.dangerous_diagnoses
  ADD COLUMN IF NOT EXISTS diagnosis_name text,
  ADD COLUMN IF NOT EXISTS severity_level text NOT NULL DEFAULT 'critical',
  ADD COLUMN IF NOT EXISTS must_not_miss boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS emergency_protocol text,
  ADD COLUMN IF NOT EXISTS guideline_source text;

-- Insert missing diagnoses
INSERT INTO public.diagnoses (id, diagnosis_name, category, icd10_code) VALUES
  ('b0000001-0000-0000-0000-000000000030', 'stroke', 'neurological', 'I63'),
  ('b0000001-0000-0000-0000-000000000031', 'ectopic pregnancy', 'obstetric', 'O00'),
  ('b0000001-0000-0000-0000-000000000032', 'tension pneumothorax', 'respiratory', 'J93.0'),
  ('b0000001-0000-0000-0000-000000000033', 'subarachnoid hemorrhage', 'neurological', 'I60')
ON CONFLICT (id) DO NOTHING;

-- Update existing dangerous_diagnoses with new column data
UPDATE public.dangerous_diagnoses SET diagnosis_name = 'myocardial infarction', severity_level = 'critical', emergency_protocol = 'Activate STEMI protocol. 12-lead ECG within 10 min. Aspirin 325mg stat. Cardiology consult.', guideline_source = 'AHA/ACC STEMI Guidelines' WHERE diagnosis_id = 'b0000001-0000-0000-0000-000000000011';

UPDATE public.dangerous_diagnoses SET diagnosis_name = 'pulmonary embolism', severity_level = 'critical', emergency_protocol = 'CT pulmonary angiography. Anticoagulation if high clinical suspicion. Wells score assessment.', guideline_source = 'ESC PE Guidelines' WHERE diagnosis_id = 'b0000001-0000-0000-0000-000000000012';

UPDATE public.dangerous_diagnoses SET diagnosis_name = 'aortic dissection', severity_level = 'critical', emergency_protocol = 'CT aortography. IV beta-blocker for heart rate control. Surgical consult.', guideline_source = 'AHA Aortic Disease Guidelines' WHERE diagnosis_id = 'b0000001-0000-0000-0000-000000000013';

UPDATE public.dangerous_diagnoses SET diagnosis_name = 'meningitis', severity_level = 'critical', emergency_protocol = 'LP if no contraindication. Empiric antibiotics within 1 hour. Blood cultures.', guideline_source = 'IDSA Meningitis Guidelines' WHERE diagnosis_id = 'b0000001-0000-0000-0000-000000000016';

UPDATE public.dangerous_diagnoses SET diagnosis_name = 'sepsis', severity_level = 'critical', emergency_protocol = 'Surviving Sepsis Bundle: Blood cultures, lactate, broad-spectrum antibiotics within 1 hour, 30mL/kg crystalloid.', guideline_source = 'Surviving Sepsis Campaign' WHERE diagnosis_id = 'b0000001-0000-0000-0000-000000000020';

-- Insert new dangerous diagnoses
INSERT INTO public.dangerous_diagnoses (diagnosis_id, trigger_symptom, priority, notes, diagnosis_name, severity_level, must_not_miss, emergency_protocol, guideline_source) VALUES
  ('b0000001-0000-0000-0000-000000000030', 'weakness', 1, 'Stroke must-not-miss for sudden weakness', 'stroke', 'critical', true, 'CT head stat. Thrombolysis window assessment. NIH Stroke Scale. Neurology consult.', 'AHA/ASA Stroke Guidelines'),
  ('b0000001-0000-0000-0000-000000000030', 'speech difficulty', 1, 'Stroke must-not-miss for speech changes', 'stroke', 'critical', true, 'CT head stat. Thrombolysis window assessment. NIH Stroke Scale. Neurology consult.', 'AHA/ASA Stroke Guidelines'),
  ('b0000001-0000-0000-0000-000000000031', 'abdominal pain', 2, 'Ectopic pregnancy must-not-miss in reproductive-age females', 'ectopic pregnancy', 'critical', true, 'Serum beta-hCG. Transvaginal ultrasound. Type and cross-match. OB/GYN consult.', 'ACOG Ectopic Pregnancy Guidelines'),
  ('b0000001-0000-0000-0000-000000000031', 'vaginal bleeding', 1, 'Ectopic pregnancy must-not-miss for vaginal bleeding', 'ectopic pregnancy', 'critical', true, 'Serum beta-hCG. Transvaginal ultrasound. Type and cross-match. OB/GYN consult.', 'ACOG Ectopic Pregnancy Guidelines'),
  ('b0000001-0000-0000-0000-000000000032', 'chest pain', 2, 'Tension pneumothorax must-not-miss for chest pain with dyspnea', 'tension pneumothorax', 'critical', true, 'Needle decompression if hemodynamically unstable. Chest X-ray. Chest tube insertion.', 'ATLS Guidelines'),
  ('b0000001-0000-0000-0000-000000000032', 'breathlessness', 2, 'Tension pneumothorax must-not-miss for acute dyspnea', 'tension pneumothorax', 'critical', true, 'Needle decompression if hemodynamically unstable. Chest X-ray. Chest tube insertion.', 'ATLS Guidelines'),
  ('b0000001-0000-0000-0000-000000000033', 'severe headache', 1, 'SAH must-not-miss for thunderclap headache', 'subarachnoid hemorrhage', 'critical', true, 'CT head without contrast. LP if CT negative. Neurosurgery consult.', 'AHA SAH Guidelines'),
  ('b0000001-0000-0000-0000-000000000033', 'neck stiffness', 2, 'SAH must-not-miss for meningismus', 'subarachnoid hemorrhage', 'critical', true, 'CT head without contrast. LP if CT negative. Neurosurgery consult.', 'AHA SAH Guidelines');
