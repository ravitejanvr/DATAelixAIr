/**
 * Benchmark v7 — 50 Iterative Clinical Reasoning Scenarios
 *
 * Distribution:
 *   Emergency Medicine: 10, Cardiology: 8, Pulmonology: 6, Neurology: 6,
 *   Gastroenterology: 6, Endocrinology: 4, Infectious Disease: 4,
 *   Pediatrics: 3, Nephrology: 2, Hematology: 1
 *
 * Reasoning Categories:
 *   Cat 1 — Straightforward: single iteration sufficient (~18 cases)
 *   Cat 2 — Ambiguous: requires hypothesis testing (~20 cases)
 *   Cat 3 — Deceptive: requires physiology reasoning (~12 cases)
 */

import type { MergedContextObject } from "@/services/context_service";
import type { BenchmarkCaseV7, Specialty, CaseDifficulty, ReasoningCategory } from "./types";

let caseCounter = 0;

function makeCase(
  specialty: Specialty,
  difficulty: CaseDifficulty,
  reasoning_category: ReasoningCategory,
  name: string,
  overrides: Partial<MergedContextObject>,
  ground_truth: BenchmarkCaseV7["ground_truth"],
  tags: string[] = [],
): BenchmarkCaseV7 {
  caseCounter++;
  const id = `v7-${String(caseCounter).padStart(3, "0")}`;
  return {
    id, name, specialty, difficulty, reasoning_category, tags,
    context: {
      visit_id: `bench-v7-${id}`, patient_id: "bench-patient", clinic_id: "bench-clinic",
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
// CATEGORY 1 — STRAIGHTFORWARD (single iteration)
// ═══════════════════════════════════════════════════════

const STRAIGHTFORWARD: BenchmarkCaseV7[] = [
  // Emergency Medicine
  makeCase("emergency_medicine", "common", "straightforward", "Classic Appendicitis", {
    chief_complaint: "Right lower quadrant pain for 12 hours",
    symptoms: ["right lower quadrant pain", "nausea", "anorexia", "low-grade fever"],
    symptom_duration: "12 hours",
    associated_symptoms: ["vomiting", "rebound tenderness"],
    vitals: { temperature: 37.8, pulse: 90, bp_systolic: 120, bp_diastolic: 75, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Appendicitis",
    alternative_plausible_diagnoses: ["Mesenteric Lymphadenitis", "Ovarian Cyst", "Gastroenteritis"],
    recommended_tests: ["CBC", "CRP", "CT Abdomen", "Urinalysis"],
    recommended_medications: ["Ceftriaxone", "Metronidazole"],
    guideline_reference: "WSES 2020 Appendicitis",
    danger_flag: true, organ_system: "gastrointestinal",
    expected_iterations: 1,
  }, ["emergency", "must_not_miss"]),

  makeCase("emergency_medicine", "common", "straightforward", "Simple Laceration", {
    chief_complaint: "Cut on forearm from broken glass",
    symptoms: ["laceration", "bleeding", "pain at wound site"],
    symptom_duration: "30 minutes",
    vitals: { bp_systolic: 125, bp_diastolic: 80, pulse: 78, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Laceration",
    alternative_plausible_diagnoses: ["Tendon Injury", "Foreign Body"],
    recommended_tests: ["Wound Exploration", "X-ray"],
    recommended_medications: ["Lidocaine", "Tetanus Toxoid"],
    guideline_reference: "ACEP Wound Management",
    danger_flag: false, organ_system: "integumentary",
    expected_iterations: 1,
  }),

  // Cardiology
  makeCase("cardiology", "common", "straightforward", "Stable Angina Pectoris", {
    chief_complaint: "Chest pain on exertion relieved by rest",
    symptoms: ["chest pain", "exertional dyspnea"],
    symptom_duration: "3 weeks",
    vitals: { bp_systolic: 145, bp_diastolic: 90, pulse: 78, spo2: 97 },
    medical_history: ["Hypertension"],
    risk_factors: ["smoking", "age > 55"],
  }, {
    gold_standard_diagnosis: "Stable Angina",
    alternative_plausible_diagnoses: ["Costochondritis", "GERD", "Anxiety"],
    recommended_tests: ["ECG", "Stress Test", "Troponin", "Lipid Panel"],
    recommended_medications: ["Nitroglycerin", "Aspirin", "Atorvastatin"],
    guideline_reference: "AHA/ACC CCD 2023",
    danger_flag: false, organ_system: "cardiovascular",
    expected_iterations: 1,
  }),

  makeCase("cardiology", "common", "straightforward", "SVT Episode", {
    chief_complaint: "Sudden rapid heartbeat lasting 20 minutes",
    symptoms: ["palpitations", "rapid heartbeat", "chest tightness"],
    symptom_duration: "20 minutes",
    vitals: { bp_systolic: 125, bp_diastolic: 78, pulse: 180, spo2: 97 },
  }, {
    gold_standard_diagnosis: "Supraventricular Tachycardia",
    alternative_plausible_diagnoses: ["Atrial Fibrillation", "Ventricular Tachycardia", "Panic Attack"],
    recommended_tests: ["ECG", "Electrolytes", "TSH"],
    recommended_medications: ["Adenosine", "Verapamil"],
    guideline_reference: "AHA SVT 2015",
    danger_flag: false, organ_system: "cardiovascular",
    expected_iterations: 1,
  }),

  // Pulmonology
  makeCase("pulmonology", "common", "straightforward", "Community-Acquired Pneumonia", {
    chief_complaint: "Productive cough with fever for 5 days",
    symptoms: ["productive cough", "fever", "pleuritic chest pain", "dyspnea"],
    symptom_duration: "5 days",
    vitals: { temperature: 38.7, pulse: 95, bp_systolic: 115, bp_diastolic: 70, spo2: 93, respiratory_rate: 22 },
  }, {
    gold_standard_diagnosis: "Pneumonia",
    alternative_plausible_diagnoses: ["Bronchitis", "Tuberculosis", "Lung Abscess"],
    recommended_tests: ["Chest X-ray", "CBC", "Blood Culture", "Sputum Culture"],
    recommended_medications: ["Amoxicillin", "Azithromycin"],
    guideline_reference: "ATS/IDSA CAP 2019",
    danger_flag: false, organ_system: "respiratory",
    expected_iterations: 1,
  }),

  makeCase("pulmonology", "common", "straightforward", "Acute Asthma Exacerbation", {
    chief_complaint: "Wheezing and shortness of breath for 4 hours",
    symptoms: ["wheezing", "dyspnea", "chest tightness", "cough"],
    symptom_duration: "4 hours",
    vitals: { pulse: 105, bp_systolic: 130, bp_diastolic: 80, spo2: 91, respiratory_rate: 28 },
    medical_history: ["Asthma"],
  }, {
    gold_standard_diagnosis: "Asthma Exacerbation",
    alternative_plausible_diagnoses: ["COPD Exacerbation", "Pneumonia", "Anaphylaxis"],
    recommended_tests: ["Peak Flow", "Chest X-ray", "ABG"],
    recommended_medications: ["Salbutamol", "Ipratropium", "Prednisolone"],
    guideline_reference: "GINA 2023",
    danger_flag: false, organ_system: "respiratory",
    expected_iterations: 1,
  }),

  // Neurology
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
    danger_flag: false, organ_system: "neurological",
    expected_iterations: 1,
  }),

  // Gastroenterology
  makeCase("gastroenterology", "common", "straightforward", "Acute Gastroenteritis", {
    chief_complaint: "Watery diarrhea and vomiting for 2 days",
    symptoms: ["watery diarrhea", "vomiting", "abdominal cramps", "nausea"],
    symptom_duration: "2 days",
    vitals: { temperature: 37.5, pulse: 92, bp_systolic: 105, bp_diastolic: 65, spo2: 98 },
  }, {
    gold_standard_diagnosis: "Gastroenteritis",
    alternative_plausible_diagnoses: ["Food Poisoning", "IBD Flare", "C. difficile"],
    recommended_tests: ["Stool Culture", "BMP", "CBC"],
    recommended_medications: ["Ondansetron", "ORS"],
    guideline_reference: "ACG Gastroenteritis 2016",
    danger_flag: false, organ_system: "gastrointestinal",
    expected_iterations: 1,
  }),

  makeCase("gastroenterology", "common", "straightforward", "GERD", {
    chief_complaint: "Heartburn and acid reflux after meals for 3 weeks",
    symptoms: ["heartburn", "acid regurgitation", "epigastric discomfort"],
    symptom_duration: "3 weeks",
    vitals: { bp_systolic: 125, bp_diastolic: 78, pulse: 72, spo2: 99 },
  }, {
    gold_standard_diagnosis: "GERD",
    alternative_plausible_diagnoses: ["Peptic Ulcer Disease", "Esophagitis", "Functional Dyspepsia"],
    recommended_tests: ["Upper Endoscopy", "H. pylori Test"],
    recommended_medications: ["Omeprazole", "Antacids"],
    guideline_reference: "ACG GERD 2022",
    danger_flag: false, organ_system: "gastrointestinal",
    expected_iterations: 1,
  }),

  // Endocrinology
  makeCase("endocrinology", "common", "straightforward", "Type 2 Diabetes - New Diagnosis", {
    chief_complaint: "Increased thirst, frequent urination, and fatigue for 1 month",
    symptoms: ["polydipsia", "polyuria", "fatigue", "blurred vision"],
    symptom_duration: "1 month",
    vitals: { bp_systolic: 140, bp_diastolic: 88, pulse: 80, spo2: 98 },
    risk_factors: ["obesity", "family history of diabetes", "sedentary lifestyle"],
  }, {
    gold_standard_diagnosis: "Type 2 Diabetes Mellitus",
    alternative_plausible_diagnoses: ["Diabetes Insipidus", "UTI", "Hyperthyroidism"],
    recommended_tests: ["Fasting Blood Glucose", "HbA1c", "BMP", "Urinalysis"],
    recommended_medications: ["Metformin"],
    guideline_reference: "ADA Standards 2024",
    danger_flag: false, organ_system: "endocrine",
    expected_iterations: 1,
  }),

  // Infectious Disease
  makeCase("infectious_disease", "common", "straightforward", "Uncomplicated UTI", {
    chief_complaint: "Painful urination and frequency for 3 days",
    symptoms: ["dysuria", "urinary frequency", "urgency", "suprapubic pain"],
    symptom_duration: "3 days",
    vitals: { temperature: 37.2, pulse: 78, bp_systolic: 118, bp_diastolic: 72, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Urinary Tract Infection",
    alternative_plausible_diagnoses: ["Vaginitis", "Interstitial Cystitis", "STI"],
    recommended_tests: ["Urinalysis", "Urine Culture"],
    recommended_medications: ["Nitrofurantoin", "Trimethoprim-Sulfamethoxazole"],
    guideline_reference: "IDSA UTI 2011",
    danger_flag: false, organ_system: "genitourinary",
    expected_iterations: 1,
  }),

  // Pediatrics
  makeCase("pediatrics", "common", "straightforward", "Acute Otitis Media", {
    chief_complaint: "Ear pain and fever in 3-year-old child",
    symptoms: ["ear pain", "fever", "irritability", "ear tugging"],
    symptom_duration: "2 days",
    vitals: { temperature: 38.5, pulse: 120, spo2: 98 },
    risk_factors: ["daycare attendance", "age < 5"],
  }, {
    gold_standard_diagnosis: "Acute Otitis Media",
    alternative_plausible_diagnoses: ["Otitis Externa", "Teething", "Pharyngitis"],
    recommended_tests: ["Otoscopy", "Tympanometry"],
    recommended_medications: ["Amoxicillin", "Ibuprofen"],
    guideline_reference: "AAP AOM 2013",
    danger_flag: false, organ_system: "ENT",
    expected_iterations: 1,
  }),
];

// ═══════════════════════════════════════════════════════
// CATEGORY 2 — AMBIGUOUS (requires hypothesis testing)
// ═══════════════════════════════════════════════════════

const AMBIGUOUS: BenchmarkCaseV7[] = [
  // Emergency Medicine — Chest Pain Differential
  makeCase("emergency_medicine", "complex", "ambiguous", "Chest Pain — MI vs PE vs Pericarditis", {
    chief_complaint: "Acute chest pain radiating to left arm, worsened by deep breathing",
    symptoms: ["chest pain", "left arm pain", "pleuritic component", "dyspnea"],
    symptom_duration: "2 hours",
    associated_symptoms: ["diaphoresis", "anxiety", "tachycardia"],
    vitals: { bp_systolic: 150, bp_diastolic: 92, pulse: 108, spo2: 93 },
    risk_factors: ["smoking", "recent surgery"],
  }, {
    gold_standard_diagnosis: "Acute Myocardial Infarction",
    alternative_plausible_diagnoses: ["Pulmonary Embolism", "Pericarditis", "Aortic Dissection"],
    recommended_tests: ["ECG", "Troponin", "D-dimer", "Chest X-ray", "CT Angiography"],
    recommended_medications: ["Aspirin", "Heparin", "Nitroglycerin", "Clopidogrel"],
    guideline_reference: "AHA ACS 2023",
    danger_flag: true, organ_system: "cardiovascular",
    expected_iterations: 2,
    common_misdiagnosis: "Pericarditis",
  }, ["emergency", "must_not_miss", "ambiguous_chest_pain"]),

  // Emergency — Abdominal Pain Differential
  makeCase("emergency_medicine", "complex", "ambiguous", "Abdominal Pain — Appendicitis vs Pancreatitis vs Gastroenteritis", {
    chief_complaint: "Diffuse abdominal pain migrating to right side, with nausea",
    symptoms: ["abdominal pain", "nausea", "anorexia", "low-grade fever"],
    symptom_duration: "18 hours",
    associated_symptoms: ["vomiting", "diarrhea"],
    vitals: { temperature: 37.9, pulse: 95, bp_systolic: 118, bp_diastolic: 72, spo2: 98 },
    risk_factors: ["alcohol use"],
  }, {
    gold_standard_diagnosis: "Appendicitis",
    alternative_plausible_diagnoses: ["Acute Pancreatitis", "Gastroenteritis", "Mesenteric Lymphadenitis"],
    recommended_tests: ["CBC", "CRP", "Lipase", "CT Abdomen", "Urinalysis"],
    recommended_medications: ["Ceftriaxone", "Metronidazole"],
    guideline_reference: "WSES 2020",
    danger_flag: true, organ_system: "gastrointestinal",
    expected_iterations: 2,
  }, ["emergency", "must_not_miss", "ambiguous_abdomen"]),

  // Emergency — Dyspnea
  makeCase("emergency_medicine", "moderate", "ambiguous", "Acute Dyspnea — Heart Failure vs Pneumonia", {
    chief_complaint: "Progressive shortness of breath and orthopnea for 3 days",
    symptoms: ["dyspnea", "orthopnea", "bilateral leg edema", "productive cough"],
    symptom_duration: "3 days",
    vitals: { bp_systolic: 155, bp_diastolic: 90, pulse: 100, spo2: 89, respiratory_rate: 26 },
    medical_history: ["Hypertension", "Diabetes"],
  }, {
    gold_standard_diagnosis: "Acute Decompensated Heart Failure",
    alternative_plausible_diagnoses: ["Pneumonia", "COPD Exacerbation", "Pulmonary Embolism"],
    recommended_tests: ["BNP", "Chest X-ray", "Echocardiogram", "CBC"],
    recommended_medications: ["Furosemide", "Oxygen", "Nitroglycerin"],
    guideline_reference: "AHA/ACC HF 2022",
    danger_flag: false, organ_system: "cardiovascular",
    expected_iterations: 2,
  }, ["ambiguous_dyspnea"]),

  // Emergency — Syncope
  makeCase("emergency_medicine", "moderate", "ambiguous", "Syncope — Cardiac vs Vasovagal vs Neurological", {
    chief_complaint: "Loss of consciousness while standing",
    symptoms: ["syncope", "palpitations before fainting", "brief loss of consciousness"],
    symptom_duration: "single episode",
    associated_symptoms: ["chest discomfort", "diaphoresis", "pallor"],
    vitals: { bp_systolic: 95, bp_diastolic: 58, pulse: 52, spo2: 98 },
    medical_history: ["Heart murmur"],
  }, {
    gold_standard_diagnosis: "Cardiac Syncope",
    alternative_plausible_diagnoses: ["Vasovagal Syncope", "Orthostatic Hypotension", "Seizure"],
    recommended_tests: ["ECG", "Echocardiogram", "Holter Monitor", "Blood Glucose", "CBC"],
    recommended_medications: ["Pacemaker evaluation"],
    guideline_reference: "ESC Syncope 2018",
    danger_flag: true, organ_system: "cardiovascular",
    expected_iterations: 2,
  }, ["emergency", "ambiguous_syncope"]),

  // Cardiology
  makeCase("cardiology", "moderate", "ambiguous", "Atrial Fibrillation vs Flutter vs SVT", {
    chief_complaint: "Irregular rapid heartbeat with dizziness for 3 hours",
    symptoms: ["palpitations", "irregular heartbeat", "dizziness", "chest discomfort"],
    symptom_duration: "3 hours",
    vitals: { bp_systolic: 138, bp_diastolic: 85, pulse: 148, spo2: 95 },
    medical_history: ["Hypertension"],
    risk_factors: ["alcohol use", "age > 60"],
  }, {
    gold_standard_diagnosis: "Atrial Fibrillation",
    alternative_plausible_diagnoses: ["Atrial Flutter", "SVT", "Thyrotoxicosis"],
    recommended_tests: ["ECG", "TSH", "Echocardiogram", "BMP"],
    recommended_medications: ["Metoprolol", "Diltiazem", "Apixaban"],
    guideline_reference: "AHA AF 2023",
    danger_flag: false, organ_system: "cardiovascular",
    expected_iterations: 2,
  }, ["arrhythmia"]),

  makeCase("cardiology", "complex", "ambiguous", "Pericarditis vs MI — Sharp Chest Pain", {
    chief_complaint: "Sharp chest pain worse when lying down, improved leaning forward",
    symptoms: ["sharp chest pain", "pleuritic pain", "positional pain", "low-grade fever"],
    symptom_duration: "2 days",
    associated_symptoms: ["pericardial friction rub", "malaise"],
    vitals: { temperature: 37.8, pulse: 88, bp_systolic: 120, bp_diastolic: 74, spo2: 98 },
    medical_history: ["Recent viral illness"],
  }, {
    gold_standard_diagnosis: "Acute Pericarditis",
    alternative_plausible_diagnoses: ["Myocardial Infarction", "Pleuritis", "Costochondritis"],
    recommended_tests: ["ECG", "Troponin", "Echocardiogram", "CRP", "ESR"],
    recommended_medications: ["Ibuprofen", "Colchicine"],
    guideline_reference: "ESC Pericardial Disease 2015",
    danger_flag: false, organ_system: "cardiovascular",
    expected_iterations: 2,
  }, ["ambiguous_chest"]),

  // Pulmonology
  makeCase("pulmonology", "moderate", "ambiguous", "COPD Exacerbation vs Pneumonia vs CHF", {
    chief_complaint: "Worsening dyspnea and increased sputum for 4 days",
    symptoms: ["dyspnea", "increased sputum production", "wheezing", "cough"],
    symptom_duration: "4 days",
    vitals: { temperature: 37.6, pulse: 100, bp_systolic: 140, bp_diastolic: 85, spo2: 87, respiratory_rate: 26 },
    medical_history: ["COPD", "Smoking 40 pack-years"],
  }, {
    gold_standard_diagnosis: "COPD Exacerbation",
    alternative_plausible_diagnoses: ["Pneumonia", "Heart Failure", "Pulmonary Embolism"],
    recommended_tests: ["Chest X-ray", "ABG", "CBC", "BNP", "Sputum Culture"],
    recommended_medications: ["Salbutamol", "Ipratropium", "Prednisolone", "Antibiotics"],
    guideline_reference: "GOLD 2024",
    danger_flag: false, organ_system: "respiratory",
    expected_iterations: 2,
  }),

  makeCase("pulmonology", "complex", "ambiguous", "Pleural Effusion — Malignant vs Infectious vs CHF", {
    chief_complaint: "Progressive dyspnea with dull chest pain for 2 weeks",
    symptoms: ["progressive dyspnea", "dull chest pain", "decreased breath sounds"],
    symptom_duration: "2 weeks",
    associated_symptoms: ["weight loss", "night sweats"],
    vitals: { pulse: 92, bp_systolic: 110, bp_diastolic: 68, spo2: 91, respiratory_rate: 24 },
    medical_history: ["Smoking history"],
  }, {
    gold_standard_diagnosis: "Malignant Pleural Effusion",
    alternative_plausible_diagnoses: ["Parapneumonic Effusion", "Heart Failure", "Tuberculosis"],
    recommended_tests: ["Chest X-ray", "CT Chest", "Thoracentesis", "Pleural Fluid Analysis"],
    recommended_medications: ["Pleurodesis consideration"],
    guideline_reference: "BTS Pleural Disease 2023",
    danger_flag: false, organ_system: "respiratory",
    expected_iterations: 2,
  }),

  // Neurology
  makeCase("neurology", "moderate", "ambiguous", "Headache — Tension vs Migraine vs Secondary", {
    chief_complaint: "Bilateral headache with neck stiffness for 1 week",
    symptoms: ["bilateral headache", "neck stiffness", "pressure-type pain"],
    symptom_duration: "1 week",
    associated_symptoms: ["fatigue", "difficulty concentrating", "mild photophobia"],
    vitals: { bp_systolic: 135, bp_diastolic: 85, pulse: 72, spo2: 99, temperature: 37.0 },
  }, {
    gold_standard_diagnosis: "Tension-Type Headache",
    alternative_plausible_diagnoses: ["Migraine", "Cervicogenic Headache", "Meningitis"],
    recommended_tests: ["Neurological Exam", "CT Head"],
    recommended_medications: ["Acetaminophen", "Ibuprofen", "Amitriptyline"],
    guideline_reference: "IHS ICHD-3",
    danger_flag: false, organ_system: "neurological",
    expected_iterations: 2,
  }),

  makeCase("neurology", "complex", "ambiguous", "Seizure — Epilepsy vs Syncope vs Pseudoseizure", {
    chief_complaint: "Witnessed generalized tonic-clonic movements with loss of consciousness",
    symptoms: ["witnessed seizure", "loss of consciousness", "postictal confusion"],
    symptom_duration: "3 minutes",
    associated_symptoms: ["tongue biting", "urinary incontinence", "post-event fatigue"],
    vitals: { bp_systolic: 145, bp_diastolic: 90, pulse: 105, spo2: 96 },
  }, {
    gold_standard_diagnosis: "Epileptic Seizure",
    alternative_plausible_diagnoses: ["Convulsive Syncope", "Psychogenic Non-Epileptic Seizure", "Hypoglycemia"],
    recommended_tests: ["EEG", "Blood Glucose", "BMP", "CT Head", "Prolactin"],
    recommended_medications: ["Levetiracetam", "Lorazepam"],
    guideline_reference: "AAN Epilepsy 2018",
    danger_flag: true, organ_system: "neurological",
    expected_iterations: 2,
  }, ["ambiguous_neuro"]),

  // Gastroenterology
  makeCase("gastroenterology", "moderate", "ambiguous", "Epigastric Pain — PUD vs Pancreatitis vs Cholecystitis", {
    chief_complaint: "Severe epigastric pain radiating to back after heavy meal",
    symptoms: ["epigastric pain", "back pain", "nausea", "vomiting"],
    symptom_duration: "8 hours",
    associated_symptoms: ["anorexia", "tenderness"],
    vitals: { temperature: 37.6, pulse: 98, bp_systolic: 125, bp_diastolic: 78, spo2: 98 },
    risk_factors: ["alcohol use", "gallstones"],
  }, {
    gold_standard_diagnosis: "Acute Pancreatitis",
    alternative_plausible_diagnoses: ["Peptic Ulcer Disease", "Cholecystitis", "Gastritis"],
    recommended_tests: ["Lipase", "Amylase", "LFTs", "Abdominal Ultrasound", "CT Abdomen"],
    recommended_medications: ["IV Fluids", "Ondansetron", "Acetaminophen"],
    guideline_reference: "ACG Pancreatitis 2013",
    danger_flag: false, organ_system: "gastrointestinal",
    expected_iterations: 2,
  }),

  makeCase("gastroenterology", "complex", "ambiguous", "RUQ Pain — Cholecystitis vs Choledocholithiasis vs Hepatitis", {
    chief_complaint: "Right upper quadrant pain with fever and jaundice",
    symptoms: ["right upper quadrant pain", "fever", "jaundice", "nausea"],
    symptom_duration: "2 days",
    associated_symptoms: ["dark urine", "clay-colored stools"],
    vitals: { temperature: 38.5, pulse: 100, bp_systolic: 115, bp_diastolic: 70, spo2: 97 },
  }, {
    gold_standard_diagnosis: "Ascending Cholangitis",
    alternative_plausible_diagnoses: ["Cholecystitis", "Choledocholithiasis", "Hepatitis"],
    recommended_tests: ["LFTs", "CBC", "Blood Culture", "Abdominal Ultrasound", "MRCP"],
    recommended_medications: ["Piperacillin-Tazobactam", "IV Fluids"],
    guideline_reference: "Tokyo Guidelines 2018",
    danger_flag: true, organ_system: "gastrointestinal",
    expected_iterations: 2,
  }, ["emergency", "charcot_triad"]),

  // Endocrinology
  makeCase("endocrinology", "moderate", "ambiguous", "Thyroid Storm vs Panic Attack vs Pheochromocytoma", {
    chief_complaint: "Acute palpitations, tremor, and agitation",
    symptoms: ["palpitations", "tremor", "agitation", "diaphoresis", "heat intolerance"],
    symptom_duration: "6 hours",
    vitals: { temperature: 38.8, pulse: 140, bp_systolic: 170, bp_diastolic: 95, spo2: 97 },
    medical_history: ["Graves' disease — stopped medications 2 weeks ago"],
  }, {
    gold_standard_diagnosis: "Thyroid Storm",
    alternative_plausible_diagnoses: ["Panic Attack", "Pheochromocytoma", "Stimulant Toxicity"],
    recommended_tests: ["TSH", "Free T4", "Free T3", "BMP", "ECG"],
    recommended_medications: ["Propranolol", "Methimazole", "Hydrocortisone", "Lugol's Iodine"],
    guideline_reference: "ATA Thyrotoxicosis 2016",
    danger_flag: true, organ_system: "endocrine",
    expected_iterations: 2,
  }, ["emergency", "endocrine_emergency"]),

  // Infectious Disease
  makeCase("infectious_disease", "moderate", "ambiguous", "Fever of Unknown Origin — TB vs Lymphoma vs Endocarditis", {
    chief_complaint: "Persistent fever, night sweats, and weight loss for 3 weeks",
    symptoms: ["persistent fever", "night sweats", "weight loss", "fatigue"],
    symptom_duration: "3 weeks",
    associated_symptoms: ["anorexia", "malaise"],
    vitals: { temperature: 38.3, pulse: 88, bp_systolic: 120, bp_diastolic: 72, spo2: 97 },
  }, {
    gold_standard_diagnosis: "Tuberculosis",
    alternative_plausible_diagnoses: ["Lymphoma", "Infective Endocarditis", "HIV"],
    recommended_tests: ["Blood Culture", "Chest X-ray", "Tuberculin Test", "CBC", "ESR", "CT Chest"],
    recommended_medications: ["Isoniazid", "Rifampin", "Pyrazinamide", "Ethambutol"],
    guideline_reference: "WHO TB 2022",
    danger_flag: false, organ_system: "systemic",
    expected_iterations: 2,
  }),

  makeCase("infectious_disease", "complex", "ambiguous", "Tropical Fever — Dengue vs Malaria vs Typhoid", {
    chief_complaint: "High fever, body aches, and rash for 5 days after travel",
    symptoms: ["high fever", "severe body aches", "maculopapular rash", "headache"],
    symptom_duration: "5 days",
    associated_symptoms: ["retro-orbital pain", "petechiae"],
    vitals: { temperature: 39.2, pulse: 100, bp_systolic: 100, bp_diastolic: 60, spo2: 97 },
    risk_factors: ["recent travel to endemic area"],
  }, {
    gold_standard_diagnosis: "Dengue Fever",
    alternative_plausible_diagnoses: ["Malaria", "Typhoid Fever", "Chikungunya"],
    recommended_tests: ["Dengue NS1 Antigen", "CBC", "Blood Smear", "Widal Test", "LFTs"],
    recommended_medications: ["Supportive care", "Acetaminophen", "IV Fluids"],
    guideline_reference: "WHO Dengue 2009",
    danger_flag: true, organ_system: "systemic",
    expected_iterations: 2,
  }, ["tropical", "travel"]),

  // Nephrology
  makeCase("nephrology", "moderate", "ambiguous", "Acute Kidney Injury — Pre-renal vs Intrinsic vs Post-renal", {
    chief_complaint: "Decreased urine output and rising creatinine",
    symptoms: ["oliguria", "fatigue", "nausea", "peripheral edema"],
    symptom_duration: "3 days",
    vitals: { bp_systolic: 100, bp_diastolic: 60, pulse: 105, spo2: 96 },
    medical_history: ["Diabetes", "Hypertension"],
    medications: ["NSAIDs", "Metformin"],
  }, {
    gold_standard_diagnosis: "Acute Kidney Injury",
    alternative_plausible_diagnoses: ["Pre-renal AKI", "ATN", "Obstructive Uropathy"],
    recommended_tests: ["BMP", "Urinalysis", "Renal Ultrasound", "FENa", "CBC"],
    recommended_medications: ["IV Fluids", "Stop NSAIDs"],
    guideline_reference: "KDIGO AKI 2012",
    danger_flag: true, organ_system: "renal",
    expected_iterations: 2,
  }, ["nephrology"]),

  // Pediatrics
  makeCase("pediatrics", "moderate", "ambiguous", "Pediatric Fever — Kawasaki vs Scarlet Fever vs Viral", {
    chief_complaint: "Persistent high fever for 5 days in 4-year-old with rash and conjunctivitis",
    symptoms: ["persistent fever", "rash", "bilateral conjunctivitis", "cracked lips"],
    symptom_duration: "5 days",
    associated_symptoms: ["cervical lymphadenopathy", "irritability", "hand edema"],
    vitals: { temperature: 39.5, pulse: 130, spo2: 98 },
  }, {
    gold_standard_diagnosis: "Kawasaki Disease",
    alternative_plausible_diagnoses: ["Scarlet Fever", "Viral Exanthem", "Stevens-Johnson Syndrome"],
    recommended_tests: ["CBC", "CRP", "ESR", "Echocardiogram", "LFTs", "Urinalysis"],
    recommended_medications: ["IVIG", "Aspirin"],
    guideline_reference: "AHA Kawasaki 2017",
    danger_flag: true, organ_system: "systemic",
    expected_iterations: 2,
  }, ["pediatric", "must_not_miss"]),
];

// ═══════════════════════════════════════════════════════
// CATEGORY 3 — DECEPTIVE (requires physiology reasoning)
// ═══════════════════════════════════════════════════════

const DECEPTIVE: BenchmarkCaseV7[] = [
  // Emergency Medicine
  makeCase("emergency_medicine", "complex", "deceptive", "Stroke Mimic — Hypoglycemia", {
    chief_complaint: "Sudden confusion, slurred speech, and left-sided weakness",
    symptoms: ["confusion", "slurred speech", "left-sided weakness", "diaphoresis"],
    symptom_duration: "30 minutes",
    vitals: { bp_systolic: 160, bp_diastolic: 95, pulse: 110, spo2: 97 },
    medical_history: ["Diabetes", "Insulin-dependent"],
    medications: ["Insulin Glargine", "Insulin Aspart"],
  }, {
    gold_standard_diagnosis: "Hypoglycemia",
    alternative_plausible_diagnoses: ["Ischemic Stroke", "TIA", "Seizure"],
    recommended_tests: ["Blood Glucose", "CT Head", "ECG", "BMP"],
    recommended_medications: ["Dextrose 50%", "Glucagon"],
    guideline_reference: "ADA Hypoglycemia 2023",
    danger_flag: true, organ_system: "endocrine",
    expected_iterations: 2,
    common_misdiagnosis: "Ischemic Stroke",
  }, ["deceptive", "mimic", "must_not_miss"]),

  makeCase("emergency_medicine", "complex", "deceptive", "Sepsis Masquerading as Influenza", {
    chief_complaint: "Fever, body aches, fatigue, and malaise for 3 days",
    symptoms: ["high fever", "body aches", "fatigue", "malaise", "tachycardia"],
    symptom_duration: "3 days",
    associated_symptoms: ["mild confusion", "decreased urine output"],
    vitals: { temperature: 39.5, bp_systolic: 88, bp_diastolic: 55, pulse: 125, spo2: 92, respiratory_rate: 24 },
  }, {
    gold_standard_diagnosis: "Sepsis",
    alternative_plausible_diagnoses: ["Influenza", "Viral Syndrome", "COVID-19"],
    recommended_tests: ["Blood Culture", "Lactate", "CBC", "Procalcitonin", "BMP", "Urinalysis"],
    recommended_medications: ["Broad-spectrum Antibiotics", "IV Fluids", "Vasopressors"],
    guideline_reference: "Surviving Sepsis 2021",
    danger_flag: true, organ_system: "systemic",
    expected_iterations: 2,
    common_misdiagnosis: "Influenza",
  }, ["deceptive", "must_not_miss", "sepsis"]),

  makeCase("emergency_medicine", "complex", "deceptive", "SAH Presenting as Migraine", {
    chief_complaint: "Worst headache of my life, sudden onset",
    symptoms: ["thunderclap headache", "neck stiffness", "photophobia"],
    symptom_duration: "2 hours",
    associated_symptoms: ["nausea", "vomiting", "brief loss of consciousness"],
    vitals: { bp_systolic: 185, bp_diastolic: 105, pulse: 88, spo2: 98 },
    medical_history: ["Migraine", "Hypertension"],
  }, {
    gold_standard_diagnosis: "Subarachnoid Hemorrhage",
    alternative_plausible_diagnoses: ["Migraine", "Meningitis", "Hypertensive Emergency"],
    recommended_tests: ["CT Head", "Lumbar Puncture", "CT Angiography"],
    recommended_medications: ["Nimodipine", "Pain Control", "Antihypertensives"],
    guideline_reference: "AHA SAH 2023",
    danger_flag: true, organ_system: "neurological",
    expected_iterations: 2,
    common_misdiagnosis: "Migraine",
  }, ["deceptive", "must_not_miss", "thunderclap"]),

  makeCase("emergency_medicine", "complex", "deceptive", "Tension Pneumothorax vs Asthma", {
    chief_complaint: "Severe shortness of breath with unilateral decreased breath sounds",
    symptoms: ["severe dyspnea", "pleuritic chest pain", "unilateral decreased breath sounds"],
    symptom_duration: "1 hour",
    associated_symptoms: ["tracheal deviation", "hypotension", "distended neck veins"],
    vitals: { bp_systolic: 80, bp_diastolic: 50, pulse: 130, spo2: 82, respiratory_rate: 32 },
    medical_history: ["Asthma", "Tall thin habitus"],
  }, {
    gold_standard_diagnosis: "Tension Pneumothorax",
    alternative_plausible_diagnoses: ["Severe Asthma Exacerbation", "Massive PE", "Cardiac Tamponade"],
    recommended_tests: ["Chest X-ray", "Clinical Diagnosis"],
    recommended_medications: ["Needle Decompression", "Chest Tube"],
    guideline_reference: "ATLS 2018",
    danger_flag: true, organ_system: "respiratory",
    expected_iterations: 2,
    common_misdiagnosis: "Asthma Exacerbation",
  }, ["deceptive", "must_not_miss"]),

  // Cardiology
  makeCase("cardiology", "complex", "deceptive", "Aortic Dissection Mimicking STEMI", {
    chief_complaint: "Severe tearing chest pain radiating to back with ST changes on ECG",
    symptoms: ["severe chest pain", "tearing back pain", "diaphoresis"],
    symptom_duration: "45 minutes",
    associated_symptoms: ["unequal arm blood pressures", "new aortic regurgitation murmur"],
    vitals: { bp_systolic: 185, bp_diastolic: 110, pulse: 105, spo2: 94 },
    medical_history: ["Hypertension", "Marfan Syndrome"],
  }, {
    gold_standard_diagnosis: "Aortic Dissection",
    alternative_plausible_diagnoses: ["Acute STEMI", "Pulmonary Embolism", "Esophageal Rupture"],
    recommended_tests: ["CT Angiography", "Chest X-ray", "ECG", "Troponin"],
    recommended_medications: ["Esmolol", "Labetalol", "Morphine"],
    guideline_reference: "AHA Aortic Disease 2022",
    danger_flag: true, organ_system: "cardiovascular",
    expected_iterations: 2,
    common_misdiagnosis: "Acute STEMI",
  }, ["deceptive", "must_not_miss"]),

  makeCase("cardiology", "complex", "deceptive", "Takotsubo Mimicking MI", {
    chief_complaint: "Chest pain after severe emotional stress with ECG changes",
    symptoms: ["chest pain", "dyspnea", "ST elevation on ECG"],
    symptom_duration: "3 hours",
    associated_symptoms: ["diaphoresis", "anxiety"],
    vitals: { bp_systolic: 100, bp_diastolic: 65, pulse: 95, spo2: 95 },
    medical_history: ["Recent bereavement"],
    risk_factors: ["postmenopausal female", "emotional stress"],
  }, {
    gold_standard_diagnosis: "Takotsubo Cardiomyopathy",
    alternative_plausible_diagnoses: ["Acute STEMI", "Myocarditis", "Pulmonary Embolism"],
    recommended_tests: ["ECG", "Troponin", "Echocardiogram", "Coronary Angiography"],
    recommended_medications: ["Beta-blocker", "ACE Inhibitor", "Supportive care"],
    guideline_reference: "ESC Takotsubo 2018",
    danger_flag: false, organ_system: "cardiovascular",
    expected_iterations: 2,
    common_misdiagnosis: "Acute STEMI",
  }, ["deceptive", "stress_cardiomyopathy"]),

  // Neurology
  makeCase("neurology", "complex", "deceptive", "Guillain-Barré Presenting as Back Pain", {
    chief_complaint: "Progressive ascending weakness with back pain",
    symptoms: ["ascending weakness", "back pain", "areflexia", "paresthesia"],
    symptom_duration: "4 days",
    associated_symptoms: ["difficulty walking", "bilateral weakness"],
    vitals: { bp_systolic: 130, bp_diastolic: 80, pulse: 82, spo2: 96, respiratory_rate: 20 },
    medical_history: ["Recent gastroenteritis 2 weeks ago"],
  }, {
    gold_standard_diagnosis: "Guillain-Barré Syndrome",
    alternative_plausible_diagnoses: ["Spinal Cord Compression", "Transverse Myelitis", "Myasthenia Gravis"],
    recommended_tests: ["Lumbar Puncture", "Nerve Conduction Study", "MRI Spine", "FVC"],
    recommended_medications: ["IVIG", "Plasmapheresis"],
    guideline_reference: "AAN GBS 2012",
    danger_flag: true, organ_system: "neurological",
    expected_iterations: 2,
    common_misdiagnosis: "Spinal Cord Compression",
  }, ["deceptive", "ascending_weakness"]),

  makeCase("neurology", "complex", "deceptive", "Meningitis Presenting as Severe Migraine", {
    chief_complaint: "Severe headache with fever and neck stiffness",
    symptoms: ["severe headache", "high fever", "neck stiffness", "photophobia"],
    symptom_duration: "12 hours",
    associated_symptoms: ["confusion", "petechial rash", "vomiting"],
    vitals: { temperature: 39.8, pulse: 115, bp_systolic: 90, bp_diastolic: 55, spo2: 95 },
  }, {
    gold_standard_diagnosis: "Bacterial Meningitis",
    alternative_plausible_diagnoses: ["Migraine", "Viral Meningitis", "Encephalitis"],
    recommended_tests: ["Lumbar Puncture", "Blood Culture", "CT Head", "CBC", "Procalcitonin"],
    recommended_medications: ["Ceftriaxone", "Vancomycin", "Dexamethasone"],
    guideline_reference: "IDSA Meningitis 2017",
    danger_flag: true, organ_system: "neurological",
    expected_iterations: 2,
    common_misdiagnosis: "Migraine",
  }, ["deceptive", "must_not_miss"]),

  // Endocrinology
  makeCase("endocrinology", "complex", "deceptive", "DKA Presenting as Acute Abdomen", {
    chief_complaint: "Severe abdominal pain with vomiting and rapid breathing",
    symptoms: ["severe abdominal pain", "vomiting", "Kussmaul breathing", "dehydration"],
    symptom_duration: "1 day",
    associated_symptoms: ["fruity breath", "altered consciousness", "polyuria"],
    vitals: { temperature: 37.0, bp_systolic: 90, bp_diastolic: 55, pulse: 120, spo2: 97, respiratory_rate: 30 },
    medical_history: ["Type 1 Diabetes"],
  }, {
    gold_standard_diagnosis: "Diabetic Ketoacidosis",
    alternative_plausible_diagnoses: ["Appendicitis", "Pancreatitis", "Bowel Obstruction"],
    recommended_tests: ["Blood Glucose", "ABG", "BMP", "Serum Ketones", "CBC", "Lipase"],
    recommended_medications: ["Insulin Infusion", "IV Fluids", "Potassium Replacement"],
    guideline_reference: "ADA DKA 2023",
    danger_flag: true, organ_system: "endocrine",
    expected_iterations: 2,
    common_misdiagnosis: "Appendicitis",
  }, ["deceptive", "must_not_miss", "metabolic_mimic"]),

  // Nephrology
  makeCase("nephrology", "complex", "deceptive", "Rhabdomyolysis Causing AKI", {
    chief_complaint: "Dark urine and muscle pain after intense exercise",
    symptoms: ["dark urine", "severe muscle pain", "weakness", "decreased urine output"],
    symptom_duration: "2 days",
    associated_symptoms: ["muscle swelling", "nausea"],
    vitals: { pulse: 95, bp_systolic: 110, bp_diastolic: 65, spo2: 98, temperature: 37.2 },
    risk_factors: ["extreme exercise", "dehydration"],
  }, {
    gold_standard_diagnosis: "Rhabdomyolysis",
    alternative_plausible_diagnoses: ["AKI from Dehydration", "Glomerulonephritis", "Hemolytic Anemia"],
    recommended_tests: ["CK", "BMP", "Urinalysis", "Myoglobin", "CBC"],
    recommended_medications: ["Aggressive IV Fluids", "Bicarbonate"],
    guideline_reference: "KDIGO AKI 2012",
    danger_flag: true, organ_system: "renal",
    expected_iterations: 2,
    common_misdiagnosis: "Dehydration",
  }, ["deceptive", "renal"]),

  // Hematology
  makeCase("hematology", "complex", "deceptive", "TTP Presenting as Viral Illness", {
    chief_complaint: "Fever, confusion, petechiae, and renal impairment",
    symptoms: ["fever", "confusion", "petechiae", "fatigue", "purpura"],
    symptom_duration: "3 days",
    associated_symptoms: ["jaundice", "dark urine", "headache"],
    vitals: { temperature: 38.5, pulse: 105, bp_systolic: 135, bp_diastolic: 85, spo2: 97 },
  }, {
    gold_standard_diagnosis: "Thrombotic Thrombocytopenic Purpura",
    alternative_plausible_diagnoses: ["Viral Syndrome", "DIC", "HUS", "ITP"],
    recommended_tests: ["CBC with Smear", "ADAMTS13", "LDH", "Haptoglobin", "BMP", "Reticulocyte Count"],
    recommended_medications: ["Plasma Exchange", "Corticosteroids", "Caplacizumab"],
    guideline_reference: "ISTH TTP 2020",
    danger_flag: true, organ_system: "hematological",
    expected_iterations: 2,
    common_misdiagnosis: "Viral Syndrome",
  }, ["deceptive", "must_not_miss", "pentad"]),

  // Pediatrics
  makeCase("pediatrics", "complex", "deceptive", "Intussusception Mimicking Gastroenteritis", {
    chief_complaint: "Intermittent colicky abdominal pain with vomiting in 18-month-old",
    symptoms: ["intermittent abdominal pain", "vomiting", "lethargy", "drawing up legs"],
    symptom_duration: "8 hours",
    associated_symptoms: ["currant jelly stool", "abdominal mass"],
    vitals: { pulse: 140, temperature: 37.5, spo2: 98 },
  }, {
    gold_standard_diagnosis: "Intussusception",
    alternative_plausible_diagnoses: ["Gastroenteritis", "Constipation", "Volvulus"],
    recommended_tests: ["Abdominal Ultrasound", "Abdominal X-ray"],
    recommended_medications: ["Air Enema Reduction", "Surgical consultation"],
    guideline_reference: "ACR Appropriateness Criteria",
    danger_flag: true, organ_system: "gastrointestinal",
    expected_iterations: 2,
    common_misdiagnosis: "Gastroenteritis",
  }, ["deceptive", "pediatric", "must_not_miss"]),
];

// ── Export ──

export const BENCHMARK_CASES_V7: BenchmarkCaseV7[] = [
  ...STRAIGHTFORWARD,
  ...AMBIGUOUS,
  ...DECEPTIVE,
];

export function getCasesByCategory(category: ReasoningCategory): BenchmarkCaseV7[] {
  return BENCHMARK_CASES_V7.filter(c => c.reasoning_category === category);
}

export function getCaseDistributionV7() {
  const bySpecialty: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  for (const c of BENCHMARK_CASES_V7) {
    bySpecialty[c.specialty] = (bySpecialty[c.specialty] || 0) + 1;
    byCategory[c.reasoning_category] = (byCategory[c.reasoning_category] || 0) + 1;
    byDifficulty[c.difficulty] = (byDifficulty[c.difficulty] || 0) + 1;
  }
  return { total: BENCHMARK_CASES_V7.length, bySpecialty, byCategory, byDifficulty };
}
