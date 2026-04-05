/**
 * Noisy / conflicting signal cases (15 cases)
 * Tests engine behavior with contradictory or misleading features.
 */
import { type EvalCase } from "./cases";

export const NOISY_CASES: EvalCase[] = [
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
  {
    id: "NOISE-03", name: "High CRP Normal vitals", category: "noisy",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["fatigue", "body ache"],
      vitals: { temperature: 37.0, heartRate: 75, bloodPressure: "120/80", spO2: 98 },
      lab_results: { CRP: 150, WBC: 8 },
      age: 45, sex: "female",
    },
  },
  {
    id: "NOISE-04", name: "Hypotension without infection", category: "noisy",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["fatigue", "dizziness"],
      vitals: { heartRate: 65, bloodPressure: "80/50", spO2: 98, temperature: 36.8 },
      age: 30, sex: "female",
    },
  },
  {
    id: "NOISE-05", name: "Tachycardia without clear cause", category: "noisy",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["palpitations"],
      vitals: { heartRate: 120, bloodPressure: "125/80", spO2: 98, temperature: 36.9 },
      age: 28, sex: "female",
    },
  },
  {
    id: "NOISE-06", name: "High WBC Normal everything else", category: "noisy",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["fatigue"],
      vitals: { temperature: 37.0, heartRate: 78, bloodPressure: "120/80", spO2: 99 },
      lab_results: { WBC: 22 },
      age: 50, sex: "male",
    },
  },
  {
    id: "NOISE-07", name: "Contradictory: Fever + Bradycardia", category: "noisy",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["fever"],
      vitals: { temperature: 39.0, heartRate: 55, bloodPressure: "120/80", spO2: 98 },
      age: 40, sex: "male",
    },
  },
  {
    id: "NOISE-08", name: "CAP symptoms + normal CRP", category: "noisy",
    expected_top1: "Community Acquired Pneumonia", confidence: "LOW",
    input: {
      symptoms: ["fever", "cough", "breathlessness"],
      vitals: { temperature: 38.2, heartRate: 95, spO2: 93, respiratoryRate: 22 },
      lab_results: { CRP: 5, WBC: 7 },
      age: 50, sex: "male",
    },
  },
  {
    id: "NOISE-09", name: "Sepsis labs + No systemic symptoms", category: "noisy",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["fatigue"],
      vitals: { temperature: 37.2, heartRate: 80, bloodPressure: "120/80", spO2: 98 },
      lab_results: { lactate: 4.0, WBC: 18, CRP: 160, procalcitonin: 5 },
      age: 55, sex: "male",
    },
  },
  {
    id: "NOISE-10", name: "Mixed cardiac + respiratory", category: "noisy",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["chest pain", "breathlessness", "cough"],
      vitals: { heartRate: 100, bloodPressure: "130/85", spO2: 93 },
      lab_results: { troponin: 0.05, CRP: 40 },
      age: 60, sex: "male",
    },
  },
  {
    id: "NOISE-11", name: "High procalcitonin + no fever", category: "noisy",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["fatigue"],
      vitals: { temperature: 36.5, heartRate: 70, bloodPressure: "120/80", spO2: 99 },
      lab_results: { procalcitonin: 8.0 },
      age: 45, sex: "male",
    },
  },
  {
    id: "NOISE-12", name: "Low SpO2 + Normal everything else", category: "noisy",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["fatigue"],
      vitals: { temperature: 37.0, heartRate: 75, bloodPressure: "120/80", spO2: 88 },
      age: 40, sex: "male",
    },
  },
  {
    id: "NOISE-13", name: "BNP elevated no HF symptoms", category: "noisy",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["fatigue"],
      vitals: { heartRate: 80, bloodPressure: "130/85", spO2: 97 },
      lab_results: { BNP: 500 },
      age: 65, sex: "male",
    },
  },
  {
    id: "NOISE-14", name: "D-dimer elevated no PE features", category: "noisy",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["fatigue", "body ache"],
      vitals: { heartRate: 80, bloodPressure: "120/80", spO2: 98 },
      lab_results: { D_dimer: 2000 },
      age: 50, sex: "female",
    },
  },
  {
    id: "NOISE-15", name: "Multiple contradictory signals", category: "noisy",
    expected_top1: "Unknown", confidence: "LOW",
    input: {
      symptoms: ["chest pain", "abdominal pain", "headache", "cough"],
      vitals: { temperature: 37.5, heartRate: 90, bloodPressure: "125/80", spO2: 96 },
      lab_results: { troponin: 0.04, CRP: 30, WBC: 10 },
      age: 45, sex: "female",
    },
  },
];
