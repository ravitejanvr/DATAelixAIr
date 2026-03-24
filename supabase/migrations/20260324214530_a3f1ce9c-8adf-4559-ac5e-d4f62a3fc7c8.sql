-- Phase 5: Add missing symptom edges for common conditions in incomplete presentations
-- This fixes the Incomplete category (0% Top-1) by ensuring common diagnoses appear in candidates

-- acute bronchitis needs dry cough edge
INSERT INTO symptom_likelihoods (symptom_id, diagnosis_id, likelihood_value)
SELECT 'fae061a8-ad1b-44c4-b3e3-9fa1748f3923', 'b0000001-0000-0000-0000-000000000009', 0.85
WHERE NOT EXISTS (SELECT 1 FROM symptom_likelihoods WHERE symptom_id = 'fae061a8-ad1b-44c4-b3e3-9fa1748f3923' AND diagnosis_id = 'b0000001-0000-0000-0000-000000000009');

-- viral URI needs fever edge (check if exists)
INSERT INTO symptom_likelihoods (symptom_id, diagnosis_id, likelihood_value)
SELECT s.id, d.id, 0.70
FROM symptoms s, diagnoses d
WHERE s.symptom_name = 'fever' AND d.diagnosis_name = 'viral upper respiratory infection'
AND NOT EXISTS (SELECT 1 FROM symptom_likelihoods sl WHERE sl.symptom_id = s.id AND sl.diagnosis_id = d.id);

-- viral URI needs dry cough edge
INSERT INTO symptom_likelihoods (symptom_id, diagnosis_id, likelihood_value)
SELECT 'fae061a8-ad1b-44c4-b3e3-9fa1748f3923', d.id, 0.75
FROM diagnoses d WHERE d.diagnosis_name = 'viral upper respiratory infection'
AND NOT EXISTS (SELECT 1 FROM symptom_likelihoods sl WHERE sl.symptom_id = 'fae061a8-ad1b-44c4-b3e3-9fa1748f3923' AND sl.diagnosis_id = d.id);

-- tension headache needs separate headache edge check (might already exist)
-- costochondritis needs chest pain edge  
INSERT INTO symptom_likelihoods (symptom_id, diagnosis_id, likelihood_value)
SELECT s.id, 'c16c971f-19ab-4c4b-9649-d4475cb68fa1', 0.95
FROM symptoms s WHERE s.symptom_name = 'chest pain'
AND NOT EXISTS (SELECT 1 FROM symptom_likelihoods sl WHERE sl.symptom_id = s.id AND sl.diagnosis_id = 'c16c971f-19ab-4c4b-9649-d4475cb68fa1');

-- IBS needs bloating edge
INSERT INTO symptom_likelihoods (symptom_id, diagnosis_id, likelihood_value)
SELECT s.id, d.id, 0.85
FROM symptoms s, diagnoses d WHERE s.symptom_name = 'bloating' AND d.diagnosis_name = 'irritable bowel syndrome'
AND NOT EXISTS (SELECT 1 FROM symptom_likelihoods sl WHERE sl.symptom_id = s.id AND sl.diagnosis_id = d.id);

-- hypothyroidism needs fatigue edge boost (check)
INSERT INTO symptom_likelihoods (symptom_id, diagnosis_id, likelihood_value)
SELECT s.id, 'b0000001-0000-0000-0000-000000000048', 0.90
FROM symptoms s WHERE s.symptom_name = 'fatigue'
AND NOT EXISTS (SELECT 1 FROM symptom_likelihoods sl WHERE sl.symptom_id = s.id AND sl.diagnosis_id = 'b0000001-0000-0000-0000-000000000048');

-- iron deficiency anemia needs fatigue edge
INSERT INTO symptom_likelihoods (symptom_id, diagnosis_id, likelihood_value)
SELECT s.id, '2e488fe8-bfd4-44ec-8c0e-aaa6615f5d3f', 0.90
FROM symptoms s WHERE s.symptom_name = 'fatigue'
AND NOT EXISTS (SELECT 1 FROM symptom_likelihoods sl WHERE sl.symptom_id = s.id AND sl.diagnosis_id = '2e488fe8-bfd4-44ec-8c0e-aaa6615f5d3f');

-- cardiac syncope needs syncope edge
INSERT INTO symptom_likelihoods (symptom_id, diagnosis_id, likelihood_value)
SELECT s.id, d.id, 0.95
FROM symptoms s, diagnoses d WHERE s.symptom_name = 'syncope' AND d.diagnosis_name = 'cardiac syncope'
AND NOT EXISTS (SELECT 1 FROM symptom_likelihoods sl WHERE sl.symptom_id = s.id AND sl.diagnosis_id = d.id);

-- sciatica needs back pain and weakness edges
INSERT INTO symptom_likelihoods (symptom_id, diagnosis_id, likelihood_value)
SELECT s.id, d.id, 0.90
FROM symptoms s, diagnoses d WHERE s.symptom_name = 'back pain' AND d.diagnosis_name ILIKE '%sciatica%'
AND NOT EXISTS (SELECT 1 FROM symptom_likelihoods sl WHERE sl.symptom_id = s.id AND sl.diagnosis_id = d.id);

INSERT INTO symptom_likelihoods (symptom_id, diagnosis_id, likelihood_value)
SELECT s.id, d.id, 0.75
FROM symptoms s, diagnoses d WHERE s.symptom_name = 'weakness' AND d.diagnosis_name ILIKE '%sciatica%'
AND NOT EXISTS (SELECT 1 FROM symptom_likelihoods sl WHERE sl.symptom_id = s.id AND sl.diagnosis_id = d.id);

INSERT INTO symptom_likelihoods (symptom_id, diagnosis_id, likelihood_value)
SELECT s.id, d.id, 0.80
FROM symptoms s, diagnoses d WHERE s.symptom_name = 'numbness' AND d.diagnosis_name ILIKE '%sciatica%'
AND NOT EXISTS (SELECT 1 FROM symptom_likelihoods sl WHERE sl.symptom_id = s.id AND sl.diagnosis_id = d.id);

-- COPD exacerbation needs dry cough edge
INSERT INTO symptom_likelihoods (symptom_id, diagnosis_id, likelihood_value)
SELECT 'fae061a8-ad1b-44c4-b3e3-9fa1748f3923', '67b3ed9e-7788-42b5-bafb-556335e61134', 0.75
WHERE NOT EXISTS (SELECT 1 FROM symptom_likelihoods WHERE symptom_id = 'fae061a8-ad1b-44c4-b3e3-9fa1748f3923' AND diagnosis_id = '67b3ed9e-7788-42b5-bafb-556335e61134');

-- cholecystitis needs stronger abdominal pain edge
INSERT INTO symptom_likelihoods (symptom_id, diagnosis_id, likelihood_value)
SELECT s.id, d.id, 0.95
FROM symptoms s, diagnoses d WHERE s.symptom_name = 'abdominal pain' AND d.diagnosis_name ILIKE '%cholecystitis%'
AND NOT EXISTS (SELECT 1 FROM symptom_likelihoods sl WHERE sl.symptom_id = s.id AND sl.diagnosis_id = d.id);

-- stable angina needs chest pain + dyspnea edges
INSERT INTO symptom_likelihoods (symptom_id, diagnosis_id, likelihood_value)
SELECT s.id, d.id, 0.95
FROM symptoms s, diagnoses d WHERE s.symptom_name = 'chest pain' AND d.diagnosis_name ILIKE '%stable angina%'
AND NOT EXISTS (SELECT 1 FROM symptom_likelihoods sl WHERE sl.symptom_id = s.id AND sl.diagnosis_id = d.id);

INSERT INTO symptom_likelihoods (symptom_id, diagnosis_id, likelihood_value)
SELECT s.id, d.id, 0.80
FROM symptoms s, diagnoses d WHERE s.symptom_name = 'dyspnea' AND d.diagnosis_name ILIKE '%stable angina%'
AND NOT EXISTS (SELECT 1 FROM symptom_likelihoods sl WHERE sl.symptom_id = s.id AND sl.diagnosis_id = d.id);