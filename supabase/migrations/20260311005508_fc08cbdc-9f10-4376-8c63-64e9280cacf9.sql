
-- SEED: Diagnosis-Drug Map and Dangerous Diagnoses

INSERT INTO public.diagnosis_drug_map (diagnosis_id, generic_name, line_of_treatment) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'acetaminophen', 'first_line'),
  ('b0000001-0000-0000-0000-000000000002', 'acetaminophen', 'first_line'),
  ('b0000001-0000-0000-0000-000000000003', 'chloroquine', 'first_line'),
  ('b0000001-0000-0000-0000-000000000004', 'amoxicillin', 'first_line'),
  ('b0000001-0000-0000-0000-000000000005', 'ondansetron', 'first_line'),
  ('b0000001-0000-0000-0000-000000000005', 'loperamide', 'second_line'),
  ('b0000001-0000-0000-0000-000000000008', 'amoxicillin', 'first_line'),
  ('b0000001-0000-0000-0000-000000000008', 'azithromycin', 'second_line'),
  ('b0000001-0000-0000-0000-000000000008', 'acetaminophen', 'supportive'),
  ('b0000001-0000-0000-0000-000000000009', 'acetaminophen', 'supportive'),
  ('b0000001-0000-0000-0000-000000000010', 'acetaminophen', 'first_line'),
  ('b0000001-0000-0000-0000-000000000010', 'oseltamivir', 'first_line'),
  ('b0000001-0000-0000-0000-000000000011', 'aspirin', 'first_line'),
  ('b0000001-0000-0000-0000-000000000011', 'nitroglycerin', 'first_line'),
  ('b0000001-0000-0000-0000-000000000011', 'atorvastatin', 'first_line'),
  ('b0000001-0000-0000-0000-000000000014', 'acetaminophen', 'supportive'),
  ('b0000001-0000-0000-0000-000000000015', 'azithromycin', 'first_line'),
  ('b0000001-0000-0000-0000-000000000015', 'amoxicillin', 'first_line'),
  ('b0000001-0000-0000-0000-000000000016', 'ceftriaxone', 'first_line');

INSERT INTO public.dangerous_diagnoses (diagnosis_id, trigger_symptom, priority, notes) VALUES
  ('b0000001-0000-0000-0000-000000000011', 'chest pain', 1, 'Acute MI must-not-miss for chest pain presentation'),
  ('b0000001-0000-0000-0000-000000000012', 'breathlessness', 2, 'PE must-not-miss for acute dyspnea'),
  ('b0000001-0000-0000-0000-000000000016', 'neck stiffness', 1, 'Meningitis must-not-miss for neck stiffness'),
  ('b0000001-0000-0000-0000-000000000016', 'severe headache', 2, 'Meningitis must-not-miss for severe headache with fever'),
  ('b0000001-0000-0000-0000-000000000013', 'chest pain', 3, 'Aortic dissection must-not-miss for severe chest pain'),
  ('b0000001-0000-0000-0000-000000000020', 'fever', 4, 'Sepsis must-not-miss for high fever with tachycardia');
