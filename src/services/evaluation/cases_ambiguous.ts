/**
 * Ambiguous / overlapping cases (20 cases)
 * Features that map to multiple competing diagnoses.
 */
import { type EvalCase } from "./cases";

export const AMBIGUOUS_CASES: EvalCase[] = [
  {
    id: "AMB-01", name: "CAP vs COVID Overlap", category: "ambiguous",
    expected_top1: "Community Acquired Pneumonia", confidence: "LOW",
    input: {
      symptoms: ["fever", "cough", "fatigue", "breathlessness"],
      vitals: { temperature: 38.3, heartRate: 98, spO2: 93 },
      lab_results: { CRP: 60, WBC: 10 },
      age: 45, sex: "male",
    },
  },
  {
    id: "AMB-02", name: "MI vs PE Chest Pain", category: "ambiguous",
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
  {
    id: "AMB-04", name: "Viral vs Bacterial Pharyngitis", category: "ambiguous",
    expected_top1: "Upper Respiratory Infection", confidence: "LOW",
    input: {
      symptoms: ["sore throat", "fever", "fatigue"],
      vitals: { temperature: 38.2, heartRate: 85, spO2: 98 },
      lab_results: { WBC: 11, CRP: 25 },
      age: 20, sex: "female",
    },
  },
  {
    id: "AMB-05", name: "Heart Failure vs CAP", category: "ambiguous",
    expected_top1: "Heart Failure", confidence: "LOW",
    input: {
      symptoms: ["breathlessness", "cough", "fatigue"],
      vitals: { heartRate: 95, bloodPressure: "140/90", spO2: 91 },
      lab_results: { BNP: 400, CRP: 40 },
      medical_history: ["heart failure"],
      age: 72, sex: "male",
    },
  },
  {
    id: "AMB-06", name: "DKA vs Gastroenteritis", category: "ambiguous",
    expected_top1: "Diabetic Ketoacidosis", confidence: "LOW",
    input: {
      symptoms: ["nausea", "vomiting", "abdominal pain"],
      vitals: { heartRate: 105, bloodPressure: "105/65", respiratoryRate: 26 },
      medical_history: ["diabetes mellitus"],
      age: 30, sex: "male",
    },
  },
  {
    id: "AMB-07", name: "PE vs Anxiety", category: "ambiguous",
    expected_top1: "Pulmonary Embolism", confidence: "LOW",
    input: {
      symptoms: ["breathlessness", "chest pain", "tachycardia"],
      vitals: { heartRate: 105, bloodPressure: "125/80", spO2: 96 },
      risk_factors: ["recent long flight"],
      age: 35, sex: "female",
    },
  },
  {
    id: "AMB-08", name: "Meningitis vs Migraine", category: "ambiguous",
    expected_top1: "Meningitis", confidence: "LOW",
    input: {
      symptoms: ["headache", "fever", "neck stiffness"],
      vitals: { temperature: 38.5, heartRate: 95, bloodPressure: "120/80" },
      lab_results: { WBC: 14, CRP: 80 },
      age: 25, sex: "male",
    },
  },
  {
    id: "AMB-09", name: "CAP vs Asthma Exacerbation", category: "ambiguous",
    expected_top1: "Community Acquired Pneumonia", confidence: "LOW",
    input: {
      symptoms: ["cough", "breathlessness", "fever"],
      vitals: { temperature: 38.0, heartRate: 100, spO2: 92, respiratoryRate: 24 },
      lab_results: { WBC: 11, CRP: 50 },
      medical_history: ["asthma"],
      age: 35, sex: "female",
    },
  },
  {
    id: "AMB-10", name: "Sepsis vs DKA", category: "ambiguous",
    expected_top1: "Sepsis", confidence: "LOW",
    input: {
      symptoms: ["fever", "confusion", "nausea", "vomiting"],
      vitals: { temperature: 38.8, heartRate: 115, bloodPressure: "90/55", respiratoryRate: 28 },
      lab_results: { lactate: 4.0, WBC: 18 },
      medical_history: ["diabetes mellitus"],
      age: 45, sex: "male",
    },
  },
  {
    id: "AMB-11", name: "MI vs GERD", category: "ambiguous",
    expected_top1: "Myocardial Infarction", confidence: "LOW",
    input: {
      symptoms: ["chest pain", "nausea"],
      vitals: { heartRate: 80, bloodPressure: "130/85", spO2: 98 },
      lab_results: { troponin: 0.03 },
      risk_factors: ["smoking"],
      age: 50, sex: "male",
    },
  },
  {
    id: "AMB-12", name: "Heart Failure vs PE", category: "ambiguous",
    expected_top1: "Heart Failure", confidence: "LOW",
    input: {
      symptoms: ["breathlessness", "fatigue", "pedal edema"],
      vitals: { heartRate: 100, bloodPressure: "135/85", spO2: 90 },
      lab_results: { BNP: 500, D_dimer: 800 },
      medical_history: ["heart failure"],
      age: 75, sex: "male",
    },
  },
  {
    id: "AMB-13", name: "Fever + Headache Multi-Dx", category: "ambiguous",
    expected_top1: "Meningitis", confidence: "LOW",
    input: {
      symptoms: ["fever", "headache", "fatigue", "body ache"],
      vitals: { temperature: 38.5, heartRate: 90, bloodPressure: "120/75" },
      lab_results: { WBC: 12, CRP: 60 },
      age: 30, sex: "male",
    },
  },
  {
    id: "AMB-14", name: "Abdominal Pain Multi-Dx", category: "ambiguous",
    expected_top1: "Appendicitis", confidence: "LOW",
    input: {
      symptoms: ["abdominal pain", "nausea", "fever"],
      vitals: { temperature: 38.0, heartRate: 90, bloodPressure: "125/80" },
      lab_results: { WBC: 13, CRP: 45 },
      age: 22, sex: "female",
    },
  },
  {
    id: "AMB-15", name: "COVID vs Influenza", category: "ambiguous",
    expected_top1: "COVID-19", confidence: "LOW",
    input: {
      symptoms: ["fever", "cough", "body ache", "fatigue"],
      vitals: { temperature: 38.5, heartRate: 90, spO2: 96 },
      lab_results: { CRP: 30, WBC: 6 },
      age: 35, sex: "male",
    },
  },
  {
    id: "AMB-16", name: "Sepsis vs UTI", category: "ambiguous",
    expected_top1: "Sepsis", confidence: "LOW",
    input: {
      symptoms: ["fever", "chills", "reduced urine"],
      vitals: { temperature: 38.8, heartRate: 100, bloodPressure: "100/65" },
      lab_results: { WBC: 16, CRP: 100 },
      age: 65, sex: "female",
    },
  },
  {
    id: "AMB-17", name: "Chest Pain Undifferentiated", category: "ambiguous",
    expected_top1: "Myocardial Infarction", confidence: "LOW",
    input: {
      symptoms: ["chest pain"],
      vitals: { heartRate: 85, bloodPressure: "130/80", spO2: 97 },
      age: 50, sex: "male",
    },
  },
  {
    id: "AMB-18", name: "Cough + Fever Multi-Dx", category: "ambiguous",
    expected_top1: "Community Acquired Pneumonia", confidence: "LOW",
    input: {
      symptoms: ["cough", "fever"],
      vitals: { temperature: 38.3, heartRate: 92, spO2: 95 },
      age: 45, sex: "female",
    },
  },
  {
    id: "AMB-19", name: "Dyspnea Undifferentiated", category: "ambiguous",
    expected_top1: "Heart Failure", confidence: "LOW",
    input: {
      symptoms: ["breathlessness", "fatigue"],
      vitals: { heartRate: 95, bloodPressure: "140/90", spO2: 93 },
      lab_results: { BNP: 300 },
      age: 65, sex: "male",
    },
  },
  {
    id: "AMB-20", name: "Fever + Confusion Multi-Dx", category: "ambiguous",
    expected_top1: "Sepsis", confidence: "LOW",
    input: {
      symptoms: ["fever", "confusion"],
      vitals: { temperature: 39.0, heartRate: 105, bloodPressure: "100/65" },
      lab_results: { WBC: 16, CRP: 130 },
      age: 70, sex: "male",
    },
  },
];
