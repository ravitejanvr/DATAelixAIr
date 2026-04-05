/**
 * Evaluation test cases for V2 probabilistic engine validation.
 * Covers: core clinical, ambiguity, missing data, noise, adversarial.
 */

export interface EvalCase {
  id: string;
  name: string;
  category: "core" | "ambiguous" | "missing_data" | "noisy" | "adversarial";
  expected_top1: string; // diagnosis name (for human reference)
  confidence: "HIGH" | "MEDIUM" | "LOW";
  input: {
    symptoms: string[];
    vitals?: Record<string, string | number>;
    lab_results?: Record<string, number>;
    risk_factors?: string[];
    medical_history?: string[];
    age?: number;
    sex?: string;
  };
}

export const EVAL_CASES: EvalCase[] = [
  // ── CORE CLINICAL (10 representative) ──
  {
    id: "CORE-01", name: "Classic Sepsis", category: "core",
    expected_top1: "Sepsis", confidence: "HIGH",
    input: {
      symptoms: ["fever", "chills", "tachycardia", "confusion"],
      vitals: { temperature: 39.2, heartRate: 120, bloodPressure: "85/55", spO2: 93, respiratoryRate: 26 },
      lab_results: { lactate: 5.2, WBC: 18, CRP: 180, procalcitonin: 8 },
      age: 65, sex: "male",
    },
  },
  {
    id: "CORE-02", name: "Community Acquired Pneumonia", category: "core",
    expected_top1: "Community Acquired Pneumonia", confidence: "HIGH",
    input: {
      symptoms: ["fever", "cough", "breathlessness", "chest pain"],
      vitals: { temperature: 38.5, heartRate: 100, bloodPressure: "120/80", spO2: 91, respiratoryRate: 24 },
      lab_results: { WBC: 14, CRP: 95 },
      age: 55, sex: "male",
    },
  },
  {
    id: "CORE-03", name: "COVID-19", category: "core",
    expected_top1: "COVID-19", confidence: "MEDIUM",
    input: {
      symptoms: ["fever", "cough", "fatigue", "body ache", "loss of taste"],
      vitals: { temperature: 38.1, heartRate: 95, bloodPressure: "125/80", spO2: 94 },
      lab_results: { CRP: 45, WBC: 5 },
      age: 40, sex: "female",
    },
  },
  {
    id: "CORE-04", name: "Pulmonary Embolism", category: "core",
    expected_top1: "Pulmonary Embolism", confidence: "MEDIUM",
    input: {
      symptoms: ["breathlessness", "chest pain", "tachycardia"],
      vitals: { heartRate: 115, bloodPressure: "110/70", spO2: 90, respiratoryRate: 28 },
      lab_results: { D_dimer: 2500 },
      risk_factors: ["recent surgery", "immobilization"],
      age: 50, sex: "female",
    },
  },
  {
    id: "CORE-05", name: "Myocardial Infarction", category: "core",
    expected_top1: "Myocardial Infarction", confidence: "HIGH",
    input: {
      symptoms: ["chest pain", "sweating", "nausea", "jaw pain"],
      vitals: { heartRate: 105, bloodPressure: "145/95", spO2: 96 },
      lab_results: { troponin: 2.5, BNP: 450 },
      risk_factors: ["diabetes", "hypertension", "smoking"],
      age: 62, sex: "male",
    },
  },
  {
    id: "CORE-06", name: "Mild URI", category: "core",
    expected_top1: "Upper Respiratory Infection", confidence: "HIGH",
    input: {
      symptoms: ["cough", "sore throat", "runny nose"],
      vitals: { temperature: 37.5, heartRate: 80, bloodPressure: "120/80", spO2: 98 },
      age: 30, sex: "female",
    },
  },
  {
    id: "CORE-07", name: "Diabetic Ketoacidosis", category: "core",
    expected_top1: "Diabetic Ketoacidosis", confidence: "MEDIUM",
    input: {
      symptoms: ["nausea", "vomiting", "abdominal pain", "confusion", "breathlessness"],
      vitals: { heartRate: 110, bloodPressure: "100/65", respiratoryRate: 30 },
      lab_results: { lactate: 3.5 },
      medical_history: ["diabetes mellitus"],
      age: 28, sex: "male",
    },
  },
  {
    id: "CORE-08", name: "Meningitis", category: "core",
    expected_top1: "Meningitis", confidence: "MEDIUM",
    input: {
      symptoms: ["fever", "headache", "neck stiffness", "photophobia", "confusion"],
      vitals: { temperature: 39.5, heartRate: 115, bloodPressure: "100/60" },
      lab_results: { WBC: 20, CRP: 200 },
      age: 22, sex: "male",
    },
  },
  {
    id: "CORE-09", name: "Heart Failure Exacerbation", category: "core",
    expected_top1: "Heart Failure", confidence: "HIGH",
    input: {
      symptoms: ["breathlessness", "fatigue", "pedal edema", "orthopnea"],
      vitals: { heartRate: 95, bloodPressure: "140/90", spO2: 92 },
      lab_results: { BNP: 800, creatinine: 1.8 },
      medical_history: ["heart failure", "hypertension"],
      age: 70, sex: "male",
    },
  },
  {
    id: "CORE-10", name: "Acute Gastroenteritis", category: "core",
    expected_top1: "Gastroenteritis", confidence: "HIGH",
    input: {
      symptoms: ["diarrhea", "vomiting", "abdominal pain", "nausea"],
      vitals: { temperature: 37.8, heartRate: 90, bloodPressure: "115/75" },
      age: 35, sex: "female",
    },
  },

  // ── AMBIGUOUS OVERLAP CASES ──
  {
    id: "AMB-01", name: "Fever+Cough: CAP vs COVID", category: "ambiguous",
    expected_top1: "Community Acquired Pneumonia", confidence: "LOW",
    input: {
      symptoms: ["fever", "cough", "fatigue", "breathlessness"],
      vitals: { temperature: 38.3, heartRate: 98, spO2: 93 },
      lab_results: { CRP: 60, WBC: 10 },
      age: 45, sex: "male",
    },
  },
  {
    id: "AMB-02", name: "Chest Pain: Cardiac vs Respiratory", category: "ambiguous",
    expected_top1: "Myocardial Infarction", confidence: "LOW",
    input: {
      symptoms: ["chest pain", "breathlessness", "sweating"],
      vitals: { heartRate: 100, bloodPressure: "135/85", spO2: 95 },
      lab_results: { troponin: 0.06, D_dimer: 600 },
      age: 55, sex: "male",
    },
  },
  {
    id: "AMB-03", name: "Sepsis vs Severe Pneumonia", category: "ambiguous",
    expected_top1: "Sepsis", confidence: "LOW",
    input: {
      symptoms: ["fever", "cough", "breathlessness", "confusion"],
      vitals: { temperature: 39.0, heartRate: 110, bloodPressure: "95/60", spO2: 90 },
      lab_results: { lactate: 3.0, WBC: 16, CRP: 150 },
      age: 68, sex: "female",
    },
  },

  // ── MISSING DATA CASES ──
  {
    id: "MISS-01", name: "Symptoms only (no labs/vitals)", category: "missing_data",
    expected_top1: "Upper Respiratory Infection", confidence: "LOW",
    input: {
      symptoms: ["fever", "cough", "sore throat"],
      age: 30, sex: "female",
    },
  },
  {
    id: "MISS-02", name: "No labs available", category: "missing_data",
    expected_top1: "Community Acquired Pneumonia", confidence: "LOW",
    input: {
      symptoms: ["fever", "cough", "breathlessness"],
      vitals: { temperature: 38.5, heartRate: 100, spO2: 92 },
      age: 60, sex: "male",
    },
  },

  // ── NOISY / CONFLICTING CASES ──
  {
    id: "NOISE-01", name: "Fever+Hypoxia but NORMAL lactate", category: "noisy",
    expected_top1: "Community Acquired Pneumonia", confidence: "MEDIUM",
    input: {
      symptoms: ["fever", "cough", "breathlessness"],
      vitals: { temperature: 38.5, heartRate: 100, bloodPressure: "120/80", spO2: 90 },
      lab_results: { lactate: 1.0, CRP: 80, WBC: 12 },
      age: 55, sex: "male",
    },
  },
  {
    id: "NOISE-02", name: "High troponin but no cardiac symptoms", category: "noisy",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["fatigue"],
      vitals: { heartRate: 75, bloodPressure: "130/85", spO2: 97 },
      lab_results: { troponin: 0.5 },
      age: 70, sex: "male",
    },
  },

  // ── ADVERSARIAL / EDGE CASES ──
  {
    id: "ADV-01", name: "Extreme lactate with stable vitals", category: "adversarial",
    expected_top1: "Sepsis", confidence: "MEDIUM",
    input: {
      symptoms: ["fatigue"],
      vitals: { temperature: 37.0, heartRate: 80, bloodPressure: "120/80", spO2: 98 },
      lab_results: { lactate: 10 },
      age: 50, sex: "male",
    },
  },
  {
    id: "ADV-02", name: "All normal vitals + vague symptoms", category: "adversarial",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["fatigue", "malaise"],
      vitals: { temperature: 36.8, heartRate: 72, bloodPressure: "118/76", spO2: 99 },
      age: 35, sex: "female",
    },
  },
];
