/**
 * Benchmark v9 — 10 Controlled Clinical Scenarios
 *
 * Covers multiple organ systems commonly encountered by general physicians.
 * Each scenario uses canonical symptom inputs to eliminate NLP noise.
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

function makeContext(overrides: Partial<MergedContextObject>): MergedContextObject {
  return {
    visit_id: "",
    patient_id: "bench-patient-001",
    clinic_id: "bench-clinic-001",
    chief_complaint: "",
    symptoms: [],
    symptom_duration: "",
    associated_symptoms: [],
    medical_history: [],
    family_history: [],
    risk_factors: [],
    medications: [],
    allergies: [],
    vitals: { bp_systolic: 120, bp_diastolic: 80, pulse: 80, temperature: 37, spo2: 98, respiratory_rate: 16, weight_kg: 70, height_cm: 170 },
    lab_results: [],
    risk_flags: [],
    missing_information: [],
    context_confidence: 0.9,
    source_priority: ["doctor"],
    ...overrides,
  };
}

// ── 1. Community Acquired Pneumonia ──
const PNEUMONIA: BenchmarkCase = {
  id: "ctrl-pneumonia-001",
  name: "Community Acquired Pneumonia",
  description: "Classic textbook presentation: fever, productive cough, dyspnea, chest pain, fatigue.",
  context: makeContext({
    visit_id: "bench-ctrl-pneumonia-001",
    chief_complaint: "Fever and productive cough for 3 days",
    symptoms: ["fever", "productive cough", "shortness of breath", "chest pain", "fatigue"],
    symptom_duration: "3 days",
    associated_symptoms: ["chills", "loss of appetite"],
    vitals: { bp_systolic: 130, bp_diastolic: 85, pulse: 108, temperature: 38.9, spo2: 93, respiratory_rate: 24, weight_kg: 80, height_cm: 178 },
  }),
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

// ── 2. Acute Gastroenteritis ──
const GASTROENTERITIS: BenchmarkCase = {
  id: "ctrl-gastroenteritis-002",
  name: "Acute Gastroenteritis",
  description: "Classic GI presentation: vomiting, diarrhea, abdominal pain, fever, nausea.",
  context: makeContext({
    visit_id: "bench-ctrl-gastro-002",
    chief_complaint: "Vomiting and diarrhea for 2 days",
    symptoms: ["vomiting", "diarrhea", "abdominal pain", "fever", "nausea"],
    symptom_duration: "2 days",
    associated_symptoms: ["loss of appetite", "malaise"],
    vitals: { bp_systolic: 110, bp_diastolic: 70, pulse: 100, temperature: 38.3, spo2: 98, respiratory_rate: 18, weight_kg: 65, height_cm: 168 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Gastroenteritis",
    alternative_diagnoses: ["Appendicitis", "Food Poisoning", "Inflammatory Bowel Disease"],
    expected_symptoms_normalized: ["vomiting", "diarrhea", "abdominal pain", "fever", "nausea"],
    expected_physiology_states: ["gastrointestinal inflammation", "dehydration"],
    expected_organ_systems: ["gastrointestinal"],
    recommended_tests: ["CBC", "Stool Culture", "Electrolytes", "CRP"],
    danger_flag: false,
  },
};

// ── 3. Acute Appendicitis ──
const APPENDICITIS: BenchmarkCase = {
  id: "ctrl-appendicitis-003",
  name: "Acute Appendicitis",
  description: "Classic surgical abdomen: RLQ pain, fever, nausea, vomiting, anorexia.",
  context: makeContext({
    visit_id: "bench-ctrl-appendicitis-003",
    chief_complaint: "Severe right lower abdominal pain since yesterday",
    symptoms: ["right lower quadrant abdominal pain", "fever", "nausea", "vomiting", "loss of appetite"],
    symptom_duration: "1 day",
    associated_symptoms: ["rebound tenderness"],
    vitals: { bp_systolic: 125, bp_diastolic: 80, pulse: 102, temperature: 38.5, spo2: 98, respiratory_rate: 20, weight_kg: 75, height_cm: 175 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Appendicitis",
    alternative_diagnoses: ["Mesenteric Lymphadenitis", "Ovarian Torsion", "Crohn's Disease"],
    expected_symptoms_normalized: ["right lower quadrant abdominal pain", "fever", "nausea", "vomiting", "loss of appetite"],
    expected_physiology_states: ["peritoneal inflammation", "gastrointestinal"],
    expected_organ_systems: ["gastrointestinal"],
    recommended_tests: ["CBC", "CRP", "Abdominal Ultrasound", "CT Abdomen"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Appendicitis"],
  },
};

// ── 4. Urinary Tract Infection ──
const UTI: BenchmarkCase = {
  id: "ctrl-uti-004",
  name: "Urinary Tract Infection",
  description: "Classic lower UTI: dysuria, frequency, suprapubic pain, fever, cloudy urine.",
  context: makeContext({
    visit_id: "bench-ctrl-uti-004",
    chief_complaint: "Burning urination and frequent urination for 2 days",
    symptoms: ["dysuria", "frequent urination", "suprapubic pain", "fever", "cloudy urine"],
    symptom_duration: "2 days",
    associated_symptoms: ["urgency"],
    vitals: { bp_systolic: 120, bp_diastolic: 78, pulse: 88, temperature: 38.1, spo2: 98, respiratory_rate: 16, weight_kg: 60, height_cm: 162 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Urinary Tract Infection",
    alternative_diagnoses: ["Pyelonephritis", "Cystitis", "Sexually Transmitted Infection"],
    expected_symptoms_normalized: ["dysuria", "frequent urination", "suprapubic pain", "fever", "cloudy urine"],
    expected_physiology_states: ["urinary inflammation"],
    expected_organ_systems: ["renal"],
    recommended_tests: ["Urinalysis", "Urine Culture", "CBC"],
    danger_flag: false,
  },
};

// ── 5. Migraine ──
const MIGRAINE: BenchmarkCase = {
  id: "ctrl-migraine-005",
  name: "Migraine",
  description: "Classic migraine with aura: unilateral headache, photophobia, nausea, visual aura.",
  context: makeContext({
    visit_id: "bench-ctrl-migraine-005",
    chief_complaint: "Severe one-sided headache with visual disturbances",
    symptoms: ["unilateral headache", "photophobia", "nausea", "vomiting", "visual aura"],
    symptom_duration: "6 hours",
    associated_symptoms: ["phonophobia"],
    vitals: { bp_systolic: 130, bp_diastolic: 85, pulse: 78, temperature: 36.8, spo2: 99, respiratory_rate: 16, weight_kg: 68, height_cm: 170 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Migraine",
    alternative_diagnoses: ["Tension Headache", "Cluster Headache", "Subarachnoid Hemorrhage"],
    expected_symptoms_normalized: ["unilateral headache", "photophobia", "nausea", "vomiting", "visual aura"],
    expected_physiology_states: ["neurological"],
    expected_organ_systems: ["neurological"],
    recommended_tests: ["Neurological Exam", "CT Head"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Subarachnoid Hemorrhage"],
  },
};

// ── 6. Asthma Exacerbation ──
const ASTHMA: BenchmarkCase = {
  id: "ctrl-asthma-006",
  name: "Asthma Exacerbation",
  description: "Acute asthma flare: dyspnea, wheezing, chest tightness, cough, nocturnal symptoms.",
  context: makeContext({
    visit_id: "bench-ctrl-asthma-006",
    chief_complaint: "Increasing shortness of breath and wheezing for 2 days",
    symptoms: ["shortness of breath", "wheezing", "chest tightness", "cough", "night symptoms"],
    symptom_duration: "2 days",
    associated_symptoms: ["difficulty speaking in full sentences"],
    medical_history: ["asthma"],
    vitals: { bp_systolic: 125, bp_diastolic: 80, pulse: 110, temperature: 37.0, spo2: 91, respiratory_rate: 28, weight_kg: 72, height_cm: 165 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Asthma",
    alternative_diagnoses: ["COPD Exacerbation", "Pneumonia", "Pneumothorax"],
    expected_symptoms_normalized: ["dyspnea", "wheezing", "chest tightness", "cough"],
    expected_physiology_states: ["bronchospasm", "airway obstruction", "respiratory"],
    expected_organ_systems: ["respiratory"],
    recommended_tests: ["Peak Flow", "Chest X-ray", "ABG", "SpO2"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Pneumothorax"],
  },
};

// ── 7. Acute Coronary Syndrome ──
const ACS: BenchmarkCase = {
  id: "ctrl-acs-007",
  name: "Acute Coronary Syndrome",
  description: "Classic ACS: chest pain, dyspnea, nausea, diaphoresis, left arm pain.",
  context: makeContext({
    visit_id: "bench-ctrl-acs-007",
    chief_complaint: "Crushing chest pain radiating to left arm",
    symptoms: ["chest pain", "shortness of breath", "nausea", "diaphoresis", "left arm pain"],
    symptom_duration: "1 hour",
    associated_symptoms: ["anxiety", "dizziness"],
    risk_factors: ["smoking", "hypertension", "diabetes"],
    vitals: { bp_systolic: 150, bp_diastolic: 95, pulse: 105, temperature: 37.0, spo2: 95, respiratory_rate: 22, weight_kg: 90, height_cm: 175 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Acute Coronary Syndrome",
    alternative_diagnoses: ["Pulmonary Embolism", "Aortic Dissection", "GERD"],
    expected_symptoms_normalized: ["chest pain", "dyspnea", "nausea", "diaphoresis", "left arm pain"],
    expected_physiology_states: ["myocardial ischemia", "cardiac"],
    expected_organ_systems: ["cardiovascular"],
    recommended_tests: ["ECG", "Troponin", "Chest X-ray", "CBC"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Myocardial Infarction", "Aortic Dissection", "Pulmonary Embolism"],
  },
};

// ── 8. Diabetic Ketoacidosis ──
const DKA: BenchmarkCase = {
  id: "ctrl-dka-008",
  name: "Diabetic Ketoacidosis",
  description: "Classic DKA: polyuria, polydipsia, abdominal pain, vomiting, altered mental status.",
  context: makeContext({
    visit_id: "bench-ctrl-dka-008",
    chief_complaint: "Excessive urination, thirst, and abdominal pain",
    symptoms: ["polyuria", "polydipsia", "abdominal pain", "vomiting", "altered mental status"],
    symptom_duration: "2 days",
    associated_symptoms: ["fruity breath", "deep breathing"],
    medical_history: ["type 1 diabetes"],
    vitals: { bp_systolic: 100, bp_diastolic: 60, pulse: 115, temperature: 37.2, spo2: 97, respiratory_rate: 28, weight_kg: 65, height_cm: 172 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Diabetic Ketoacidosis",
    alternative_diagnoses: ["Hyperosmolar Hyperglycemic State", "Sepsis", "Pancreatitis"],
    expected_symptoms_normalized: ["polyuria", "polydipsia", "abdominal pain", "vomiting", "altered mental status"],
    expected_physiology_states: ["metabolic acidosis", "dehydration", "endocrine"],
    expected_organ_systems: ["endocrine"],
    recommended_tests: ["Blood Glucose", "ABG", "Serum Ketones", "Electrolytes", "HbA1c"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Diabetic Ketoacidosis"],
  },
};

// ── 9. Sepsis ──
const SEPSIS: BenchmarkCase = {
  id: "ctrl-sepsis-009",
  name: "Sepsis",
  description: "Classic sepsis: fever, tachycardia, hypotension, confusion, tachypnea.",
  context: makeContext({
    visit_id: "bench-ctrl-sepsis-009",
    chief_complaint: "High fever with confusion and low blood pressure",
    symptoms: ["fever", "tachycardia", "hypotension", "confusion", "rapid breathing"],
    symptom_duration: "12 hours",
    associated_symptoms: ["chills", "oliguria"],
    vitals: { bp_systolic: 85, bp_diastolic: 50, pulse: 125, temperature: 39.5, spo2: 93, respiratory_rate: 30, weight_kg: 78, height_cm: 180 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Sepsis",
    alternative_diagnoses: ["Meningitis", "Pneumonia", "Endocarditis"],
    expected_symptoms_normalized: ["fever", "tachycardia", "hypotension", "confusion", "tachypnea"],
    expected_physiology_states: ["systemic inflammatory response", "hemodynamic instability"],
    expected_organ_systems: ["cardiovascular", "immunological"],
    recommended_tests: ["Blood Culture", "CBC", "Lactate", "Procalcitonin", "CRP"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Sepsis", "Meningitis"],
  },
};

// ── 10. Pulmonary Embolism ──
const PE: BenchmarkCase = {
  id: "ctrl-pe-010",
  name: "Pulmonary Embolism",
  description: "Classic PE: sudden dyspnea, pleuritic chest pain, tachycardia, leg swelling, hypoxia.",
  context: makeContext({
    visit_id: "bench-ctrl-pe-010",
    chief_complaint: "Sudden shortness of breath and chest pain",
    symptoms: ["sudden shortness of breath", "chest pain", "tachycardia", "leg swelling", "hypoxia"],
    symptom_duration: "2 hours",
    associated_symptoms: ["pleuritic chest pain", "anxiety"],
    risk_factors: ["recent surgery", "immobilization"],
    vitals: { bp_systolic: 105, bp_diastolic: 70, pulse: 120, temperature: 37.5, spo2: 88, respiratory_rate: 26, weight_kg: 85, height_cm: 176 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Pulmonary Embolism",
    alternative_diagnoses: ["Pneumonia", "Pneumothorax", "Myocardial Infarction"],
    expected_symptoms_normalized: ["dyspnea", "chest pain", "tachycardia", "leg swelling", "hypoxia"],
    expected_physiology_states: ["pulmonary vascular obstruction", "impaired gas exchange"],
    expected_organ_systems: ["respiratory", "cardiovascular"],
    recommended_tests: ["CT Pulmonary Angiography", "D-Dimer", "ECG", "ABG"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Pulmonary Embolism"],
  },
};

// ── Exports ──
export const CONTROLLED_SCENARIO = PNEUMONIA; // backwards compat
export const BENCHMARK_SUITE: BenchmarkCase[] = [
  PNEUMONIA,
  GASTROENTERITIS,
  APPENDICITIS,
  UTI,
  MIGRAINE,
  ASTHMA,
  ACS,
  DKA,
  SEPSIS,
  PE,
];
