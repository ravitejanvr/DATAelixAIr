/**
 * Benchmark v9 — Single Controlled Scenario
 *
 * One perfect textbook case: Community Acquired Pneumonia
 * Validates the full pipeline: Normalization → Physiology → DDX → Bayesian → Cognitive → Safety → SOAP
 */

import type { MergedContextObject } from "@/services/context_service";

export interface BenchmarkCase {
  id: string;
  name: string;
  description: string;
  context: MergedContextObject;
  ground_truth: {
    gold_standard_diagnosis: string;
    alternative_diagnoses: string[];
    expected_symptoms_normalized: string[];
    expected_physiology_states: string[];
    expected_organ_systems: string[];
    recommended_tests: string[];
    danger_flag: boolean;
    expected_dangerous_diagnoses?: string[];
  };
}

export const CONTROLLED_SCENARIO: BenchmarkCase = {
  id: "ctrl-pneumonia-001",
  name: "Community Acquired Pneumonia",
  description:
    "Classic textbook presentation: fever, productive cough, dyspnea, chest pain, fatigue. " +
    "This scenario validates every pipeline stage with unambiguous symptom-to-diagnosis mapping.",
  context: {
    visit_id: "bench-ctrl-pneumonia-001",
    patient_id: "bench-patient-001",
    clinic_id: "bench-clinic-001",
    chief_complaint: "Fever and productive cough for 3 days",
    symptoms: ["fever", "productive cough", "shortness of breath", "chest pain", "fatigue"],
    symptom_duration: "3 days",
    associated_symptoms: ["chills", "loss of appetite"],
    medical_history: [],
    family_history: [],
    risk_factors: [],
    medications: [],
    allergies: [],
    vitals: {
      bp_systolic: 130, bp_diastolic: 85, pulse: 108, temperature: 38.9,
      spo2: 93, respiratory_rate: 24, weight_kg: 80, height_cm: 178,
    },
    lab_results: [],
    risk_flags: [],
    missing_information: [],
    context_confidence: 0.9,
    source_priority: ["doctor"],
  },
  ground_truth: {
    gold_standard_diagnosis: "Pneumonia",
    alternative_diagnoses: ["Bronchitis", "COPD Exacerbation", "Pulmonary Embolism"],
    expected_symptoms_normalized: ["fever", "productive cough", "dyspnea", "chest pain", "fatigue", "chills", "loss of appetite"],
    expected_physiology_states: ["pulmonary inflammation", "alveolar", "impaired gas exchange", "respiratory"],
    expected_organ_systems: ["respiratory"],
    recommended_tests: ["Chest X-ray", "CBC", "CRP", "Sputum Culture", "Blood Culture"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Pulmonary Embolism", "Myocardial Infarction"],
  },
};
