/**
 * Benchmark v9 — 30 Controlled Clinical Scenarios
 *
 * Covers respiratory, GI, cardiac, neurological, infectious, metabolic,
 * and genitourinary systems. Mix of textbook, ambiguous, and overlapping cases.
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

// ═══════════════════════════════════════════════════════════════
// RESPIRATORY (4)
// ═══════════════════════════════════════════════════════════════

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
    expected_symptoms_normalized: ["fever", "productive cough", "dyspnea", "chest pain", "fatigue"],
    expected_physiology_states: ["pulmonary inflammation", "impaired gas exchange"],
    expected_organ_systems: ["respiratory"],
    recommended_tests: ["Chest X-ray", "CBC", "CRP", "Sputum Culture"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Pulmonary Embolism", "Myocardial Infarction"],
  },
};

const ASTHMA: BenchmarkCase = {
  id: "ctrl-asthma-002",
  name: "Asthma Exacerbation",
  description: "Acute asthma flare: dyspnea, wheezing, chest tightness, cough, nocturnal symptoms.",
  context: makeContext({
    visit_id: "bench-ctrl-asthma-002",
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
    expected_physiology_states: ["bronchospasm", "airway obstruction"],
    expected_organ_systems: ["respiratory"],
    recommended_tests: ["Peak Flow", "Chest X-ray", "ABG", "SpO2"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Pneumothorax"],
  },
};

const PE: BenchmarkCase = {
  id: "ctrl-pe-003",
  name: "Pulmonary Embolism",
  description: "Classic PE: sudden dyspnea, pleuritic chest pain, tachycardia, leg swelling, hypoxia.",
  context: makeContext({
    visit_id: "bench-ctrl-pe-003",
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

const COPD: BenchmarkCase = {
  id: "ctrl-copd-004",
  name: "COPD Exacerbation",
  description: "Acute COPD exacerbation with increased dyspnea, sputum, and wheezing.",
  context: makeContext({
    visit_id: "bench-ctrl-copd-004",
    chief_complaint: "Worsening breathlessness and increased sputum for 4 days",
    symptoms: ["shortness of breath", "productive cough", "wheezing", "chest tightness", "fatigue"],
    symptom_duration: "4 days",
    associated_symptoms: ["purulent sputum", "ankle swelling"],
    medical_history: ["COPD", "smoking"],
    vitals: { bp_systolic: 135, bp_diastolic: 85, pulse: 100, temperature: 37.8, spo2: 89, respiratory_rate: 26, weight_kg: 82, height_cm: 172 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "COPD Exacerbation",
    alternative_diagnoses: ["Pneumonia", "Heart Failure", "Asthma"],
    expected_symptoms_normalized: ["dyspnea", "productive cough", "wheezing", "chest tightness", "fatigue"],
    expected_physiology_states: ["airway obstruction", "impaired gas exchange"],
    expected_organ_systems: ["respiratory"],
    recommended_tests: ["Chest X-ray", "ABG", "CBC", "Sputum Culture"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Pneumonia", "Pulmonary Embolism"],
  },
};

// ═══════════════════════════════════════════════════════════════
// GASTROINTESTINAL (4)
// ═══════════════════════════════════════════════════════════════

const GASTROENTERITIS: BenchmarkCase = {
  id: "ctrl-gastroenteritis-005",
  name: "Acute Gastroenteritis",
  description: "Classic GI presentation: vomiting, diarrhea, abdominal pain, fever, nausea.",
  context: makeContext({
    visit_id: "bench-ctrl-gastro-005",
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

const APPENDICITIS: BenchmarkCase = {
  id: "ctrl-appendicitis-006",
  name: "Acute Appendicitis",
  description: "Classic surgical abdomen: RLQ pain, fever, nausea, vomiting, anorexia.",
  context: makeContext({
    visit_id: "bench-ctrl-appendicitis-006",
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
    expected_physiology_states: ["peritoneal inflammation"],
    expected_organ_systems: ["gastrointestinal"],
    recommended_tests: ["CBC", "CRP", "Abdominal Ultrasound", "CT Abdomen"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Appendicitis"],
  },
};

const PANCREATITIS: BenchmarkCase = {
  id: "ctrl-pancreatitis-007",
  name: "Acute Pancreatitis",
  description: "Epigastric pain radiating to back, nausea, vomiting, tenderness.",
  context: makeContext({
    visit_id: "bench-ctrl-pancreatitis-007",
    chief_complaint: "Severe epigastric pain radiating to back after heavy meal",
    symptoms: ["epigastric pain", "nausea", "vomiting", "abdominal tenderness", "back pain"],
    symptom_duration: "12 hours",
    associated_symptoms: ["bloating", "loss of appetite"],
    medical_history: ["gallstones", "alcohol use"],
    vitals: { bp_systolic: 115, bp_diastolic: 72, pulse: 105, temperature: 38.0, spo2: 97, respiratory_rate: 20, weight_kg: 88, height_cm: 174 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Pancreatitis",
    alternative_diagnoses: ["Peptic Ulcer Disease", "Cholecystitis", "Myocardial Infarction"],
    expected_symptoms_normalized: ["epigastric pain", "nausea", "vomiting", "abdominal tenderness", "back pain"],
    expected_physiology_states: ["pancreatic inflammation"],
    expected_organ_systems: ["gastrointestinal"],
    recommended_tests: ["Serum Lipase", "Amylase", "CBC", "Abdominal CT", "LFTs"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Pancreatitis"],
  },
};

const PEPTIC_ULCER: BenchmarkCase = {
  id: "ctrl-peptic-ulcer-008",
  name: "Peptic Ulcer Disease",
  description: "Burning epigastric pain relieved by food, bloating, nausea.",
  context: makeContext({
    visit_id: "bench-ctrl-peptic-ulcer-008",
    chief_complaint: "Burning stomach pain for 2 weeks, worse when hungry",
    symptoms: ["epigastric pain", "burning sensation", "nausea", "bloating", "loss of appetite"],
    symptom_duration: "2 weeks",
    associated_symptoms: ["heartburn", "early satiety"],
    medications: ["ibuprofen"],
    vitals: { bp_systolic: 122, bp_diastolic: 78, pulse: 82, temperature: 37.0, spo2: 98, respiratory_rate: 16, weight_kg: 70, height_cm: 170 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Peptic Ulcer Disease",
    alternative_diagnoses: ["GERD", "Gastritis", "Pancreatitis"],
    expected_symptoms_normalized: ["epigastric pain", "nausea", "bloating"],
    expected_physiology_states: ["gastric mucosal injury"],
    expected_organ_systems: ["gastrointestinal"],
    recommended_tests: ["H. pylori Test", "Upper GI Endoscopy", "CBC"],
    danger_flag: false,
  },
};

// ═══════════════════════════════════════════════════════════════
// CARDIAC (3)
// ═══════════════════════════════════════════════════════════════

const ACS: BenchmarkCase = {
  id: "ctrl-acs-009",
  name: "Acute Coronary Syndrome",
  description: "Classic ACS: chest pain, dyspnea, nausea, diaphoresis, left arm pain.",
  context: makeContext({
    visit_id: "bench-ctrl-acs-009",
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
    expected_physiology_states: ["myocardial ischemia"],
    expected_organ_systems: ["cardiovascular"],
    recommended_tests: ["ECG", "Troponin", "Chest X-ray", "CBC"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Myocardial Infarction", "Aortic Dissection", "Pulmonary Embolism"],
  },
};

const PERICARDITIS: BenchmarkCase = {
  id: "ctrl-pericarditis-010",
  name: "Pericarditis",
  description: "Sharp pleuritic chest pain worse lying down, improved sitting up, friction rub.",
  context: makeContext({
    visit_id: "bench-ctrl-pericarditis-010",
    chief_complaint: "Sharp chest pain worse when lying down, better sitting forward",
    symptoms: ["chest pain", "pleuritic pain", "fever", "shortness of breath", "fatigue"],
    symptom_duration: "2 days",
    associated_symptoms: ["pain worse with inspiration"],
    medical_history: ["recent viral illness"],
    vitals: { bp_systolic: 118, bp_diastolic: 76, pulse: 95, temperature: 38.2, spo2: 97, respiratory_rate: 20, weight_kg: 75, height_cm: 178 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Pericarditis",
    alternative_diagnoses: ["Myocardial Infarction", "Pleurisy", "Costochondritis"],
    expected_symptoms_normalized: ["chest pain", "pleuritic pain", "fever", "dyspnea", "fatigue"],
    expected_physiology_states: ["pericardial inflammation"],
    expected_organ_systems: ["cardiovascular"],
    recommended_tests: ["ECG", "Echocardiogram", "Troponin", "CRP", "ESR"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Myocardial Infarction"],
  },
};

const HEART_FAILURE: BenchmarkCase = {
  id: "ctrl-hf-011",
  name: "Heart Failure",
  description: "Progressive dyspnea, orthopnea, bilateral ankle edema, fatigue.",
  context: makeContext({
    visit_id: "bench-ctrl-hf-011",
    chief_complaint: "Increasing breathlessness and swollen ankles for 1 week",
    symptoms: ["shortness of breath", "orthopnea", "ankle swelling", "fatigue", "weight gain"],
    symptom_duration: "1 week",
    associated_symptoms: ["paroxysmal nocturnal dyspnea", "cough"],
    medical_history: ["hypertension", "previous MI"],
    vitals: { bp_systolic: 145, bp_diastolic: 90, pulse: 98, temperature: 37.0, spo2: 93, respiratory_rate: 22, weight_kg: 95, height_cm: 174 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Heart Failure",
    alternative_diagnoses: ["COPD Exacerbation", "Pneumonia", "Nephrotic Syndrome"],
    expected_symptoms_normalized: ["dyspnea", "orthopnea", "ankle edema", "fatigue"],
    expected_physiology_states: ["cardiac pump failure", "fluid overload"],
    expected_organ_systems: ["cardiovascular"],
    recommended_tests: ["BNP", "Chest X-ray", "Echocardiogram", "ECG"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Myocardial Infarction", "Pulmonary Embolism"],
  },
};

// ═══════════════════════════════════════════════════════════════
// NEUROLOGICAL (4)
// ═══════════════════════════════════════════════════════════════

const MIGRAINE: BenchmarkCase = {
  id: "ctrl-migraine-012",
  name: "Migraine",
  description: "Classic migraine with aura: unilateral headache, photophobia, nausea, visual aura.",
  context: makeContext({
    visit_id: "bench-ctrl-migraine-012",
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

const TENSION_HEADACHE: BenchmarkCase = {
  id: "ctrl-tension-ha-013",
  name: "Tension Headache",
  description: "Bilateral, band-like headache without nausea or photophobia.",
  context: makeContext({
    visit_id: "bench-ctrl-tension-ha-013",
    chief_complaint: "Constant band-like headache for 2 days",
    symptoms: ["bilateral headache", "neck stiffness", "fatigue", "pressure sensation", "mild dizziness"],
    symptom_duration: "2 days",
    associated_symptoms: ["stress", "poor sleep"],
    vitals: { bp_systolic: 120, bp_diastolic: 78, pulse: 76, temperature: 36.9, spo2: 99, respiratory_rate: 16, weight_kg: 65, height_cm: 168 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Tension Headache",
    alternative_diagnoses: ["Migraine", "Cervical Spondylosis", "Sinusitis"],
    expected_symptoms_normalized: ["bilateral headache", "neck stiffness", "fatigue"],
    expected_physiology_states: ["neurological"],
    expected_organ_systems: ["neurological"],
    recommended_tests: ["Neurological Exam"],
    danger_flag: false,
  },
};

const MENINGITIS: BenchmarkCase = {
  id: "ctrl-meningitis-014",
  name: "Meningitis",
  description: "Fever, severe headache, neck stiffness, photophobia, altered sensorium.",
  context: makeContext({
    visit_id: "bench-ctrl-meningitis-014",
    chief_complaint: "Severe headache with fever and stiff neck",
    symptoms: ["fever", "severe headache", "neck stiffness", "photophobia", "confusion"],
    symptom_duration: "1 day",
    associated_symptoms: ["vomiting", "rash"],
    vitals: { bp_systolic: 110, bp_diastolic: 68, pulse: 112, temperature: 39.2, spo2: 96, respiratory_rate: 22, weight_kg: 72, height_cm: 175 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Meningitis",
    alternative_diagnoses: ["Subarachnoid Hemorrhage", "Encephalitis", "Brain Abscess"],
    expected_symptoms_normalized: ["fever", "headache", "neck stiffness", "photophobia", "confusion"],
    expected_physiology_states: ["meningeal inflammation", "neurological"],
    expected_organ_systems: ["neurological", "immunological"],
    recommended_tests: ["Lumbar Puncture", "Blood Culture", "CT Head", "CBC", "CRP"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Meningitis", "Subarachnoid Hemorrhage"],
  },
};

const STROKE: BenchmarkCase = {
  id: "ctrl-stroke-015",
  name: "Stroke",
  description: "Sudden onset unilateral weakness, speech difficulty, facial droop.",
  context: makeContext({
    visit_id: "bench-ctrl-stroke-015",
    chief_complaint: "Sudden weakness on right side and difficulty speaking",
    symptoms: ["unilateral weakness", "speech difficulty", "facial droop", "confusion", "dizziness"],
    symptom_duration: "30 minutes",
    associated_symptoms: ["vision changes", "headache"],
    risk_factors: ["hypertension", "atrial fibrillation", "diabetes"],
    vitals: { bp_systolic: 180, bp_diastolic: 100, pulse: 88, temperature: 37.0, spo2: 96, respiratory_rate: 18, weight_kg: 80, height_cm: 172 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Stroke",
    alternative_diagnoses: ["TIA", "Todd's Paralysis", "Hypoglycemia"],
    expected_symptoms_normalized: ["unilateral weakness", "speech difficulty", "facial droop", "confusion"],
    expected_physiology_states: ["cerebrovascular event"],
    expected_organ_systems: ["neurological"],
    recommended_tests: ["CT Head", "CT Angiography", "Blood Glucose", "ECG", "CBC"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Stroke"],
  },
};

// ═══════════════════════════════════════════════════════════════
// INFECTIOUS (3)
// ═══════════════════════════════════════════════════════════════

const SEPSIS: BenchmarkCase = {
  id: "ctrl-sepsis-016",
  name: "Sepsis",
  description: "Classic sepsis: fever, tachycardia, hypotension, confusion, tachypnea.",
  context: makeContext({
    visit_id: "bench-ctrl-sepsis-016",
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

const INFLUENZA: BenchmarkCase = {
  id: "ctrl-influenza-017",
  name: "Influenza",
  description: "Sudden onset high fever, myalgia, dry cough, headache, fatigue.",
  context: makeContext({
    visit_id: "bench-ctrl-influenza-017",
    chief_complaint: "Sudden high fever with body aches and dry cough",
    symptoms: ["fever", "myalgia", "dry cough", "headache", "fatigue"],
    symptom_duration: "1 day",
    associated_symptoms: ["chills", "sore throat", "rhinorrhea"],
    vitals: { bp_systolic: 118, bp_diastolic: 75, pulse: 95, temperature: 39.0, spo2: 97, respiratory_rate: 18, weight_kg: 70, height_cm: 170 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Influenza",
    alternative_diagnoses: ["COVID-19", "Common Cold", "Pneumonia"],
    expected_symptoms_normalized: ["fever", "myalgia", "dry cough", "headache", "fatigue"],
    expected_physiology_states: ["systemic viral response"],
    expected_organ_systems: ["immunological", "respiratory"],
    recommended_tests: ["Rapid Influenza Test", "CBC", "Chest X-ray"],
    danger_flag: false,
  },
};

const COVID_LIKE: BenchmarkCase = {
  id: "ctrl-covid-018",
  name: "COVID-like Syndrome",
  description: "Fever, dry cough, anosmia, fatigue, myalgia — viral respiratory illness.",
  context: makeContext({
    visit_id: "bench-ctrl-covid-018",
    chief_complaint: "Fever, dry cough, and loss of smell for 3 days",
    symptoms: ["fever", "dry cough", "anosmia", "fatigue", "myalgia"],
    symptom_duration: "3 days",
    associated_symptoms: ["sore throat", "headache", "diarrhea"],
    vitals: { bp_systolic: 120, bp_diastolic: 78, pulse: 92, temperature: 38.4, spo2: 95, respiratory_rate: 20, weight_kg: 72, height_cm: 172 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "COVID-19",
    alternative_diagnoses: ["Influenza", "Pneumonia", "Common Cold"],
    expected_symptoms_normalized: ["fever", "dry cough", "anosmia", "fatigue", "myalgia"],
    expected_physiology_states: ["systemic viral response", "pulmonary inflammation"],
    expected_organ_systems: ["respiratory", "immunological"],
    recommended_tests: ["COVID-19 PCR", "Chest X-ray", "CBC", "CRP"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Pneumonia"],
  },
};

// ═══════════════════════════════════════════════════════════════
// METABOLIC / ENDOCRINE (3)
// ═══════════════════════════════════════════════════════════════

const DKA: BenchmarkCase = {
  id: "ctrl-dka-019",
  name: "Diabetic Ketoacidosis",
  description: "Classic DKA: polyuria, polydipsia, abdominal pain, vomiting, altered mental status.",
  context: makeContext({
    visit_id: "bench-ctrl-dka-019",
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
    expected_physiology_states: ["metabolic acidosis", "dehydration"],
    expected_organ_systems: ["endocrine"],
    recommended_tests: ["Blood Glucose", "ABG", "Serum Ketones", "Electrolytes", "HbA1c"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Diabetic Ketoacidosis"],
  },
};

const HYPOGLYCEMIA: BenchmarkCase = {
  id: "ctrl-hypoglycemia-020",
  name: "Hypoglycemia",
  description: "Tremor, diaphoresis, confusion, palpitations, hunger in a diabetic patient.",
  context: makeContext({
    visit_id: "bench-ctrl-hypoglycemia-020",
    chief_complaint: "Shaking, sweating, and confusion after missing meal",
    symptoms: ["tremor", "diaphoresis", "confusion", "palpitations", "hunger"],
    symptom_duration: "30 minutes",
    associated_symptoms: ["blurred vision", "weakness"],
    medical_history: ["type 2 diabetes"],
    medications: ["glimepiride", "metformin"],
    vitals: { bp_systolic: 130, bp_diastolic: 85, pulse: 100, temperature: 36.8, spo2: 98, respiratory_rate: 18, weight_kg: 82, height_cm: 168 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Hypoglycemia",
    alternative_diagnoses: ["Anxiety", "Cardiac Arrhythmia", "TIA"],
    expected_symptoms_normalized: ["tremor", "diaphoresis", "confusion", "palpitations", "hunger"],
    expected_physiology_states: ["hypoglycemic state"],
    expected_organ_systems: ["endocrine"],
    recommended_tests: ["Blood Glucose", "HbA1c", "ECG"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Hypoglycemia"],
  },
};

const THYROID_STORM: BenchmarkCase = {
  id: "ctrl-thyroid-storm-021",
  name: "Thyroid Storm",
  description: "Severe thyrotoxicosis: high fever, tachycardia, agitation, tremor, diarrhea.",
  context: makeContext({
    visit_id: "bench-ctrl-thyroid-storm-021",
    chief_complaint: "High fever, racing heart, and extreme agitation",
    symptoms: ["fever", "tachycardia", "agitation", "tremor", "diarrhea"],
    symptom_duration: "6 hours",
    associated_symptoms: ["diaphoresis", "weight loss"],
    medical_history: ["hyperthyroidism"],
    vitals: { bp_systolic: 160, bp_diastolic: 70, pulse: 150, temperature: 40.0, spo2: 96, respiratory_rate: 24, weight_kg: 55, height_cm: 165 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Thyroid Storm",
    alternative_diagnoses: ["Sepsis", "Pheochromocytoma", "Drug Toxicity"],
    expected_symptoms_normalized: ["fever", "tachycardia", "agitation", "tremor", "diarrhea"],
    expected_physiology_states: ["thyrotoxicosis", "hypermetabolic state"],
    expected_organ_systems: ["endocrine"],
    recommended_tests: ["TSH", "Free T4", "Free T3", "CBC", "LFTs"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Thyroid Storm"],
  },
};

// ═══════════════════════════════════════════════════════════════
// GENITOURINARY (3)
// ═══════════════════════════════════════════════════════════════

const UTI: BenchmarkCase = {
  id: "ctrl-uti-022",
  name: "Urinary Tract Infection",
  description: "Classic lower UTI: dysuria, frequency, suprapubic pain, fever, cloudy urine.",
  context: makeContext({
    visit_id: "bench-ctrl-uti-022",
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

const PYELONEPHRITIS: BenchmarkCase = {
  id: "ctrl-pyelonephritis-023",
  name: "Pyelonephritis",
  description: "High fever, flank pain, dysuria, nausea, rigors — ascending UTI.",
  context: makeContext({
    visit_id: "bench-ctrl-pyelo-023",
    chief_complaint: "High fever with severe flank pain and burning urination",
    symptoms: ["fever", "flank pain", "dysuria", "nausea", "rigors"],
    symptom_duration: "2 days",
    associated_symptoms: ["vomiting", "frequent urination"],
    vitals: { bp_systolic: 115, bp_diastolic: 70, pulse: 108, temperature: 39.3, spo2: 97, respiratory_rate: 20, weight_kg: 62, height_cm: 164 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Pyelonephritis",
    alternative_diagnoses: ["Renal Colic", "UTI", "Renal Abscess"],
    expected_symptoms_normalized: ["fever", "flank pain", "dysuria", "nausea", "rigors"],
    expected_physiology_states: ["renal inflammation"],
    expected_organ_systems: ["renal"],
    recommended_tests: ["Urinalysis", "Urine Culture", "Blood Culture", "CBC", "CRP", "Renal Ultrasound"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Sepsis"],
  },
};

const RENAL_COLIC: BenchmarkCase = {
  id: "ctrl-renal-colic-024",
  name: "Renal Colic",
  description: "Severe colicky flank pain radiating to groin, hematuria, restlessness.",
  context: makeContext({
    visit_id: "bench-ctrl-renal-colic-024",
    chief_complaint: "Sudden severe pain in left side radiating to groin",
    symptoms: ["flank pain", "hematuria", "nausea", "vomiting", "restlessness"],
    symptom_duration: "3 hours",
    associated_symptoms: ["colicky pain", "urinary urgency"],
    vitals: { bp_systolic: 140, bp_diastolic: 90, pulse: 100, temperature: 37.2, spo2: 98, respiratory_rate: 20, weight_kg: 78, height_cm: 176 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Renal Colic",
    alternative_diagnoses: ["Pyelonephritis", "Appendicitis", "Abdominal Aortic Aneurysm"],
    expected_symptoms_normalized: ["flank pain", "hematuria", "nausea", "vomiting"],
    expected_physiology_states: ["urinary obstruction"],
    expected_organ_systems: ["renal"],
    recommended_tests: ["CT KUB", "Urinalysis", "CBC", "Creatinine"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Abdominal Aortic Aneurysm"],
  },
};

// ═══════════════════════════════════════════════════════════════
// ADDITIONAL MIXED CASES (6 — ambiguous & overlapping)
// ═══════════════════════════════════════════════════════════════

const CHOLECYSTITIS: BenchmarkCase = {
  id: "ctrl-cholecystitis-025",
  name: "Acute Cholecystitis",
  description: "RUQ pain, fever, nausea, positive Murphy's sign after fatty meal.",
  context: makeContext({
    visit_id: "bench-ctrl-cholecystitis-025",
    chief_complaint: "Severe right upper abdominal pain after eating fatty food",
    symptoms: ["right upper quadrant pain", "fever", "nausea", "vomiting", "jaundice"],
    symptom_duration: "1 day",
    associated_symptoms: ["referred shoulder pain"],
    vitals: { bp_systolic: 128, bp_diastolic: 82, pulse: 96, temperature: 38.4, spo2: 98, respiratory_rate: 18, weight_kg: 85, height_cm: 162 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Cholecystitis",
    alternative_diagnoses: ["Choledocholithiasis", "Hepatitis", "Pancreatitis"],
    expected_symptoms_normalized: ["right upper quadrant pain", "fever", "nausea", "vomiting", "jaundice"],
    expected_physiology_states: ["biliary inflammation"],
    expected_organ_systems: ["gastrointestinal"],
    recommended_tests: ["Abdominal Ultrasound", "CBC", "LFTs", "CRP"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Cholecystitis"],
  },
};

const PNEUMOTHORAX: BenchmarkCase = {
  id: "ctrl-pneumothorax-026",
  name: "Pneumothorax",
  description: "Sudden pleuritic chest pain, dyspnea, diminished breath sounds.",
  context: makeContext({
    visit_id: "bench-ctrl-pneumothorax-026",
    chief_complaint: "Sudden sharp chest pain and difficulty breathing",
    symptoms: ["sudden chest pain", "shortness of breath", "pleuritic pain", "tachycardia", "decreased breath sounds"],
    symptom_duration: "1 hour",
    associated_symptoms: ["anxiety"],
    risk_factors: ["tall thin male", "smoking"],
    vitals: { bp_systolic: 110, bp_diastolic: 72, pulse: 115, temperature: 37.0, spo2: 90, respiratory_rate: 28, weight_kg: 65, height_cm: 188 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Pneumothorax",
    alternative_diagnoses: ["Pulmonary Embolism", "Myocardial Infarction", "Pleurisy"],
    expected_symptoms_normalized: ["chest pain", "dyspnea", "pleuritic pain", "tachycardia"],
    expected_physiology_states: ["pleural space disruption", "impaired gas exchange"],
    expected_organ_systems: ["respiratory"],
    recommended_tests: ["Chest X-ray", "CT Chest", "ABG"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Pneumothorax", "Pulmonary Embolism"],
  },
};

const DVT: BenchmarkCase = {
  id: "ctrl-dvt-027",
  name: "Deep Vein Thrombosis",
  description: "Unilateral leg swelling, calf pain, warmth, erythema.",
  context: makeContext({
    visit_id: "bench-ctrl-dvt-027",
    chief_complaint: "Painful swelling of left leg for 2 days",
    symptoms: ["leg swelling", "calf pain", "warmth", "erythema", "tenderness"],
    symptom_duration: "2 days",
    associated_symptoms: ["low grade fever"],
    risk_factors: ["recent long flight", "oral contraceptives"],
    vitals: { bp_systolic: 122, bp_diastolic: 78, pulse: 85, temperature: 37.4, spo2: 98, respiratory_rate: 16, weight_kg: 68, height_cm: 165 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Deep Vein Thrombosis",
    alternative_diagnoses: ["Cellulitis", "Muscle Strain", "Baker's Cyst"],
    expected_symptoms_normalized: ["leg swelling", "calf pain", "warmth", "erythema"],
    expected_physiology_states: ["venous thrombosis"],
    expected_organ_systems: ["cardiovascular"],
    recommended_tests: ["D-Dimer", "Compression Ultrasound", "CBC"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Pulmonary Embolism", "Deep Vein Thrombosis"],
  },
};

const ANAPHYLAXIS: BenchmarkCase = {
  id: "ctrl-anaphylaxis-028",
  name: "Anaphylaxis",
  description: "Acute onset after allergen exposure: urticaria, dyspnea, hypotension, tachycardia.",
  context: makeContext({
    visit_id: "bench-ctrl-anaphylaxis-028",
    chief_complaint: "Sudden rash, difficulty breathing, and feeling faint after eating peanuts",
    symptoms: ["urticaria", "shortness of breath", "hypotension", "tachycardia", "throat swelling"],
    symptom_duration: "15 minutes",
    associated_symptoms: ["itching", "dizziness", "abdominal cramps"],
    allergies: ["peanuts"],
    vitals: { bp_systolic: 80, bp_diastolic: 50, pulse: 130, temperature: 37.0, spo2: 90, respiratory_rate: 30, weight_kg: 70, height_cm: 170 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Anaphylaxis",
    alternative_diagnoses: ["Angioedema", "Asthma", "Panic Attack"],
    expected_symptoms_normalized: ["urticaria", "dyspnea", "hypotension", "tachycardia", "throat swelling"],
    expected_physiology_states: ["anaphylactic response", "hemodynamic instability"],
    expected_organ_systems: ["immunological", "cardiovascular"],
    recommended_tests: ["Tryptase", "CBC", "ABG"],
    danger_flag: true,
    expected_dangerous_diagnoses: ["Anaphylaxis"],
  },
};

const CELLULITIS: BenchmarkCase = {
  id: "ctrl-cellulitis-029",
  name: "Cellulitis",
  description: "Spreading erythema, warmth, pain, fever — skin and soft tissue infection.",
  context: makeContext({
    visit_id: "bench-ctrl-cellulitis-029",
    chief_complaint: "Red, hot, swollen area on right leg with fever",
    symptoms: ["erythema", "warmth", "pain", "fever", "swelling"],
    symptom_duration: "3 days",
    associated_symptoms: ["tenderness", "malaise"],
    vitals: { bp_systolic: 125, bp_diastolic: 80, pulse: 92, temperature: 38.3, spo2: 98, respiratory_rate: 16, weight_kg: 80, height_cm: 175 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "Cellulitis",
    alternative_diagnoses: ["Deep Vein Thrombosis", "Abscess", "Erysipelas"],
    expected_symptoms_normalized: ["erythema", "warmth", "pain", "fever", "swelling"],
    expected_physiology_states: ["soft tissue inflammation"],
    expected_organ_systems: ["immunological"],
    recommended_tests: ["CBC", "CRP", "Blood Culture"],
    danger_flag: false,
  },
};

const GERD: BenchmarkCase = {
  id: "ctrl-gerd-030",
  name: "GERD",
  description: "Heartburn, acid regurgitation, chest discomfort after meals, chronic cough.",
  context: makeContext({
    visit_id: "bench-ctrl-gerd-030",
    chief_complaint: "Burning chest discomfort and acid taste after meals for 3 weeks",
    symptoms: ["heartburn", "acid regurgitation", "chest discomfort", "chronic cough", "bloating"],
    symptom_duration: "3 weeks",
    associated_symptoms: ["worse lying down", "sore throat"],
    vitals: { bp_systolic: 120, bp_diastolic: 78, pulse: 78, temperature: 37.0, spo2: 99, respiratory_rate: 16, weight_kg: 85, height_cm: 170 },
  }),
  ground_truth: {
    gold_standard_diagnosis: "GERD",
    alternative_diagnoses: ["Peptic Ulcer Disease", "Angina", "Esophagitis"],
    expected_symptoms_normalized: ["heartburn", "acid regurgitation", "chest discomfort", "chronic cough"],
    expected_physiology_states: ["esophageal reflux"],
    expected_organ_systems: ["gastrointestinal"],
    recommended_tests: ["Upper GI Endoscopy", "pH Monitoring"],
    danger_flag: false,
  },
};

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export const CONTROLLED_SCENARIO = PNEUMONIA; // backwards compat

export const BENCHMARK_SUITE: BenchmarkCase[] = [
  // Respiratory (4)
  PNEUMONIA, ASTHMA, PE, COPD,
  // GI (4)
  GASTROENTERITIS, APPENDICITIS, PANCREATITIS, PEPTIC_ULCER,
  // Cardiac (3)
  ACS, PERICARDITIS, HEART_FAILURE,
  // Neurological (4)
  MIGRAINE, TENSION_HEADACHE, MENINGITIS, STROKE,
  // Infectious (3)
  SEPSIS, INFLUENZA, COVID_LIKE,
  // Metabolic (3)
  DKA, HYPOGLYCEMIA, THYROID_STORM,
  // Genitourinary (3)
  UTI, PYELONEPHRITIS, RENAL_COLIC,
  // Mixed (6)
  CHOLECYSTITIS, PNEUMOTHORAX, DVT, ANAPHYLAXIS, CELLULITIS, GERD,
];
