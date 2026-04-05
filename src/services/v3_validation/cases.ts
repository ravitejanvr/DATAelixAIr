/**
 * V3 Validation Cases — 30+ structured cases across 3 categories
 * Uses engine-direct format (symptoms/vitals/labs → V3 edge function)
 */
import type { V3ValidationCase } from "./types";

// ═══════════════════════════════════════
// STRONG SYSTEMIC (10 cases) — Sepsis/systemic must rank #1
// ═══════════════════════════════════════
const SYSTEMIC_CASES: V3ValidationCase[] = [
  {
    id: "sys_sepsis_full",
    name: "Sepsis — Full presentation with lactate",
    category: "strong_systemic",
    expected_top1: "sepsis",
    input: {
      symptoms: ["fever", "chills", "confusion", "shortness of breath", "reduced urine output"],
      vitals: { temperature: 39.2, heartRate: 120, blood_pressure_systolic: 90, respiratoryRate: 26, spo2: 92 },
      medical_history: ["diabetes", "recent urinary tract infection"],
      age: 58, sex: "male", duration: "2 days",
    },
  },
  {
    id: "sys_sepsis_no_lactate",
    name: "Sepsis — No lactate, vitals only",
    category: "strong_systemic",
    expected_top1: "sepsis",
    input: {
      symptoms: ["fever", "chills", "confusion", "shortness of breath", "reduced urine output"],
      vitals: { temperature: 39.5, heartRate: 125, blood_pressure_systolic: 85, respiratoryRate: 28, spo2: 90 },
      medical_history: ["diabetes"],
      age: 62, sex: "male", duration: "1 day",
    },
  },
  {
    id: "sys_septic_shock",
    name: "Septic Shock — Extreme vitals",
    category: "strong_systemic",
    expected_top1: "sepsis",
    input: {
      symptoms: ["fever", "confusion", "cold extremities", "reduced urine output", "shortness of breath"],
      vitals: { temperature: 39.8, heartRate: 135, blood_pressure_systolic: 70, respiratoryRate: 32, spo2: 86 },
      medical_history: ["diabetes", "chronic kidney disease"],
      age: 70, sex: "male", duration: "12 hours",
    },
  },
  {
    id: "sys_sepsis_uti_source",
    name: "Sepsis — UTI source, elderly female",
    category: "strong_systemic",
    expected_top1: "sepsis",
    input: {
      symptoms: ["fever", "confusion", "dysuria", "reduced urine output", "chills"],
      vitals: { temperature: 38.8, heartRate: 110, blood_pressure_systolic: 88, respiratoryRate: 24, spo2: 93 },
      medical_history: ["recurrent UTIs", "diabetes"],
      age: 78, sex: "female", duration: "1 day",
    },
  },
  {
    id: "sys_sepsis_wound",
    name: "Sepsis — Wound infection source",
    category: "strong_systemic",
    expected_top1: "sepsis",
    input: {
      symptoms: ["fever", "wound infection", "chills", "confusion", "shortness of breath"],
      vitals: { temperature: 39.0, heartRate: 118, blood_pressure_systolic: 92, respiratoryRate: 25, spo2: 93 },
      medical_history: ["diabetes", "peripheral vascular disease"],
      age: 65, sex: "male", duration: "2 days",
    },
  },
  {
    id: "sys_sepsis_low_temp",
    name: "Sepsis — Hypothermic presentation (elderly)",
    category: "strong_systemic",
    expected_top1: "sepsis",
    input: {
      symptoms: ["confusion", "chills", "reduced urine output", "weakness"],
      vitals: { temperature: 35.2, heartRate: 115, blood_pressure_systolic: 82, respiratoryRate: 26, spo2: 91 },
      medical_history: ["diabetes", "immunosuppression"],
      age: 80, sex: "female", duration: "1 day",
    },
  },
  {
    id: "sys_sepsis_resp_source",
    name: "Sepsis — Respiratory source (not CAP)",
    category: "strong_systemic",
    expected_top1: "sepsis",
    input: {
      symptoms: ["fever", "cough", "confusion", "shortness of breath", "reduced urine output", "chills"],
      vitals: { temperature: 39.3, heartRate: 122, blood_pressure_systolic: 88, respiratoryRate: 28, spo2: 89 },
      medical_history: ["COPD", "diabetes"],
      age: 68, sex: "male", duration: "2 days",
    },
  },
  {
    id: "sys_multi_organ",
    name: "Multi-organ dysfunction",
    category: "strong_systemic",
    expected_top1: "sepsis",
    input: {
      symptoms: ["fever", "confusion", "reduced urine output", "shortness of breath", "jaundice"],
      vitals: { temperature: 39.5, heartRate: 130, blood_pressure_systolic: 75, respiratoryRate: 30, spo2: 87 },
      medical_history: ["diabetes", "chronic liver disease"],
      age: 60, sex: "male", duration: "1 day",
    },
  },
  {
    id: "sys_qsofa_3",
    name: "qSOFA 3/3 — All criteria met",
    category: "strong_systemic",
    expected_top1: "sepsis",
    input: {
      symptoms: ["fever", "confusion", "shortness of breath"],
      vitals: { temperature: 38.5, heartRate: 108, blood_pressure_systolic: 95, respiratoryRate: 24, spo2: 94 },
      medical_history: [],
      age: 55, sex: "male", duration: "1 day",
    },
  },
  {
    id: "sys_sepsis_abdominal",
    name: "Sepsis — Abdominal source",
    category: "strong_systemic",
    expected_top1: "sepsis",
    input: {
      symptoms: ["fever", "abdominal pain", "confusion", "vomiting", "chills"],
      vitals: { temperature: 39.2, heartRate: 120, blood_pressure_systolic: 85, respiratoryRate: 26, spo2: 92 },
      medical_history: ["recent abdominal surgery"],
      age: 55, sex: "male", duration: "1 day",
    },
  },
];

// ═══════════════════════════════════════
// PURE LOCAL (10 cases) — Local diagnosis must rank #1, no systemic override
// ═══════════════════════════════════════
const LOCAL_CASES: V3ValidationCase[] = [
  {
    id: "loc_cap_clear",
    name: "CAP — Clear respiratory, stable vitals",
    category: "pure_local",
    expected_top1: "pneumonia",
    input: {
      symptoms: ["cough", "fever", "dyspnea", "chest pain", "sputum production"],
      vitals: { temperature: 38.5, heartRate: 96, blood_pressure_systolic: 130, respiratoryRate: 22, spo2: 94 },
      medical_history: ["COPD"],
      age: 45, sex: "male", duration: "5 days",
    },
  },
  {
    id: "loc_urti",
    name: "Viral URTI — No systemic features",
    category: "pure_local",
    expected_top1: "upper respiratory infection",
    input: {
      symptoms: ["cough", "sore throat", "runny nose", "sneezing"],
      vitals: { temperature: 37.5, heartRate: 78, blood_pressure_systolic: 120, respiratoryRate: 16, spo2: 99 },
      medical_history: [],
      age: 30, sex: "male", duration: "3 days",
    },
  },
  {
    id: "loc_gastroenteritis",
    name: "Acute Gastroenteritis",
    category: "pure_local",
    expected_top1: "gastroenteritis",
    input: {
      symptoms: ["diarrhea", "vomiting", "abdominal pain", "nausea"],
      vitals: { temperature: 38.0, heartRate: 92, blood_pressure_systolic: 115, respiratoryRate: 16, spo2: 99 },
      medical_history: [],
      age: 28, sex: "female", duration: "1 day",
    },
  },
  {
    id: "loc_appendicitis",
    name: "Appendicitis — Classic RLQ",
    category: "pure_local",
    expected_top1: "appendicitis",
    input: {
      symptoms: ["abdominal pain", "right lower quadrant pain", "nausea", "vomiting", "fever"],
      vitals: { temperature: 38.2, heartRate: 92, blood_pressure_systolic: 125, respiratoryRate: 18, spo2: 98 },
      medical_history: [],
      age: 25, sex: "male", duration: "12 hours",
    },
  },
  {
    id: "loc_migraine",
    name: "Migraine — Typical with aura",
    category: "pure_local",
    expected_top1: "migraine",
    input: {
      symptoms: ["headache", "nausea", "photophobia", "throbbing pain", "aura"],
      vitals: { temperature: 36.8, heartRate: 78, blood_pressure_systolic: 120, respiratoryRate: 16, spo2: 99 },
      medical_history: ["migraine history"],
      age: 32, sex: "female", duration: "6 hours",
    },
  },
  {
    id: "loc_cellulitis",
    name: "Cellulitis — Localized infection",
    category: "pure_local",
    expected_top1: "cellulitis",
    input: {
      symptoms: ["rash", "swelling", "warmth", "pain", "fever"],
      vitals: { temperature: 38.3, heartRate: 88, blood_pressure_systolic: 130, respiratoryRate: 16, spo2: 99 },
      medical_history: ["diabetes"],
      age: 55, sex: "male", duration: "3 days",
    },
  },
  {
    id: "loc_kidney_stone",
    name: "Renal Colic — Flank pain",
    category: "pure_local",
    expected_top1: "renal colic",
    input: {
      symptoms: ["flank pain", "groin pain", "nausea", "vomiting", "hematuria"],
      vitals: { temperature: 37.0, heartRate: 100, blood_pressure_systolic: 145, respiratoryRate: 20, spo2: 99 },
      medical_history: ["previous kidney stones"],
      age: 38, sex: "male", duration: "4 hours",
    },
  },
  {
    id: "loc_cholecystitis",
    name: "Acute Cholecystitis — RUQ pain",
    category: "pure_local",
    expected_top1: "cholecystitis",
    input: {
      symptoms: ["right upper quadrant pain", "nausea", "vomiting", "fever"],
      vitals: { temperature: 38.5, heartRate: 96, blood_pressure_systolic: 130, respiratoryRate: 18, spo2: 98 },
      medical_history: ["gallstones"],
      age: 42, sex: "female", duration: "12 hours",
    },
  },
  {
    id: "loc_gout",
    name: "Acute Gout — Joint only",
    category: "pure_local",
    expected_top1: "gout",
    input: {
      symptoms: ["joint pain", "swelling", "redness", "warmth"],
      vitals: { temperature: 37.2, heartRate: 80, blood_pressure_systolic: 140, respiratoryRate: 16, spo2: 99 },
      medical_history: ["hypertension", "high uric acid"],
      age: 55, sex: "male", duration: "12 hours",
    },
  },
  {
    id: "loc_pyelonephritis",
    name: "Pyelonephritis — Localized UTI",
    category: "pure_local",
    expected_top1: "pyelonephritis",
    input: {
      symptoms: ["fever", "flank pain", "dysuria", "frequency", "nausea"],
      vitals: { temperature: 39.0, heartRate: 98, blood_pressure_systolic: 120, respiratoryRate: 18, spo2: 98 },
      medical_history: ["recurrent UTIs"],
      age: 30, sex: "female", duration: "2 days",
    },
  },
];

// ═══════════════════════════════════════
// AMBIGUOUS / OVERLAP (10 cases) — Top-3 inclusion sufficient
// ═══════════════════════════════════════
const AMBIGUOUS_CASES: V3ValidationCase[] = [
  {
    id: "amb_cap_vs_sepsis",
    name: "CAP vs Sepsis — Respiratory with systemic signs",
    category: "ambiguous_overlap",
    expected_top1: "sepsis",
    top3_sufficient: true,
    input: {
      symptoms: ["cough", "fever", "confusion", "shortness of breath", "chills"],
      vitals: { temperature: 38.8, heartRate: 110, blood_pressure_systolic: 95, respiratoryRate: 24, spo2: 92 },
      medical_history: ["COPD"],
      age: 65, sex: "male", duration: "3 days",
    },
  },
  {
    id: "amb_viral_vs_bacterial",
    name: "Viral vs Bacterial — Ambiguous fever",
    category: "ambiguous_overlap",
    expected_top1: "viral infection",
    top3_sufficient: true,
    input: {
      symptoms: ["fever", "fatigue", "body aches", "headache"],
      vitals: { temperature: 38.5, heartRate: 90, blood_pressure_systolic: 120, respiratoryRate: 18, spo2: 98 },
      medical_history: [],
      age: 35, sex: "male", duration: "3 days",
    },
  },
  {
    id: "amb_early_sepsis",
    name: "Early Sepsis — Partial vitals only",
    category: "ambiguous_overlap",
    expected_top1: "sepsis",
    top3_sufficient: true,
    input: {
      symptoms: ["fever", "chills", "fatigue", "mild confusion"],
      vitals: { temperature: 38.3, heartRate: 100, blood_pressure_systolic: 105, respiratoryRate: 20, spo2: 96 },
      medical_history: ["diabetes"],
      age: 60, sex: "male", duration: "1 day",
    },
  },
  {
    id: "amb_acs_vs_pe",
    name: "ACS vs PE — Chest pain + dyspnea",
    category: "ambiguous_overlap",
    expected_top1: "acute coronary syndrome",
    top3_sufficient: true,
    input: {
      symptoms: ["chest pain", "shortness of breath", "sweating", "tachycardia"],
      vitals: { temperature: 37.0, heartRate: 108, blood_pressure_systolic: 140, respiratoryRate: 22, spo2: 94 },
      medical_history: ["hypertension", "smoking"],
      age: 58, sex: "male", duration: "2 hours",
    },
  },
  {
    id: "amb_meningitis_vs_migraine",
    name: "Meningitis vs Migraine — Headache + fever",
    category: "ambiguous_overlap",
    expected_top1: "meningitis",
    top3_sufficient: true,
    input: {
      symptoms: ["headache", "neck stiffness", "photophobia", "nausea", "fever"],
      vitals: { temperature: 39.0, heartRate: 100, blood_pressure_systolic: 125, respiratoryRate: 20, spo2: 98 },
      medical_history: [],
      age: 22, sex: "male", duration: "12 hours",
    },
  },
  {
    id: "amb_uti_vs_sepsis",
    name: "UTI vs Sepsis — Urinary symptoms + mild systemic",
    category: "ambiguous_overlap",
    expected_top1: "urinary tract infection",
    top3_sufficient: true,
    input: {
      symptoms: ["fever", "dysuria", "frequency", "mild confusion"],
      vitals: { temperature: 38.5, heartRate: 95, blood_pressure_systolic: 110, respiratoryRate: 18, spo2: 97 },
      medical_history: ["diabetes"],
      age: 72, sex: "female", duration: "2 days",
    },
  },
  {
    id: "amb_pneumonia_vs_pe",
    name: "Pneumonia vs PE — Dyspnea + pleuritic pain",
    category: "ambiguous_overlap",
    expected_top1: "pneumonia",
    top3_sufficient: true,
    input: {
      symptoms: ["dyspnea", "chest pain", "cough", "fever", "tachycardia"],
      vitals: { temperature: 38.2, heartRate: 108, blood_pressure_systolic: 118, respiratoryRate: 24, spo2: 92 },
      medical_history: ["recent long-haul flight"],
      age: 42, sex: "female", duration: "2 days",
    },
  },
  {
    id: "amb_pancreatitis_vs_cholecystitis",
    name: "Pancreatitis vs Cholecystitis — Abdominal pain",
    category: "ambiguous_overlap",
    expected_top1: "acute pancreatitis",
    top3_sufficient: true,
    input: {
      symptoms: ["epigastric pain", "vomiting", "nausea", "back pain"],
      vitals: { temperature: 37.8, heartRate: 100, blood_pressure_systolic: 115, respiratoryRate: 20, spo2: 98 },
      medical_history: ["alcohol use", "gallstones"],
      age: 48, sex: "male", duration: "8 hours",
    },
  },
  {
    id: "amb_dka_vs_gastro",
    name: "DKA vs Gastroenteritis — Vomiting + abdominal pain",
    category: "ambiguous_overlap",
    expected_top1: "diabetic ketoacidosis",
    top3_sufficient: true,
    input: {
      symptoms: ["nausea", "vomiting", "abdominal pain", "deep breathing", "fatigue"],
      vitals: { temperature: 37.2, heartRate: 112, blood_pressure_systolic: 105, respiratoryRate: 30, spo2: 99 },
      medical_history: ["type 1 diabetes"],
      age: 22, sex: "male", duration: "1 day",
    },
  },
  {
    id: "amb_chf_vs_pneumonia",
    name: "CHF vs Pneumonia — Dyspnea + cough",
    category: "ambiguous_overlap",
    expected_top1: "heart failure",
    top3_sufficient: true,
    input: {
      symptoms: ["dyspnea", "cough", "leg swelling", "fatigue", "orthopnea"],
      vitals: { temperature: 37.0, heartRate: 98, blood_pressure_systolic: 155, respiratoryRate: 24, spo2: 91 },
      medical_history: ["heart failure", "hypertension"],
      age: 72, sex: "male", duration: "5 days",
    },
  },
];

export const V3_VALIDATION_CASES: V3ValidationCase[] = [
  ...SYSTEMIC_CASES,
  ...LOCAL_CASES,
  ...AMBIGUOUS_CASES,
];
