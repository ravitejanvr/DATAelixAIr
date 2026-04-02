/**
 * Deterministic Validation Suite — Clinical Scenarios
 */
import type { ValidationScenario } from "./types";

export const VALIDATION_SCENARIOS: ValidationScenario[] = [
  {
    id: "sepsis",
    name: "Sepsis",
    clinical_context: {
      chief_complaint: "High fever with confusion and low blood pressure",
      symptoms: ["fever", "chills", "confusion", "shortness of breath", "reduced urine output"],
      age: 58,
      sex: "male",
      vitals: { temperature: 39.2, heartRate: 120, bloodPressure: "90/60", respiratoryRate: 26, spo2: 92 },
      medical_history: ["diabetes", "recent urinary tract infection"],
      duration: "2 days",
    },
    expected_top_diagnosis: "sepsis",
    sensitivity_variant: {
      label: "Remove fever + lower HR",
      overrides: {
        symptoms: ["chills", "confusion", "shortness of breath", "reduced urine output"],
        vitals: { temperature: 37.0, heartRate: 85, bloodPressure: "90/60", respiratoryRate: 26, spo2: 92 },
      },
      expected_effect: "decrease",
      target_diagnosis: "sepsis",
    },
  },
  {
    id: "migraine",
    name: "Migraine",
    clinical_context: {
      chief_complaint: "Severe unilateral headache with nausea and light sensitivity",
      symptoms: ["headache", "nausea", "photophobia", "throbbing pain", "aura"],
      age: 32,
      sex: "female",
      vitals: { temperature: 36.8, heartRate: 78, bloodPressure: "120/80", respiratoryRate: 16, spo2: 99 },
      medical_history: ["migraine history"],
      duration: "6 hours",
    },
    expected_top_diagnosis: "migraine",
    sensitivity_variant: {
      label: "Add neck stiffness + fever",
      overrides: {
        symptoms: ["headache", "nausea", "photophobia", "neck stiffness", "fever"],
        vitals: { temperature: 39.0, heartRate: 95, bloodPressure: "120/80", respiratoryRate: 18, spo2: 98 },
      },
      expected_effect: "decrease",
      target_diagnosis: "migraine",
    },
  },
  {
    id: "acs",
    name: "Acute Coronary Syndrome",
    clinical_context: {
      chief_complaint: "Crushing chest pain radiating to left arm with sweating",
      symptoms: ["chest pain", "left arm pain", "sweating", "nausea", "shortness of breath"],
      age: 62,
      sex: "male",
      vitals: { temperature: 37.0, heartRate: 105, bloodPressure: "150/95", respiratoryRate: 22, spo2: 95 },
      medical_history: ["hypertension", "hyperlipidemia", "smoking"],
      duration: "1 hour",
    },
    expected_top_diagnosis: "acute coronary syndrome",
    sensitivity_variant: {
      label: "Remove chest pain + sweating",
      overrides: {
        symptoms: ["nausea", "shortness of breath", "fatigue"],
      },
      expected_effect: "decrease",
      target_diagnosis: "acute coronary syndrome",
    },
  },
  {
    id: "pneumonia",
    name: "Pneumonia",
    clinical_context: {
      chief_complaint: "Productive cough with fever and difficulty breathing",
      symptoms: ["cough", "fever", "dyspnea", "chest pain", "sputum production"],
      age: 45,
      sex: "male",
      vitals: { temperature: 38.8, heartRate: 98, bloodPressure: "130/85", respiratoryRate: 24, spo2: 93 },
      medical_history: ["COPD"],
      duration: "5 days",
    },
    expected_top_diagnosis: "pneumonia",
    sensitivity_variant: {
      label: "Remove fever + normalize SpO2",
      overrides: {
        vitals: { temperature: 36.9, heartRate: 80, bloodPressure: "125/80", respiratoryRate: 16, spo2: 98 },
        symptoms: ["cough", "mild chest discomfort"],
      },
      expected_effect: "decrease",
      target_diagnosis: "pneumonia",
    },
  },
  {
    id: "appendicitis",
    name: "Appendicitis",
    clinical_context: {
      chief_complaint: "Right lower abdominal pain with nausea and fever",
      symptoms: ["abdominal pain", "right lower quadrant pain", "nausea", "vomiting", "fever", "loss of appetite"],
      age: 25,
      sex: "male",
      vitals: { temperature: 38.2, heartRate: 92, bloodPressure: "125/80", respiratoryRate: 18, spo2: 98 },
      medical_history: [],
      duration: "12 hours",
    },
    expected_top_diagnosis: "appendicitis",
    sensitivity_variant: {
      label: "Move pain to epigastric",
      overrides: {
        symptoms: ["abdominal pain", "epigastric pain", "nausea", "bloating"],
        chief_complaint: "Epigastric pain with nausea and bloating",
      },
      expected_effect: "decrease",
      target_diagnosis: "appendicitis",
    },
  },
  {
    id: "pulmonary_embolism",
    name: "Pulmonary Embolism",
    clinical_context: {
      chief_complaint: "Sudden shortness of breath with pleuritic chest pain",
      symptoms: ["dyspnea", "pleuritic chest pain", "tachycardia", "hemoptysis", "leg swelling"],
      age: 50,
      sex: "female",
      vitals: { temperature: 37.2, heartRate: 115, bloodPressure: "110/70", respiratoryRate: 28, spo2: 90 },
      medical_history: ["recent surgery", "oral contraceptive use"],
      duration: "3 hours",
    },
    expected_top_diagnosis: "pulmonary embolism",
    sensitivity_variant: {
      label: "Remove tachycardia + hemoptysis",
      overrides: {
        symptoms: ["dyspnea", "mild chest discomfort"],
        vitals: { temperature: 37.0, heartRate: 82, bloodPressure: "120/75", respiratoryRate: 18, spo2: 97 },
      },
      expected_effect: "decrease",
      target_diagnosis: "pulmonary embolism",
    },
  },
];
