/**
 * Core clinical evaluation cases (30 cases)
 * Clear textbook presentations with unambiguous expected diagnoses.
 */
import { type EvalCase } from "./cases";

export const CORE_CASES: EvalCase[] = [
  // ── SEPSIS (5 variants) ──
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
    id: "CORE-02", name: "Sepsis without Lactate", category: "core",
    expected_top1: "Sepsis", confidence: "MEDIUM",
    input: {
      symptoms: ["fever", "chills", "confusion", "tachycardia"],
      vitals: { temperature: 39.0, heartRate: 115, bloodPressure: "90/60", spO2: 94, respiratoryRate: 24 },
      lab_results: { WBC: 20, CRP: 200, procalcitonin: 6 },
      age: 70, sex: "female",
    },
  },
  {
    id: "CORE-03", name: "Sepsis Mild Early", category: "core",
    expected_top1: "Sepsis", confidence: "MEDIUM",
    input: {
      symptoms: ["fever", "chills", "fatigue"],
      vitals: { temperature: 38.8, heartRate: 105, bloodPressure: "95/65", spO2: 95, respiratoryRate: 22 },
      lab_results: { lactate: 2.5, WBC: 15, CRP: 100 },
      age: 55, sex: "male",
    },
  },
  {
    id: "CORE-04", name: "Septic Shock", category: "core",
    expected_top1: "Sepsis", confidence: "HIGH",
    input: {
      symptoms: ["fever", "confusion", "tachycardia", "chills"],
      vitals: { temperature: 40.1, heartRate: 130, bloodPressure: "75/45", spO2: 88, respiratoryRate: 30 },
      lab_results: { lactate: 8.0, WBC: 25, CRP: 300, procalcitonin: 15 },
      age: 72, sex: "male",
    },
  },
  {
    id: "CORE-05", name: "Urosepsis", category: "core",
    expected_top1: "Sepsis", confidence: "MEDIUM",
    input: {
      symptoms: ["fever", "chills", "confusion", "reduced urine"],
      vitals: { temperature: 39.5, heartRate: 110, bloodPressure: "88/55", spO2: 95 },
      lab_results: { lactate: 3.8, WBC: 22, CRP: 160 },
      risk_factors: ["urinary catheter"],
      age: 80, sex: "female",
    },
  },

  // ── CAP (5 variants) ──
  {
    id: "CORE-06", name: "Classic CAP", category: "core",
    expected_top1: "Community Acquired Pneumonia", confidence: "HIGH",
    input: {
      symptoms: ["fever", "cough", "breathlessness", "chest pain"],
      vitals: { temperature: 38.5, heartRate: 100, bloodPressure: "120/80", spO2: 91, respiratoryRate: 24 },
      lab_results: { WBC: 14, CRP: 95 },
      age: 55, sex: "male",
    },
  },
  {
    id: "CORE-07", name: "Severe CAP", category: "core",
    expected_top1: "Community Acquired Pneumonia", confidence: "HIGH",
    input: {
      symptoms: ["fever", "cough", "breathlessness", "chest pain"],
      vitals: { temperature: 39.0, heartRate: 110, bloodPressure: "115/75", spO2: 88, respiratoryRate: 28 },
      lab_results: { WBC: 18, CRP: 150 },
      age: 68, sex: "male",
    },
  },
  {
    id: "CORE-08", name: "Mild CAP Young Adult", category: "core",
    expected_top1: "Community Acquired Pneumonia", confidence: "MEDIUM",
    input: {
      symptoms: ["cough", "fever", "breathlessness"],
      vitals: { temperature: 38.2, heartRate: 95, bloodPressure: "125/80", spO2: 93, respiratoryRate: 22 },
      lab_results: { WBC: 12, CRP: 60 },
      age: 32, sex: "female",
    },
  },
  {
    id: "CORE-09", name: "CAP Elderly", category: "core",
    expected_top1: "Community Acquired Pneumonia", confidence: "MEDIUM",
    input: {
      symptoms: ["cough", "breathlessness", "fatigue", "confusion"],
      vitals: { temperature: 37.8, heartRate: 100, bloodPressure: "130/85", spO2: 90, respiratoryRate: 26 },
      lab_results: { WBC: 16, CRP: 120 },
      age: 78, sex: "female",
    },
  },
  {
    id: "CORE-10", name: "CAP with Normal Lactate", category: "core",
    expected_top1: "Community Acquired Pneumonia", confidence: "HIGH",
    input: {
      symptoms: ["fever", "cough", "breathlessness"],
      vitals: { temperature: 38.5, heartRate: 100, bloodPressure: "120/80", spO2: 90, respiratoryRate: 24 },
      lab_results: { lactate: 1.0, CRP: 80, WBC: 12 },
      age: 55, sex: "male",
    },
  },

  // ── MI (5 variants) ──
  {
    id: "CORE-11", name: "Classic STEMI", category: "core",
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
    id: "CORE-12", name: "MI Female Atypical", category: "core",
    expected_top1: "Myocardial Infarction", confidence: "MEDIUM",
    input: {
      symptoms: ["chest pain", "nausea", "fatigue", "breathlessness"],
      vitals: { heartRate: 95, bloodPressure: "150/90", spO2: 95 },
      lab_results: { troponin: 1.2 },
      risk_factors: ["hypertension", "diabetes"],
      age: 70, sex: "female",
    },
  },
  {
    id: "CORE-13", name: "MI with Bradycardia", category: "core",
    expected_top1: "Myocardial Infarction", confidence: "HIGH",
    input: {
      symptoms: ["chest pain", "sweating", "nausea"],
      vitals: { heartRate: 50, bloodPressure: "100/65", spO2: 94 },
      lab_results: { troponin: 5.0 },
      risk_factors: ["smoking", "family history"],
      age: 58, sex: "male",
    },
  },
  {
    id: "CORE-14", name: "NSTEMI", category: "core",
    expected_top1: "Myocardial Infarction", confidence: "MEDIUM",
    input: {
      symptoms: ["chest pain", "breathlessness", "sweating"],
      vitals: { heartRate: 90, bloodPressure: "135/85", spO2: 96 },
      lab_results: { troponin: 0.8 },
      risk_factors: ["hypertension"],
      age: 55, sex: "male",
    },
  },
  {
    id: "CORE-15", name: "MI Elderly", category: "core",
    expected_top1: "Myocardial Infarction", confidence: "MEDIUM",
    input: {
      symptoms: ["breathlessness", "sweating", "fatigue"],
      vitals: { heartRate: 100, bloodPressure: "160/95", spO2: 93 },
      lab_results: { troponin: 3.0, BNP: 600 },
      medical_history: ["hypertension", "diabetes mellitus"],
      age: 80, sex: "male",
    },
  },

  // ── DKA (3 variants) ──
  {
    id: "CORE-16", name: "Classic DKA", category: "core",
    expected_top1: "Diabetic Ketoacidosis", confidence: "HIGH",
    input: {
      symptoms: ["nausea", "vomiting", "abdominal pain", "confusion", "breathlessness"],
      vitals: { heartRate: 110, bloodPressure: "100/65", respiratoryRate: 30 },
      lab_results: { lactate: 3.5 },
      medical_history: ["diabetes mellitus"],
      age: 28, sex: "male",
    },
  },
  {
    id: "CORE-17", name: "DKA Young Female", category: "core",
    expected_top1: "Diabetic Ketoacidosis", confidence: "MEDIUM",
    input: {
      symptoms: ["nausea", "vomiting", "abdominal pain", "fatigue"],
      vitals: { heartRate: 105, bloodPressure: "105/70", respiratoryRate: 28 },
      medical_history: ["diabetes mellitus"],
      age: 22, sex: "female",
    },
  },
  {
    id: "CORE-18", name: "DKA with Altered MS", category: "core",
    expected_top1: "Diabetic Ketoacidosis", confidence: "HIGH",
    input: {
      symptoms: ["confusion", "vomiting", "abdominal pain", "breathlessness"],
      vitals: { heartRate: 120, bloodPressure: "95/60", respiratoryRate: 32 },
      lab_results: { lactate: 4.0 },
      medical_history: ["diabetes mellitus"],
      age: 35, sex: "male",
    },
  },

  // ── URI (3 variants) ──
  {
    id: "CORE-19", name: "Mild URI", category: "core",
    expected_top1: "Upper Respiratory Infection", confidence: "HIGH",
    input: {
      symptoms: ["cough", "sore throat", "runny nose"],
      vitals: { temperature: 37.5, heartRate: 80, bloodPressure: "120/80", spO2: 98 },
      age: 30, sex: "female",
    },
  },
  {
    id: "CORE-20", name: "URI with Low Fever", category: "core",
    expected_top1: "Upper Respiratory Infection", confidence: "HIGH",
    input: {
      symptoms: ["sore throat", "cough", "runny nose", "body ache"],
      vitals: { temperature: 37.8, heartRate: 82, bloodPressure: "118/76", spO2: 99 },
      age: 25, sex: "male",
    },
  },
  {
    id: "CORE-21", name: "URI Pediatric", category: "core",
    expected_top1: "Upper Respiratory Infection", confidence: "HIGH",
    input: {
      symptoms: ["cough", "sore throat", "runny nose", "fever"],
      vitals: { temperature: 38.0, heartRate: 100, bloodPressure: "100/65", spO2: 98 },
      age: 8, sex: "male",
    },
  },

  // ── Heart Failure (3 variants) ──
  {
    id: "CORE-22", name: "Heart Failure Exacerbation", category: "core",
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
    id: "CORE-23", name: "Heart Failure NYHA III", category: "core",
    expected_top1: "Heart Failure", confidence: "HIGH",
    input: {
      symptoms: ["breathlessness", "fatigue", "pedal edema"],
      vitals: { heartRate: 90, bloodPressure: "145/95", spO2: 93 },
      lab_results: { BNP: 600 },
      medical_history: ["heart failure"],
      age: 65, sex: "female",
    },
  },
  {
    id: "CORE-24", name: "Heart Failure New Onset", category: "core",
    expected_top1: "Heart Failure", confidence: "MEDIUM",
    input: {
      symptoms: ["breathlessness", "fatigue", "pedal edema", "orthopnea"],
      vitals: { heartRate: 100, bloodPressure: "155/100", spO2: 91 },
      lab_results: { BNP: 1200 },
      age: 60, sex: "male",
    },
  },

  // ── Other Core Conditions ──
  {
    id: "CORE-25", name: "Acute Gastroenteritis", category: "core",
    expected_top1: "Gastroenteritis", confidence: "HIGH",
    input: {
      symptoms: ["diarrhea", "vomiting", "abdominal pain", "nausea"],
      vitals: { temperature: 37.8, heartRate: 90, bloodPressure: "115/75" },
      age: 35, sex: "female",
    },
  },
  {
    id: "CORE-26", name: "Meningitis", category: "core",
    expected_top1: "Meningitis", confidence: "MEDIUM",
    input: {
      symptoms: ["fever", "headache", "neck stiffness", "photophobia", "confusion"],
      vitals: { temperature: 39.5, heartRate: 115, bloodPressure: "100/60" },
      lab_results: { WBC: 20, CRP: 200 },
      age: 22, sex: "male",
    },
  },
  {
    id: "CORE-27", name: "Pulmonary Embolism", category: "core",
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
    id: "CORE-28", name: "COVID-19", category: "core",
    expected_top1: "COVID-19", confidence: "MEDIUM",
    input: {
      symptoms: ["fever", "cough", "fatigue", "body ache", "loss of taste"],
      vitals: { temperature: 38.1, heartRate: 95, bloodPressure: "125/80", spO2: 94 },
      lab_results: { CRP: 45, WBC: 5 },
      age: 40, sex: "female",
    },
  },
  {
    id: "CORE-29", name: "Appendicitis", category: "core",
    expected_top1: "Appendicitis", confidence: "HIGH",
    input: {
      symptoms: ["abdominal pain", "nausea", "vomiting", "fever"],
      vitals: { temperature: 38.3, heartRate: 95, bloodPressure: "125/80" },
      lab_results: { WBC: 15, CRP: 70 },
      age: 25, sex: "male",
    },
  },
  {
    id: "CORE-30", name: "Acute Asthma Exacerbation", category: "core",
    expected_top1: "Asthma", confidence: "HIGH",
    input: {
      symptoms: ["breathlessness", "cough", "chest tightness"],
      vitals: { heartRate: 110, bloodPressure: "130/85", spO2: 91, respiratoryRate: 28 },
      medical_history: ["asthma"],
      age: 28, sex: "female",
    },
  },
];
