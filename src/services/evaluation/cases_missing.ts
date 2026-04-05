/**
 * Missing data cases (15 cases)
 * Tests robustness when labs, vitals, or both are absent.
 */
import { type EvalCase } from "./cases";

export const MISSING_DATA_CASES: EvalCase[] = [
  {
    id: "MISS-01", name: "Symptoms Only — URI", category: "missing_data",
    expected_top1: "Upper Respiratory Infection", confidence: "LOW",
    input: { symptoms: ["fever", "cough", "sore throat"], age: 30, sex: "female" },
  },
  {
    id: "MISS-02", name: "No Labs — CAP", category: "missing_data",
    expected_top1: "Community Acquired Pneumonia", confidence: "LOW",
    input: {
      symptoms: ["fever", "cough", "breathlessness"],
      vitals: { temperature: 38.5, heartRate: 100, spO2: 92 },
      age: 60, sex: "male",
    },
  },
  {
    id: "MISS-03", name: "Symptoms Only — MI", category: "missing_data",
    expected_top1: "Myocardial Infarction", confidence: "LOW",
    input: {
      symptoms: ["chest pain", "sweating", "nausea"],
      risk_factors: ["diabetes", "hypertension"],
      age: 60, sex: "male",
    },
  },
  {
    id: "MISS-04", name: "No Labs — Sepsis", category: "missing_data",
    expected_top1: "Sepsis", confidence: "LOW",
    input: {
      symptoms: ["fever", "chills", "confusion", "tachycardia"],
      vitals: { temperature: 39.5, heartRate: 120, bloodPressure: "85/55" },
      age: 70, sex: "female",
    },
  },
  {
    id: "MISS-05", name: "Vitals Only — Respiratory", category: "missing_data",
    expected_top1: "Community Acquired Pneumonia", confidence: "LOW",
    input: {
      symptoms: ["cough", "breathlessness"],
      vitals: { temperature: 38.0, spO2: 91 },
      age: 55, sex: "male",
    },
  },
  {
    id: "MISS-06", name: "No Age/Sex — DKA", category: "missing_data",
    expected_top1: "Diabetic Ketoacidosis", confidence: "LOW",
    input: {
      symptoms: ["nausea", "vomiting", "abdominal pain", "confusion"],
      vitals: { heartRate: 110, bloodPressure: "100/65", respiratoryRate: 28 },
      medical_history: ["diabetes mellitus"],
    },
  },
  {
    id: "MISS-07", name: "Minimal Symptoms — HF", category: "missing_data",
    expected_top1: "Heart Failure", confidence: "LOW",
    input: {
      symptoms: ["breathlessness", "pedal edema"],
      medical_history: ["heart failure"],
      age: 70, sex: "male",
    },
  },
  {
    id: "MISS-08", name: "No Vitals — Gastro", category: "missing_data",
    expected_top1: "Gastroenteritis", confidence: "LOW",
    input: {
      symptoms: ["diarrhea", "vomiting", "abdominal pain"],
      age: 25, sex: "female",
    },
  },
  {
    id: "MISS-09", name: "Labs Only — Sepsis", category: "missing_data",
    expected_top1: "Sepsis", confidence: "LOW",
    input: {
      symptoms: ["fever", "chills"],
      lab_results: { lactate: 5.0, WBC: 20, CRP: 200, procalcitonin: 10 },
      age: 60, sex: "male",
    },
  },
  {
    id: "MISS-10", name: "No Labs No History — CAP", category: "missing_data",
    expected_top1: "Community Acquired Pneumonia", confidence: "LOW",
    input: {
      symptoms: ["fever", "cough", "breathlessness", "chest pain"],
      vitals: { temperature: 38.5, heartRate: 100, spO2: 91 },
      age: 50, sex: "male",
    },
  },
  {
    id: "MISS-11", name: "Single Symptom — Chest Pain", category: "missing_data",
    expected_top1: "Myocardial Infarction", confidence: "LOW",
    input: {
      symptoms: ["chest pain"],
      age: 55, sex: "male",
    },
  },
  {
    id: "MISS-12", name: "Single Symptom — Fever", category: "missing_data",
    expected_top1: "Upper Respiratory Infection", confidence: "LOW",
    input: {
      symptoms: ["fever"],
      age: 30, sex: "female",
    },
  },
  {
    id: "MISS-13", name: "Partial Vitals — PE", category: "missing_data",
    expected_top1: "Pulmonary Embolism", confidence: "LOW",
    input: {
      symptoms: ["breathlessness", "chest pain"],
      vitals: { heartRate: 115 },
      risk_factors: ["recent surgery"],
      age: 45, sex: "female",
    },
  },
  {
    id: "MISS-14", name: "No Context — Headache", category: "missing_data",
    expected_top1: "Meningitis", confidence: "LOW",
    input: {
      symptoms: ["headache", "fever"],
      age: 25, sex: "male",
    },
  },
  {
    id: "MISS-15", name: "Symptoms + History Only — HF", category: "missing_data",
    expected_top1: "Heart Failure", confidence: "LOW",
    input: {
      symptoms: ["breathlessness", "fatigue", "pedal edema", "orthopnea"],
      medical_history: ["heart failure", "hypertension"],
      age: 68, sex: "female",
    },
  },
];
