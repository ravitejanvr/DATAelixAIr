/**
 * Benchmark v8 — 25 Cognitive Clinical Reasoning Scenarios
 *
 * Distribution:
 *   Emergency Medicine: 5, Cardiology: 4, Pulmonology: 3, Neurology: 3,
 *   Gastroenterology: 3, Endocrinology: 2, Infectious Disease: 2,
 *   Pediatrics: 2, Nephrology: 1
 *
 * Includes common diseases + dangerous emergencies across all three reasoning categories.
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
// EMERGENCY MEDICINE — 5 cases
// ═══════════════════════════════════════════════════════

const EMERGENCY: BenchmarkCaseV8[] = [
  // 1. Straightforward
  makeCase("emergency_medicine", "common", "straightforward", "Classic Appendicitis", {
    chief_complaint: "Right lower quadrant pain for 12 hours",
    symptoms: ["right lower quadrant pain", "nausea", "anorexia", "low-grade fever"],
    symptom_duration: "12 hours",
    associated_symptoms: ["vomiting", "rebound tenderness"],
    vitals: { temperature: 37.8, pulse: 90, bp_systolic: 120, bp_diastolic: 75, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Appendicitis",
    alternative_plausible_diagnoses: ["Mesenteric Lymphadenitis", "Gastroenteritis"],
    recommended_tests: ["CBC", "CRP", "CT Abdomen", "Urinalysis"],
    recommended_medications: ["Ceftriaxone", "Metronidazole"],
    guideline_reference: "WSES 2020 Appendicitis",
    danger_flag: true, organ_system: "gastrointestinal", expected_iterations: 1,
  }, ["emergency", "must_not_miss"]),

  // 2. Ambiguous — Chest Pain MI vs PE
  makeCase("emergency_medicine", "complex", "ambiguous", "Chest Pain — MI vs PE", {
    chief_complaint: "Acute chest pain radiating to left arm with dyspnea",
    symptoms: ["chest pain", "left arm pain", "dyspnea", "diaphoresis"],
    symptom_duration: "2 hours",
    associated_symptoms: ["anxiety", "tachycardia"],
    vitals: { bp_systolic: 150, bp_diastolic: 92, pulse: 108, spo2: 93 },
    risk_factors: ["smoking", "recent surgery"],
  }, {
    gold_standard_diagnosis: "Acute Myocardial Infarction",
    alternative_plausible_diagnoses: ["Pulmonary Embolism", "Pericarditis", "Aortic Dissection"],
    recommended_tests: ["ECG", "Troponin", "D-dimer", "Chest X-ray"],
    recommended_medications: ["Aspirin", "Heparin", "Nitroglycerin"],
    guideline_reference: "AHA ACS 2023",
    danger_flag: true, organ_system: "cardiovascular", expected_iterations: 2,
    common_misdiagnosis: "Pulmonary Embolism",
  }, ["emergency", "must_not_miss", "ambiguous_chest"]),

  // 3. Deceptive — Stroke vs Hypoglycemia
  makeCase("emergency_medicine", "complex", "deceptive", "Stroke vs Hypoglycemia", {
    chief_complaint: "Sudden confusion and right-sided weakness",
    symptoms: ["confusion", "right-sided weakness", "slurred speech", "diaphoresis"],
    symptom_duration: "45 minutes",
    vitals: { bp_systolic: 165, bp_diastolic: 95, pulse: 100, spo2: 97 },
    medical_history: ["Type 2 Diabetes", "Insulin use"],
    medications: ["Insulin glargine", "Metformin"],
  }, {
    gold_standard_diagnosis: "Hypoglycemia",
    alternative_plausible_diagnoses: ["Stroke", "TIA", "Seizure"],
    recommended_tests: ["Blood Glucose", "CT Head", "CBC", "BMP"],
    recommended_medications: ["Dextrose IV", "Glucagon"],
    guideline_reference: "ADA Hypoglycemia 2024",
    danger_flag: true, organ_system: "endocrine", expected_iterations: 2,
    common_misdiagnosis: "Stroke",
  }, ["emergency", "must_not_miss", "deceptive"]),

  // 4. Deceptive — Sepsis vs Influenza
  makeCase("emergency_medicine", "complex", "deceptive", "Sepsis vs Influenza", {
    chief_complaint: "High fever, body aches, and confusion for 2 days",
    symptoms: ["high fever", "body ache", "confusion", "tachycardia", "hypotension"],
    symptom_duration: "2 days",
    associated_symptoms: ["chills", "oliguria", "malaise"],
    vitals: { temperature: 39.5, pulse: 115, bp_systolic: 88, bp_diastolic: 55, spo2: 92, respiratory_rate: 24 },
    risk_factors: ["immunocompromised", "age > 65"],
  }, {
    gold_standard_diagnosis: "Sepsis",
    alternative_plausible_diagnoses: ["Influenza", "Pneumonia", "UTI"],
    recommended_tests: ["Blood Culture", "Lactate", "CBC", "Procalcitonin", "Urinalysis"],
    recommended_medications: ["Piperacillin-Tazobactam", "IV Fluids", "Vasopressors"],
    guideline_reference: "Surviving Sepsis Campaign 2021",
    danger_flag: true, organ_system: "infectious", expected_iterations: 2,
    common_misdiagnosis: "Influenza",
  }, ["emergency", "must_not_miss", "deceptive"]),

  // 5. Ambiguous — Syncope
  makeCase("emergency_medicine", "moderate", "ambiguous", "Syncope — Cardiac vs Vasovagal", {
    chief_complaint: "Loss of consciousness while standing",
    symptoms: ["syncope", "palpitations before fainting", "brief loss of consciousness"],
    symptom_duration: "single episode",
    associated_symptoms: ["chest discomfort", "diaphoresis"],
    vitals: { bp_systolic: 95, bp_diastolic: 58, pulse: 52, spo2: 98 },
    medical_history: ["Heart murmur"],
  }, {
    gold_standard_diagnosis: "Cardiac Syncope",
    alternative_plausible_diagnoses: ["Vasovagal Syncope", "Orthostatic Hypotension"],
    recommended_tests: ["ECG", "Echocardiogram", "Holter Monitor", "Blood Glucose"],
    recommended_medications: [],
    guideline_reference: "ESC Syncope 2018",
    danger_flag: true, organ_system: "cardiovascular", expected_iterations: 2,
  }, ["emergency", "ambiguous_syncope"]),
];

// ═══════════════════════════════════════════════════════
// CARDIOLOGY — 4 cases
// ═══════════════════════════════════════════════════════

const CARDIOLOGY: BenchmarkCaseV8[] = [
  makeCase("cardiology", "common", "straightforward", "Stable Angina", {
    chief_complaint: "Chest pain on exertion relieved by rest",
    symptoms: ["chest pain", "exertional dyspnea"],
    symptom_duration: "3 weeks",
    vitals: { bp_systolic: 145, bp_diastolic: 90, pulse: 78, spo2: 97 },
    medical_history: ["Hypertension"],
    risk_factors: ["smoking", "age > 55"],
  }, {
    gold_standard_diagnosis: "Stable Angina",
    alternative_plausible_diagnoses: ["GERD", "Costochondritis"],
    recommended_tests: ["ECG", "Stress Test", "Troponin", "Lipid Panel"],
    recommended_medications: ["Nitroglycerin", "Aspirin", "Atorvastatin"],
    guideline_reference: "AHA/ACC CCD 2023",
    danger_flag: false, organ_system: "cardiovascular", expected_iterations: 1,
  }),

  makeCase("cardiology", "moderate", "ambiguous", "Atrial Fibrillation vs SVT", {
    chief_complaint: "Irregular rapid heartbeat with dizziness for 3 hours",
    symptoms: ["palpitations", "irregular heartbeat", "dizziness", "chest discomfort"],
    symptom_duration: "3 hours",
    vitals: { bp_systolic: 138, bp_diastolic: 85, pulse: 148, spo2: 95 },
    medical_history: ["Hypertension"],
  }, {
    gold_standard_diagnosis: "Atrial Fibrillation",
    alternative_plausible_diagnoses: ["SVT", "Atrial Flutter"],
    recommended_tests: ["ECG", "TSH", "Echocardiogram", "BMP"],
    recommended_medications: ["Metoprolol", "Apixaban"],
    guideline_reference: "AHA AF 2023",
    danger_flag: false, organ_system: "cardiovascular", expected_iterations: 2,
  }),

  makeCase("cardiology", "moderate", "ambiguous", "Heart Failure vs Pneumonia", {
    chief_complaint: "Progressive dyspnea and orthopnea for 3 days",
    symptoms: ["dyspnea", "orthopnea", "bilateral leg edema", "productive cough"],
    symptom_duration: "3 days",
    vitals: { bp_systolic: 155, bp_diastolic: 90, pulse: 100, spo2: 89, respiratory_rate: 26 },
    medical_history: ["Hypertension", "Diabetes"],
  }, {
    gold_standard_diagnosis: "Acute Decompensated Heart Failure",
    alternative_plausible_diagnoses: ["Pneumonia", "COPD Exacerbation"],
    recommended_tests: ["BNP", "Chest X-ray", "Echocardiogram", "CBC"],
    recommended_medications: ["Furosemide", "Oxygen", "Nitroglycerin"],
    guideline_reference: "AHA/ACC HF 2022",
    danger_flag: false, organ_system: "cardiovascular", expected_iterations: 2,
  }),

  makeCase("cardiology", "complex", "deceptive", "Takotsubo vs STEMI", {
    chief_complaint: "Sudden severe chest pain after emotional stress",
    symptoms: ["chest pain", "dyspnea", "ECG changes mimicking STEMI"],
    symptom_duration: "3 hours",
    associated_symptoms: ["anxiety", "diaphoresis"],
    vitals: { bp_systolic: 100, bp_diastolic: 65, pulse: 105, spo2: 94 },
    medical_history: ["Recent bereavement"],
  }, {
    gold_standard_diagnosis: "Takotsubo Cardiomyopathy",
    alternative_plausible_diagnoses: ["Acute Myocardial Infarction", "Pericarditis"],
    recommended_tests: ["ECG", "Troponin", "Echocardiogram", "Coronary Angiography"],
    recommended_medications: ["Beta-blockers", "ACE Inhibitors"],
    guideline_reference: "ESC Position Statement 2018",
    danger_flag: true, organ_system: "cardiovascular", expected_iterations: 2,
    common_misdiagnosis: "Acute Myocardial Infarction",
  }, ["deceptive", "must_not_miss"]),
];

// ═══════════════════════════════════════════════════════
// PULMONOLOGY — 3 cases
// ═══════════════════════════════════════════════════════

const PULMONOLOGY: BenchmarkCaseV8[] = [
  makeCase("pulmonology", "common", "straightforward", "Community-Acquired Pneumonia", {
    chief_complaint: "Productive cough with fever for 5 days",
    symptoms: ["productive cough", "fever", "pleuritic chest pain", "dyspnea"],
    symptom_duration: "5 days",
    vitals: { temperature: 38.7, pulse: 95, bp_systolic: 115, bp_diastolic: 70, spo2: 93, respiratory_rate: 22 },
  }, {
    gold_standard_diagnosis: "Pneumonia",
    alternative_plausible_diagnoses: ["Bronchitis", "Tuberculosis"],
    recommended_tests: ["Chest X-ray", "CBC", "Blood Culture", "Sputum Culture"],
    recommended_medications: ["Amoxicillin", "Azithromycin"],
    guideline_reference: "ATS/IDSA CAP 2019",
    danger_flag: false, organ_system: "respiratory", expected_iterations: 1,
  }),

  makeCase("pulmonology", "moderate", "ambiguous", "COPD vs Pneumonia vs CHF", {
    chief_complaint: "Worsening dyspnea and increased sputum for 4 days",
    symptoms: ["dyspnea", "increased sputum production", "wheezing", "cough"],
    symptom_duration: "4 days",
    vitals: { temperature: 37.6, pulse: 98, bp_systolic: 140, bp_diastolic: 85, spo2: 88, respiratory_rate: 28 },
    medical_history: ["COPD", "Former smoker"],
  }, {
    gold_standard_diagnosis: "COPD Exacerbation",
    alternative_plausible_diagnoses: ["Pneumonia", "Heart Failure"],
    recommended_tests: ["Chest X-ray", "ABG", "BNP", "Sputum Culture"],
    recommended_medications: ["Salbutamol", "Ipratropium", "Prednisolone", "Azithromycin"],
    guideline_reference: "GOLD 2024",
    danger_flag: false, organ_system: "respiratory", expected_iterations: 2,
  }),

  makeCase("pulmonology", "complex", "deceptive", "PE Masquerading as Anxiety", {
    chief_complaint: "Sudden dyspnea and chest tightness in young woman",
    symptoms: ["dyspnea", "chest tightness", "tachycardia", "anxiety"],
    symptom_duration: "1 hour",
    vitals: { pulse: 118, bp_systolic: 100, bp_diastolic: 62, spo2: 91, respiratory_rate: 28 },
    risk_factors: ["oral contraceptive use", "recent long flight"],
  }, {
    gold_standard_diagnosis: "Pulmonary Embolism",
    alternative_plausible_diagnoses: ["Panic Attack", "Pneumothorax"],
    recommended_tests: ["D-dimer", "CT Pulmonary Angiography", "ECG", "ABG"],
    recommended_medications: ["Heparin", "Enoxaparin"],
    guideline_reference: "ESC PE 2019",
    danger_flag: true, organ_system: "respiratory", expected_iterations: 2,
    common_misdiagnosis: "Panic Attack",
  }, ["deceptive", "must_not_miss"]),
];

// ═══════════════════════════════════════════════════════
// NEUROLOGY — 3 cases
// ═══════════════════════════════════════════════════════

const NEUROLOGY: BenchmarkCaseV8[] = [
  makeCase("neurology", "common", "straightforward", "Classic Migraine", {
    chief_complaint: "Severe unilateral headache with visual aura",
    symptoms: ["severe headache", "visual aura", "photophobia", "nausea"],
    symptom_duration: "6 hours",
    vitals: { bp_systolic: 130, bp_diastolic: 82, pulse: 75, spo2: 99 },
    medical_history: ["Migraine"],
  }, {
    gold_standard_diagnosis: "Migraine",
    alternative_plausible_diagnoses: ["Tension Headache", "Cluster Headache"],
    recommended_tests: ["Neurological Exam"],
    recommended_medications: ["Sumatriptan", "Ibuprofen"],
    guideline_reference: "AHS Migraine 2021",
    danger_flag: false, organ_system: "neurological", expected_iterations: 1,
  }),

  makeCase("neurology", "complex", "ambiguous", "Seizure vs Syncope", {
    chief_complaint: "Witnessed collapse with convulsions",
    symptoms: ["loss of consciousness", "tonic-clonic movements", "confusion"],
    symptom_duration: "2 minutes",
    associated_symptoms: ["tongue biting", "urinary incontinence", "postictal confusion"],
    vitals: { bp_systolic: 150, bp_diastolic: 90, pulse: 95, spo2: 96 },
  }, {
    gold_standard_diagnosis: "Epileptic Seizure",
    alternative_plausible_diagnoses: ["Convulsive Syncope", "Psychogenic Non-Epileptic Seizure"],
    recommended_tests: ["EEG", "CT Head", "Blood Glucose", "Prolactin", "BMP"],
    recommended_medications: ["Levetiracetam", "Lorazepam"],
    guideline_reference: "AAN Seizure 2023",
    danger_flag: false, organ_system: "neurological", expected_iterations: 2,
  }),

  makeCase("neurology", "complex", "deceptive", "SAH — Thunderclap Headache", {
    chief_complaint: "Worst headache of my life, sudden onset",
    symptoms: ["thunderclap headache", "neck stiffness", "photophobia", "nausea"],
    symptom_duration: "1 hour",
    associated_symptoms: ["vomiting", "altered consciousness"],
    vitals: { bp_systolic: 180, bp_diastolic: 105, pulse: 88, spo2: 98 },
  }, {
    gold_standard_diagnosis: "Subarachnoid Hemorrhage",
    alternative_plausible_diagnoses: ["Migraine", "Meningitis", "Tension Headache"],
    recommended_tests: ["CT Head", "Lumbar Puncture", "CT Angiography"],
    recommended_medications: ["Nimodipine", "Analgesics"],
    guideline_reference: "AHA SAH 2023",
    danger_flag: true, organ_system: "neurological", expected_iterations: 2,
    common_misdiagnosis: "Migraine",
  }, ["must_not_miss", "deceptive"]),
];

// ═══════════════════════════════════════════════════════
// GASTROENTEROLOGY — 3 cases
// ═══════════════════════════════════════════════════════

const GASTRO: BenchmarkCaseV8[] = [
  makeCase("gastroenterology", "common", "straightforward", "Acute Gastroenteritis", {
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
  }),

  makeCase("gastroenterology", "complex", "ambiguous", "Pancreatitis vs Cholecystitis", {
    chief_complaint: "Severe epigastric pain radiating to back after heavy meal",
    symptoms: ["epigastric pain", "radiating to back", "nausea", "vomiting"],
    symptom_duration: "8 hours",
    vitals: { temperature: 37.9, pulse: 100, bp_systolic: 125, bp_diastolic: 78, spo2: 97 },
    risk_factors: ["alcohol use", "gallstones history"],
  }, {
    gold_standard_diagnosis: "Acute Pancreatitis",
    alternative_plausible_diagnoses: ["Cholecystitis", "Peptic Ulcer Disease", "Biliary Colic"],
    recommended_tests: ["Lipase", "Amylase", "Abdominal Ultrasound", "CT Abdomen", "LFT"],
    recommended_medications: ["IV Fluids", "Analgesics", "Ondansetron"],
    guideline_reference: "ACG Pancreatitis 2024",
    danger_flag: false, organ_system: "gastrointestinal", expected_iterations: 2,
  }),

  makeCase("gastroenterology", "moderate", "deceptive", "GI Bleed Mimicking Iron Deficiency", {
    chief_complaint: "Fatigue, pallor, and dark stools for 2 weeks",
    symptoms: ["fatigue", "pallor", "melena", "dizziness"],
    symptom_duration: "2 weeks",
    vitals: { pulse: 98, bp_systolic: 100, bp_diastolic: 60, spo2: 97 },
    medical_history: ["NSAID use", "Peptic ulcer disease"],
  }, {
    gold_standard_diagnosis: "Upper GI Bleed",
    alternative_plausible_diagnoses: ["Iron Deficiency Anemia", "Gastric Ulcer"],
    recommended_tests: ["CBC", "Stool Occult Blood", "Upper Endoscopy", "BMP", "Coagulation"],
    recommended_medications: ["IV PPI", "IV Fluids"],
    guideline_reference: "ACG GI Bleeding 2021",
    danger_flag: true, organ_system: "gastrointestinal", expected_iterations: 2,
    common_misdiagnosis: "Iron Deficiency Anemia",
  }, ["deceptive"]),
];

// ═══════════════════════════════════════════════════════
// REMAINING SPECIALTIES
// ═══════════════════════════════════════════════════════

const OTHER: BenchmarkCaseV8[] = [
  // Endocrinology — 2
  makeCase("endocrinology", "common", "straightforward", "Type 2 Diabetes — New Diagnosis", {
    chief_complaint: "Increased thirst and frequent urination for 1 month",
    symptoms: ["polydipsia", "polyuria", "fatigue", "blurred vision"],
    symptom_duration: "1 month",
    vitals: { bp_systolic: 140, bp_diastolic: 88, pulse: 80, spo2: 98 },
    risk_factors: ["obesity", "family history of diabetes"],
  }, {
    gold_standard_diagnosis: "Type 2 Diabetes Mellitus",
    alternative_plausible_diagnoses: ["Diabetes Insipidus", "UTI"],
    recommended_tests: ["Fasting Blood Glucose", "HbA1c", "BMP", "Urinalysis"],
    recommended_medications: ["Metformin"],
    guideline_reference: "ADA Standards 2024",
    danger_flag: false, organ_system: "endocrine", expected_iterations: 1,
  }),

  makeCase("endocrinology", "complex", "deceptive", "DKA vs Gastroenteritis", {
    chief_complaint: "Vomiting, abdominal pain, and rapid breathing",
    symptoms: ["vomiting", "abdominal pain", "Kussmaul breathing", "dehydration", "fruity breath"],
    symptom_duration: "1 day",
    vitals: { temperature: 37.2, pulse: 120, bp_systolic: 95, bp_diastolic: 55, spo2: 96, respiratory_rate: 30 },
    medical_history: ["Type 1 Diabetes"],
  }, {
    gold_standard_diagnosis: "Diabetic Ketoacidosis",
    alternative_plausible_diagnoses: ["Gastroenteritis", "Sepsis", "Pancreatitis"],
    recommended_tests: ["Blood Glucose", "ABG", "Serum Ketones", "BMP", "Urinalysis"],
    recommended_medications: ["Insulin IV", "IV Fluids", "Potassium"],
    guideline_reference: "ADA DKA 2024",
    danger_flag: true, organ_system: "endocrine", expected_iterations: 2,
    common_misdiagnosis: "Gastroenteritis",
  }, ["deceptive", "must_not_miss"]),

  // Infectious Disease — 2
  makeCase("infectious_disease", "common", "straightforward", "Uncomplicated UTI", {
    chief_complaint: "Painful urination and frequency for 3 days",
    symptoms: ["dysuria", "urinary frequency", "urgency", "suprapubic pain"],
    symptom_duration: "3 days",
    vitals: { temperature: 37.2, pulse: 78, bp_systolic: 118, bp_diastolic: 72, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Urinary Tract Infection",
    alternative_plausible_diagnoses: ["Vaginitis", "Interstitial Cystitis"],
    recommended_tests: ["Urinalysis", "Urine Culture"],
    recommended_medications: ["Nitrofurantoin", "Trimethoprim-Sulfamethoxazole"],
    guideline_reference: "IDSA UTI 2011",
    danger_flag: false, organ_system: "genitourinary", expected_iterations: 1,
  }),

  makeCase("infectious_disease", "moderate", "ambiguous", "Dengue vs Chikungunya", {
    chief_complaint: "High fever with severe joint pain and rash for 3 days",
    symptoms: ["high fever", "severe joint pain", "maculopapular rash", "retro-orbital pain"],
    symptom_duration: "3 days",
    associated_symptoms: ["myalgia", "headache", "nausea"],
    vitals: { temperature: 39.0, pulse: 95, bp_systolic: 110, bp_diastolic: 68, spo2: 98 },
    risk_factors: ["monsoon season", "endemic area"],
  }, {
    gold_standard_diagnosis: "Dengue",
    alternative_plausible_diagnoses: ["Chikungunya", "Zika", "Malaria"],
    recommended_tests: ["Dengue NS1 Antigen", "CBC", "Dengue IgM/IgG", "Platelet Count"],
    recommended_medications: ["Acetaminophen", "IV Fluids"],
    guideline_reference: "WHO Dengue Guidelines 2009",
    danger_flag: false, organ_system: "infectious", expected_iterations: 2,
  }),

  // Pediatrics — 2
  makeCase("pediatrics", "common", "straightforward", "Acute Otitis Media", {
    chief_complaint: "Ear pain and fever in 3-year-old child",
    symptoms: ["ear pain", "fever", "irritability", "ear tugging"],
    symptom_duration: "2 days",
    vitals: { temperature: 38.5, pulse: 120, spo2: 98 },
    risk_factors: ["daycare attendance", "age < 5"],
  }, {
    gold_standard_diagnosis: "Acute Otitis Media",
    alternative_plausible_diagnoses: ["Otitis Externa", "Pharyngitis"],
    recommended_tests: ["Otoscopy", "Tympanometry"],
    recommended_medications: ["Amoxicillin", "Ibuprofen"],
    guideline_reference: "AAP AOM 2013",
    danger_flag: false, organ_system: "ENT", expected_iterations: 1,
  }),

  makeCase("pediatrics", "complex", "deceptive", "Kawasaki Disease vs Scarlet Fever", {
    chief_complaint: "Persistent fever and rash in 4-year-old for 5 days",
    symptoms: ["persistent fever", "rash", "conjunctival injection", "strawberry tongue", "cervical lymphadenopathy"],
    symptom_duration: "5 days",
    associated_symptoms: ["irritability", "swollen hands and feet", "desquamation"],
    vitals: { temperature: 39.2, pulse: 130, spo2: 98 },
  }, {
    gold_standard_diagnosis: "Kawasaki Disease",
    alternative_plausible_diagnoses: ["Scarlet Fever", "Measles", "Juvenile Idiopathic Arthritis"],
    recommended_tests: ["Echocardiogram", "CBC", "CRP", "ESR", "Blood Culture"],
    recommended_medications: ["IVIG", "Aspirin"],
    guideline_reference: "AHA Kawasaki 2017",
    danger_flag: true, organ_system: "cardiovascular", expected_iterations: 2,
    common_misdiagnosis: "Scarlet Fever",
  }, ["deceptive", "must_not_miss"]),

  // Nephrology — 1
  makeCase("nephrology", "moderate", "ambiguous", "Acute Kidney Injury — Pre-renal vs Intrinsic", {
    chief_complaint: "Decreased urine output and leg swelling for 2 days",
    symptoms: ["oliguria", "lower extremity edema", "fatigue", "nausea"],
    symptom_duration: "2 days",
    vitals: { bp_systolic: 160, bp_diastolic: 95, pulse: 88, spo2: 96 },
    medical_history: ["Hypertension", "Diabetes", "NSAID use"],
    medications: ["Ibuprofen", "Lisinopril"],
  }, {
    gold_standard_diagnosis: "Acute Kidney Injury",
    alternative_plausible_diagnoses: ["Chronic Kidney Disease Exacerbation", "Heart Failure"],
    recommended_tests: ["BMP", "Creatinine", "Urinalysis", "Renal Ultrasound", "Urine Electrolytes"],
    recommended_medications: ["IV Fluids", "Stop NSAIDs"],
    guideline_reference: "KDIGO AKI 2012",
    danger_flag: false, organ_system: "renal", expected_iterations: 2,
  }),
];

// ── Export ──

export const BENCHMARK_CASES_V8: BenchmarkCaseV8[] = [
  ...EMERGENCY,
  ...CARDIOLOGY,
  ...PULMONOLOGY,
  ...NEUROLOGY,
  ...GASTRO,
  ...OTHER,
];

export function getCaseDistributionV8() {
  const bySpecialty: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const c of BENCHMARK_CASES_V8) {
    bySpecialty[c.specialty] = (bySpecialty[c.specialty] || 0) + 1;
    byCategory[c.reasoning_category] = (byCategory[c.reasoning_category] || 0) + 1;
  }
  return { total: BENCHMARK_CASES_V8.length, bySpecialty, byCategory };
}
