/**
 * Benchmark v8 — Phase 1: General Physician (Primary Care) Scenarios
 *
 * 10 focused scenarios across 3 categories:
 *   Category 1 — Common Primary Care (4 cases)
 *   Category 2 — Ambiguous Differentials (3 cases)
 *   Category 3 — Emergency Conditions (3 cases)
 *
 * Validates the corrected reasoning pipeline:
 *   Symptoms → Physiology → DDX → Bayesian → Pruning → Evidence → Safety → SOAP
 */

import type { MergedContextObject } from "@/services/context_service";
import type { BenchmarkCaseV8, Specialty, CaseDifficulty, ReasoningCategory } from "./types";

let caseCounter = 0;

function makeCase(
  specialty: Specialty,
  difficulty: CaseDifficulty,
  reasoning_category: ReasoningCategory,
  name: string,
  overrides: Partial<MergedContextObject>,
  ground_truth: BenchmarkCaseV8["ground_truth"],
  tags: string[] = [],
): BenchmarkCaseV8 {
  caseCounter++;
  const id = `v8-${String(caseCounter).padStart(3, "0")}`;
  return {
    id, name, specialty, difficulty, reasoning_category, tags,
    context: {
      visit_id: `bench-v8-${id}`, patient_id: "bench-patient", clinic_id: "bench-clinic",
      chief_complaint: "", symptoms: [], symptom_duration: "", associated_symptoms: [],
      medical_history: [], family_history: [], risk_factors: [], medications: [], allergies: [],
      vitals: null, lab_results: [], risk_flags: [], missing_information: [],
      context_confidence: 0.8, source_priority: ["benchmark"],
      ...overrides,
    },
    ground_truth,
  };
}

// ═══════════════════════════════════════════════════════
// CATEGORY 1 — COMMON PRIMARY CARE (4 cases)
// ═══════════════════════════════════════════════════════

const PRIMARY_CARE: BenchmarkCaseV8[] = [
  // 1. Fever of Unknown Origin
  makeCase("general_practice", "common", "straightforward", "Fever of Unknown Origin", {
    chief_complaint: "Persistent fever for 5 days with body aches",
    symptoms: ["fever", "body ache", "fatigue", "headache", "loss of appetite"],
    symptom_duration: "5 days",
    associated_symptoms: ["chills", "night sweats"],
    vitals: { temperature: 38.6, pulse: 92, bp_systolic: 118, bp_diastolic: 72, spo2: 97 },
  }, {
    gold_standard_diagnosis: "Viral Fever",
    alternative_plausible_diagnoses: ["Dengue", "Urinary Tract Infection", "Typhoid"],
    recommended_tests: ["CBC", "CRP", "Blood Culture", "Urinalysis", "Dengue NS1"],
    recommended_medications: ["Paracetamol", "ORS"],
    guideline_reference: "WHO Fever Management 2023",
    danger_flag: false, organ_system: "infectious", expected_iterations: 1,
  }, ["primary_care"]),

  // 2. Persistent Cough
  makeCase("general_practice", "common", "straightforward", "Persistent Dry Cough", {
    chief_complaint: "Dry cough for 3 weeks, worse at night",
    symptoms: ["dry cough", "throat irritation", "postnasal drip"],
    symptom_duration: "3 weeks",
    associated_symptoms: ["mild wheezing"],
    vitals: { temperature: 37.0, pulse: 78, bp_systolic: 122, bp_diastolic: 78, spo2: 98 },
    medical_history: ["Allergic Rhinitis"],
  }, {
    gold_standard_diagnosis: "Post-Nasal Drip Syndrome",
    alternative_plausible_diagnoses: ["Asthma", "GERD", "ACE Inhibitor Cough"],
    recommended_tests: ["Chest X-ray", "Spirometry", "Allergy Panel"],
    recommended_medications: ["Cetirizine", "Nasal Corticosteroid"],
    guideline_reference: "ACCP Cough Guidelines 2018",
    danger_flag: false, organ_system: "respiratory", expected_iterations: 1,
  }, ["primary_care"]),

  // 3. Abdominal Pain
  makeCase("general_practice", "common", "straightforward", "Acute Gastroenteritis", {
    chief_complaint: "Watery diarrhea and vomiting for 2 days",
    symptoms: ["watery diarrhea", "vomiting", "abdominal cramps", "nausea"],
    symptom_duration: "2 days",
    vitals: { temperature: 37.5, pulse: 92, bp_systolic: 105, bp_diastolic: 65, spo2: 98 },
  }, {
    gold_standard_diagnosis: "Gastroenteritis",
    alternative_plausible_diagnoses: ["Food Poisoning", "IBD Flare"],
    recommended_tests: ["Stool Culture", "BMP", "CBC"],
    recommended_medications: ["Ondansetron", "ORS"],
    guideline_reference: "ACG Gastroenteritis 2016",
    danger_flag: false, organ_system: "gastrointestinal", expected_iterations: 1,
  }, ["primary_care"]),

  // 4. Lower Back Pain
  makeCase("general_practice", "common", "straightforward", "Acute Mechanical Low Back Pain", {
    chief_complaint: "Lower back pain after lifting heavy object, 3 days ago",
    symptoms: ["lower back pain", "muscle stiffness", "pain with movement"],
    symptom_duration: "3 days",
    associated_symptoms: ["limited range of motion"],
    vitals: { temperature: 36.8, pulse: 74, bp_systolic: 128, bp_diastolic: 80, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Mechanical Low Back Pain",
    alternative_plausible_diagnoses: ["Lumbar Disc Herniation", "Muscle Strain"],
    recommended_tests: ["Neurological Exam"],
    recommended_medications: ["Ibuprofen", "Paracetamol", "Muscle Relaxant"],
    guideline_reference: "ACP Low Back Pain 2017",
    danger_flag: false, organ_system: "musculoskeletal", expected_iterations: 1,
  }, ["primary_care"]),
];

// ═══════════════════════════════════════════════════════
// CATEGORY 2 — AMBIGUOUS DIFFERENTIALS (3 cases)
// ═══════════════════════════════════════════════════════

const AMBIGUOUS: BenchmarkCaseV8[] = [
  // 5. Chest Pain — MI vs GERD vs Costochondritis
  makeCase("general_practice", "moderate", "ambiguous", "Chest Pain — MI vs GERD vs Costochondritis", {
    chief_complaint: "Intermittent chest pain for 2 days, worse after meals",
    symptoms: ["chest pain", "heartburn", "chest wall tenderness", "belching"],
    symptom_duration: "2 days",
    associated_symptoms: ["epigastric discomfort", "pain on palpation"],
    vitals: { bp_systolic: 135, bp_diastolic: 82, pulse: 80, spo2: 98 },
    risk_factors: ["smoking", "age > 50"],
    medical_history: ["GERD"],
  }, {
    gold_standard_diagnosis: "GERD",
    alternative_plausible_diagnoses: ["Costochondritis", "Acute Myocardial Infarction", "Stable Angina"],
    recommended_tests: ["ECG", "Troponin", "Chest X-ray"],
    recommended_medications: ["Omeprazole", "Antacid"],
    guideline_reference: "ACG GERD 2022",
    danger_flag: false, organ_system: "gastrointestinal", expected_iterations: 2,
    common_misdiagnosis: "Acute Myocardial Infarction",
  }, ["ambiguous"]),

  // 6. Dyspnea — Pneumonia vs CHF vs COPD
  makeCase("general_practice", "moderate", "ambiguous", "Dyspnea — Pneumonia vs CHF vs COPD", {
    chief_complaint: "Progressive shortness of breath and cough for 4 days",
    symptoms: ["dyspnea", "productive cough", "wheezing", "bilateral leg edema"],
    symptom_duration: "4 days",
    vitals: { temperature: 37.6, pulse: 98, bp_systolic: 150, bp_diastolic: 88, spo2: 90, respiratory_rate: 26 },
    medical_history: ["Hypertension", "COPD"],
  }, {
    gold_standard_diagnosis: "COPD Exacerbation",
    alternative_plausible_diagnoses: ["Pneumonia", "Heart Failure"],
    recommended_tests: ["Chest X-ray", "BNP", "ABG", "CBC", "Sputum Culture"],
    recommended_medications: ["Salbutamol", "Ipratropium", "Prednisolone"],
    guideline_reference: "GOLD 2024",
    danger_flag: false, organ_system: "respiratory", expected_iterations: 2,
    common_misdiagnosis: "Pneumonia",
  }, ["ambiguous"]),

  // 7. Headache — Migraine vs Meningitis vs SAH
  makeCase("general_practice", "complex", "ambiguous", "Headache — Migraine vs Meningitis vs SAH", {
    chief_complaint: "Severe headache with neck stiffness and photophobia",
    symptoms: ["severe headache", "neck stiffness", "photophobia", "nausea"],
    symptom_duration: "6 hours",
    associated_symptoms: ["vomiting", "fever"],
    vitals: { temperature: 38.2, bp_systolic: 140, bp_diastolic: 88, pulse: 92, spo2: 98 },
  }, {
    gold_standard_diagnosis: "Meningitis",
    alternative_plausible_diagnoses: ["Migraine", "Subarachnoid Hemorrhage"],
    recommended_tests: ["CT Head", "Lumbar Puncture", "CBC", "Blood Culture", "CRP"],
    recommended_medications: ["Ceftriaxone", "Dexamethasone", "Vancomycin"],
    guideline_reference: "IDSA Meningitis 2017",
    danger_flag: true, organ_system: "neurological", expected_iterations: 2,
    common_misdiagnosis: "Migraine",
  }, ["ambiguous", "must_not_miss"]),
];

// ═══════════════════════════════════════════════════════
// CATEGORY 3 — EMERGENCY CONDITIONS (3 cases)
// ═══════════════════════════════════════════════════════

const EMERGENCY: BenchmarkCaseV8[] = [
  // 8. Acute MI
  makeCase("general_practice", "complex", "deceptive", "Acute Myocardial Infarction", {
    chief_complaint: "Crushing chest pain radiating to left arm with diaphoresis",
    symptoms: ["chest pain", "left arm pain", "diaphoresis", "dyspnea"],
    symptom_duration: "1 hour",
    associated_symptoms: ["nausea", "anxiety"],
    vitals: { bp_systolic: 160, bp_diastolic: 95, pulse: 110, spo2: 94 },
    risk_factors: ["smoking", "diabetes", "hypertension", "age > 55"],
  }, {
    gold_standard_diagnosis: "Acute Myocardial Infarction",
    alternative_plausible_diagnoses: ["Pulmonary Embolism", "Aortic Dissection", "Pericarditis"],
    recommended_tests: ["ECG", "Troponin", "Chest X-ray", "BMP"],
    recommended_medications: ["Aspirin", "Heparin", "Nitroglycerin", "Morphine"],
    guideline_reference: "AHA ACS 2023",
    danger_flag: true, organ_system: "cardiovascular", expected_iterations: 1,
  }, ["emergency", "must_not_miss"]),

  // 9. Sepsis
  makeCase("general_practice", "complex", "deceptive", "Sepsis from UTI Source", {
    chief_complaint: "High fever, confusion, and low blood pressure",
    symptoms: ["high fever", "confusion", "hypotension", "tachycardia", "dysuria"],
    symptom_duration: "1 day",
    associated_symptoms: ["chills", "oliguria", "flank pain"],
    vitals: { temperature: 39.5, pulse: 118, bp_systolic: 85, bp_diastolic: 52, spo2: 91, respiratory_rate: 26 },
    risk_factors: ["age > 65", "diabetes"],
    medical_history: ["Recurrent UTI", "Type 2 Diabetes"],
  }, {
    gold_standard_diagnosis: "Sepsis",
    alternative_plausible_diagnoses: ["Urinary Tract Infection", "Pyelonephritis", "Pneumonia"],
    recommended_tests: ["Blood Culture", "Lactate", "CBC", "Procalcitonin", "Urinalysis", "Urine Culture"],
    recommended_medications: ["Piperacillin-Tazobactam", "IV Fluids", "Vasopressors"],
    guideline_reference: "Surviving Sepsis Campaign 2021",
    danger_flag: true, organ_system: "infectious", expected_iterations: 1,
    common_misdiagnosis: "Simple UTI",
  }, ["emergency", "must_not_miss"]),

  // 10. Diabetic Ketoacidosis
  makeCase("general_practice", "complex", "deceptive", "Diabetic Ketoacidosis", {
    chief_complaint: "Nausea, vomiting, abdominal pain, and rapid breathing",
    symptoms: ["nausea", "vomiting", "abdominal pain", "rapid breathing", "fruity breath odor"],
    symptom_duration: "12 hours",
    associated_symptoms: ["polyuria", "polydipsia", "weakness", "dehydration"],
    vitals: { temperature: 37.2, pulse: 120, bp_systolic: 95, bp_diastolic: 58, spo2: 97, respiratory_rate: 32 },
    medical_history: ["Type 1 Diabetes"],
    medications: ["Insulin lispro"],
  }, {
    gold_standard_diagnosis: "Diabetic Ketoacidosis",
    alternative_plausible_diagnoses: ["Gastroenteritis", "Acute Pancreatitis", "Appendicitis"],
    recommended_tests: ["Blood Glucose", "ABG", "BMP", "Serum Ketones", "Urinalysis"],
    recommended_medications: ["Insulin IV", "IV Fluids", "Potassium Replacement"],
    guideline_reference: "ADA DKA 2024",
    danger_flag: true, organ_system: "endocrine", expected_iterations: 1,
    common_misdiagnosis: "Gastroenteritis",
  }, ["emergency", "must_not_miss"]),
];

// ═══════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════

export const BENCHMARK_CASES_V8: BenchmarkCaseV8[] = [
  ...PRIMARY_CARE,
  ...AMBIGUOUS,
  ...EMERGENCY,
];

export function getCaseDistributionV8() {
  const dist: Record<string, number> = {};
  for (const c of BENCHMARK_CASES_V8) {
    dist[c.reasoning_category] = (dist[c.reasoning_category] || 0) + 1;
  }
  return dist;
}
