/**
 * Adversarial + continuous sweep cases (20 cases)
 * Edge scenarios and parametric sensitivity tests.
 */
import { type EvalCase } from "./cases";

export const ADVERSARIAL_CASES: EvalCase[] = [
  // ── ADVERSARIAL (10 cases) ──
  {
    id: "ADV-01", name: "Extreme lactate stable vitals", category: "adversarial",
    expected_top1: "Sepsis", confidence: "MEDIUM",
    input: {
      symptoms: ["fatigue"],
      vitals: { temperature: 37.0, heartRate: 80, bloodPressure: "120/80", spO2: 98 },
      lab_results: { lactate: 10 },
      age: 50, sex: "male",
    },
  },
  {
    id: "ADV-02", name: "All normal + vague symptoms", category: "adversarial",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["fatigue", "malaise"],
      vitals: { temperature: 36.8, heartRate: 72, bloodPressure: "118/76", spO2: 99 },
      age: 35, sex: "female",
    },
  },
  {
    id: "ADV-03", name: "No symptoms at all", category: "adversarial",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: [],
      vitals: { temperature: 36.8, heartRate: 72, bloodPressure: "118/76", spO2: 99 },
      age: 30, sex: "male",
    },
  },
  {
    id: "ADV-04", name: "Extreme hypotension only", category: "adversarial",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["dizziness"],
      vitals: { bloodPressure: "60/35", heartRate: 130, temperature: 36.5, spO2: 95 },
      age: 45, sex: "male",
    },
  },
  {
    id: "ADV-05", name: "All labs critical + no symptoms", category: "adversarial",
    expected_top1: "Sepsis", confidence: "LOW",
    input: {
      symptoms: [],
      vitals: { temperature: 37.0, heartRate: 70, bloodPressure: "120/80", spO2: 98 },
      lab_results: { lactate: 8, WBC: 25, CRP: 300, procalcitonin: 15, troponin: 2.0 },
      age: 55, sex: "male",
    },
  },
  {
    id: "ADV-06", name: "Fever only no other data", category: "adversarial",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["fever"],
      vitals: { temperature: 39.5 },
      age: 40, sex: "male",
    },
  },
  {
    id: "ADV-07", name: "Young patient all critical", category: "adversarial",
    expected_top1: "Sepsis", confidence: "MEDIUM",
    input: {
      symptoms: ["fever", "chills", "confusion", "breathlessness"],
      vitals: { temperature: 40.0, heartRate: 140, bloodPressure: "70/40", spO2: 85, respiratoryRate: 35 },
      lab_results: { lactate: 12, WBC: 30, CRP: 400, procalcitonin: 20 },
      age: 20, sex: "male",
    },
  },
  {
    id: "ADV-08", name: "Perfect health baseline", category: "adversarial",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: [],
      vitals: { temperature: 36.6, heartRate: 68, bloodPressure: "120/75", spO2: 99, respiratoryRate: 14 },
      lab_results: { lactate: 0.8, WBC: 7, CRP: 2 },
      age: 25, sex: "female",
    },
  },
  {
    id: "ADV-09", name: "Elderly multi-morbid vague", category: "adversarial",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["fatigue", "body ache"],
      vitals: { heartRate: 80, bloodPressure: "150/90", spO2: 95 },
      medical_history: ["hypertension", "diabetes mellitus", "heart failure"],
      age: 85, sex: "male",
    },
  },
  {
    id: "ADV-10", name: "All symptoms all normal labs", category: "adversarial",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["fever", "cough", "chest pain", "breathlessness", "headache", "abdominal pain", "nausea"],
      vitals: { temperature: 37.0, heartRate: 72, bloodPressure: "120/80", spO2: 99 },
      lab_results: { lactate: 0.8, WBC: 7, CRP: 3, troponin: 0.01 },
      age: 40, sex: "male",
    },
  },

  // ── CONTINUOUS SWEEP (10 cases) — Lactate 1→10, SpO2 100→85, SBP 140→80 ──
  {
    id: "SWEEP-LAC-1", name: "Lactate Sweep 1.0", category: "adversarial",
    expected_top1: "Community Acquired Pneumonia", confidence: "LOW",
    input: {
      symptoms: ["fever", "cough", "breathlessness"],
      vitals: { temperature: 38.5, heartRate: 100, bloodPressure: "120/80", spO2: 93 },
      lab_results: { lactate: 1.0, CRP: 80, WBC: 12 },
      age: 55, sex: "male",
    },
  },
  {
    id: "SWEEP-LAC-3", name: "Lactate Sweep 3.0", category: "adversarial",
    expected_top1: "Sepsis", confidence: "LOW",
    input: {
      symptoms: ["fever", "cough", "breathlessness"],
      vitals: { temperature: 38.5, heartRate: 100, bloodPressure: "120/80", spO2: 93 },
      lab_results: { lactate: 3.0, CRP: 80, WBC: 12 },
      age: 55, sex: "male",
    },
  },
  {
    id: "SWEEP-LAC-5", name: "Lactate Sweep 5.0", category: "adversarial",
    expected_top1: "Sepsis", confidence: "MEDIUM",
    input: {
      symptoms: ["fever", "cough", "breathlessness"],
      vitals: { temperature: 38.5, heartRate: 100, bloodPressure: "120/80", spO2: 93 },
      lab_results: { lactate: 5.0, CRP: 80, WBC: 12 },
      age: 55, sex: "male",
    },
  },
  {
    id: "SWEEP-LAC-8", name: "Lactate Sweep 8.0", category: "adversarial",
    expected_top1: "Sepsis", confidence: "HIGH",
    input: {
      symptoms: ["fever", "cough", "breathlessness"],
      vitals: { temperature: 38.5, heartRate: 100, bloodPressure: "120/80", spO2: 93 },
      lab_results: { lactate: 8.0, CRP: 80, WBC: 12 },
      age: 55, sex: "male",
    },
  },
  {
    id: "SWEEP-LAC-10", name: "Lactate Sweep 10.0", category: "adversarial",
    expected_top1: "Sepsis", confidence: "HIGH",
    input: {
      symptoms: ["fever", "cough", "breathlessness"],
      vitals: { temperature: 38.5, heartRate: 100, bloodPressure: "120/80", spO2: 93 },
      lab_results: { lactate: 10.0, CRP: 80, WBC: 12 },
      age: 55, sex: "male",
    },
  },
  {
    id: "SWEEP-SPO2-100", name: "SpO2 Sweep 100", category: "adversarial",
    expected_top1: "Upper Respiratory Infection", confidence: "LOW",
    input: {
      symptoms: ["fever", "cough"],
      vitals: { temperature: 38.0, heartRate: 90, bloodPressure: "120/80", spO2: 100 },
      age: 45, sex: "male",
    },
  },
  {
    id: "SWEEP-SPO2-93", name: "SpO2 Sweep 93", category: "adversarial",
    expected_top1: "Community Acquired Pneumonia", confidence: "LOW",
    input: {
      symptoms: ["fever", "cough"],
      vitals: { temperature: 38.0, heartRate: 90, bloodPressure: "120/80", spO2: 93 },
      age: 45, sex: "male",
    },
  },
  {
    id: "SWEEP-SPO2-88", name: "SpO2 Sweep 88", category: "adversarial",
    expected_top1: "Community Acquired Pneumonia", confidence: "MEDIUM",
    input: {
      symptoms: ["fever", "cough"],
      vitals: { temperature: 38.0, heartRate: 90, bloodPressure: "120/80", spO2: 88 },
      age: 45, sex: "male",
    },
  },
  {
    id: "SWEEP-SPO2-85", name: "SpO2 Sweep 85", category: "adversarial",
    expected_top1: "Community Acquired Pneumonia", confidence: "HIGH",
    input: {
      symptoms: ["fever", "cough"],
      vitals: { temperature: 38.0, heartRate: 90, bloodPressure: "120/80", spO2: 85 },
      age: 45, sex: "male",
    },
  },
  {
    id: "SWEEP-SBP-80", name: "SBP Sweep 80", category: "adversarial",
    expected_top1: "Sepsis", confidence: "MEDIUM",
    input: {
      symptoms: ["fever", "chills"],
      vitals: { temperature: 38.5, heartRate: 110, bloodPressure: "80/50", spO2: 95 },
      lab_results: { WBC: 14, CRP: 100 },
      age: 55, sex: "male",
    },
  },
];
