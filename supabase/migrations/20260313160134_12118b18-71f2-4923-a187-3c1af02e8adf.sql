
-- Add unique constraints for proper upsert support
ALTER TABLE public.dangerous_diagnoses ADD CONSTRAINT dangerous_diagnoses_trigger_diagnosis_unique UNIQUE (trigger_symptom, diagnosis_id);
ALTER TABLE public.disease_tests ADD CONSTRAINT disease_tests_disease_test_unique UNIQUE (disease_name, test_name);
ALTER TABLE public.disease_treatments ADD CONSTRAINT disease_treatments_disease_drug_unique UNIQUE (disease_name, drug_name);
