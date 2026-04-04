/**
 * Deterministic Validation Suite — Clinical Scenarios
 * 50+ structured cases covering: core, conflicting, ambiguous, low-signal,
 * age/sex variants, and multi-system presentations.
 */
import type { ValidationScenario } from "./types";

export const VALIDATION_SCENARIOS: ValidationScenario[] = [
  // ═══════════════════════════════════════════
  // CORE SCENARIOS (6 original)
  // ═══════════════════════════════════════════
  {
    id: "sepsis",
    name: "Sepsis",
    clinical_context: {
      chief_complaint: "High fever with confusion and low blood pressure",
      symptoms: ["fever", "chills", "confusion", "shortness of breath", "reduced urine output"],
      age: 58, sex: "male",
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
      age: 32, sex: "female",
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
      age: 62, sex: "male",
      vitals: { temperature: 37.0, heartRate: 105, bloodPressure: "150/95", respiratoryRate: 22, spo2: 95 },
      medical_history: ["hypertension", "hyperlipidemia", "smoking"],
      duration: "1 hour",
    },
    expected_top_diagnosis: "acute coronary syndrome",
    sensitivity_variant: {
      label: "Remove chest pain + sweating",
      overrides: { symptoms: ["nausea", "shortness of breath", "fatigue"] },
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
      age: 45, sex: "male",
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
      age: 25, sex: "male",
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
      age: 50, sex: "female",
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

  // ═══════════════════════════════════════════
  // CONFLICTING EVIDENCE SCENARIOS
  // ═══════════════════════════════════════════
  {
    id: "conflict_sepsis_vs_acs",
    name: "Conflicting: Sepsis vs ACS",
    clinical_context: {
      chief_complaint: "Chest pain with fever, confusion, and low blood pressure",
      symptoms: ["chest pain", "fever", "confusion", "hypotension", "sweating", "shortness of breath"],
      age: 65, sex: "male",
      vitals: { temperature: 38.8, heartRate: 118, bloodPressure: "85/55", respiratoryRate: 26, spo2: 91 },
      medical_history: ["diabetes", "hypertension", "coronary artery disease"],
      duration: "6 hours",
    },
    expected_top_diagnosis: "sepsis",
    sensitivity_variant: {
      label: "Remove fever → ACS should rise",
      overrides: {
        symptoms: ["chest pain", "confusion", "hypotension", "sweating", "shortness of breath"],
        vitals: { temperature: 37.0, heartRate: 118, bloodPressure: "85/55", respiratoryRate: 26, spo2: 91 },
      },
      expected_effect: "decrease",
      target_diagnosis: "sepsis",
    },
  },
  {
    id: "conflict_pneumonia_vs_pe",
    name: "Conflicting: Pneumonia vs PE",
    clinical_context: {
      chief_complaint: "Shortness of breath with pleuritic chest pain and cough",
      symptoms: ["dyspnea", "pleuritic chest pain", "cough", "fever", "tachycardia"],
      age: 42, sex: "female",
      vitals: { temperature: 38.2, heartRate: 108, bloodPressure: "118/72", respiratoryRate: 24, spo2: 92 },
      medical_history: ["recent long-haul flight"],
      duration: "2 days",
    },
    expected_top_diagnosis: "pneumonia",
    sensitivity_variant: {
      label: "Remove fever + add leg swelling → PE rises",
      overrides: {
        symptoms: ["dyspnea", "pleuritic chest pain", "tachycardia", "leg swelling"],
        vitals: { temperature: 37.0, heartRate: 108, bloodPressure: "118/72", respiratoryRate: 24, spo2: 92 },
      },
      expected_effect: "decrease",
      target_diagnosis: "pneumonia",
    },
  },
  {
    id: "conflict_meningitis_vs_migraine",
    name: "Conflicting: Meningitis vs Migraine",
    clinical_context: {
      chief_complaint: "Severe headache with neck stiffness and photophobia",
      symptoms: ["headache", "neck stiffness", "photophobia", "nausea", "fever"],
      age: 22, sex: "male",
      vitals: { temperature: 39.1, heartRate: 102, bloodPressure: "125/78", respiratoryRate: 20, spo2: 98 },
      medical_history: [],
      duration: "12 hours",
    },
    expected_top_diagnosis: "meningitis",
    sensitivity_variant: {
      label: "Remove fever + neck stiffness → migraine",
      overrides: {
        symptoms: ["headache", "photophobia", "nausea", "throbbing pain"],
        vitals: { temperature: 36.9, heartRate: 78, bloodPressure: "120/78", respiratoryRate: 16, spo2: 99 },
      },
      expected_effect: "decrease",
      target_diagnosis: "meningitis",
    },
  },

  // ═══════════════════════════════════════════
  // AMBIGUOUS / LOW-SIGNAL SCENARIOS
  // ═══════════════════════════════════════════
  {
    id: "ambiguous_fever_only",
    name: "Ambiguous: Isolated Fever",
    clinical_context: {
      chief_complaint: "Fever for 3 days, no other clear symptoms",
      symptoms: ["fever", "fatigue", "body aches"],
      age: 35, sex: "male",
      vitals: { temperature: 38.5, heartRate: 92, bloodPressure: "120/78", respiratoryRate: 18, spo2: 98 },
      medical_history: [],
      duration: "3 days",
    },
    expected_top_diagnosis: "viral infection",
  },
  {
    id: "ambiguous_fatigue",
    name: "Ambiguous: Chronic Fatigue",
    clinical_context: {
      chief_complaint: "Persistent fatigue and weakness for 2 months",
      symptoms: ["fatigue", "weakness", "poor appetite", "weight loss"],
      age: 48, sex: "female",
      vitals: { temperature: 36.8, heartRate: 76, bloodPressure: "115/72", respiratoryRate: 16, spo2: 99 },
      medical_history: [],
      duration: "2 months",
    },
    expected_top_diagnosis: "anemia",
  },
  {
    id: "ambiguous_dizziness",
    name: "Ambiguous: Isolated Dizziness",
    clinical_context: {
      chief_complaint: "Dizziness and lightheadedness when standing",
      symptoms: ["dizziness", "lightheadedness", "fatigue"],
      age: 70, sex: "male",
      vitals: { temperature: 36.6, heartRate: 68, bloodPressure: "105/60", respiratoryRate: 16, spo2: 97 },
      medical_history: ["hypertension"],
      medications: ["amlodipine"],
      duration: "1 week",
    },
    expected_top_diagnosis: "orthostatic hypotension",
  },
  {
    id: "low_signal_vague_pain",
    name: "Low Signal: Vague Abdominal Pain",
    clinical_context: {
      chief_complaint: "Mild abdominal discomfort on and off",
      symptoms: ["abdominal pain", "bloating"],
      age: 40, sex: "female",
      vitals: { temperature: 36.9, heartRate: 78, bloodPressure: "118/76", respiratoryRate: 16, spo2: 99 },
      medical_history: [],
      duration: "2 weeks",
    },
    expected_top_diagnosis: "functional dyspepsia",
  },
  {
    id: "low_signal_mild_cough",
    name: "Low Signal: Persistent Mild Cough",
    clinical_context: {
      chief_complaint: "Dry cough for 3 weeks, no fever",
      symptoms: ["cough", "throat irritation"],
      age: 30, sex: "male",
      vitals: { temperature: 36.8, heartRate: 72, bloodPressure: "120/78", respiratoryRate: 16, spo2: 99 },
      medical_history: ["allergic rhinitis"],
      duration: "3 weeks",
    },
    expected_top_diagnosis: "upper respiratory infection",
  },

  // ═══════════════════════════════════════════
  // AGE / SEX VARIANT SCENARIOS
  // ═══════════════════════════════════════════
  {
    id: "pediatric_fever_rash",
    name: "Pediatric: Fever with Rash",
    clinical_context: {
      chief_complaint: "High fever for 3 days with rash appearing today",
      symptoms: ["fever", "rash", "irritability", "poor feeding"],
      age: 3, sex: "male",
      vitals: { temperature: 39.5, heartRate: 140, bloodPressure: "90/55", respiratoryRate: 30, spo2: 97 },
      medical_history: [],
      duration: "3 days",
    },
    expected_top_diagnosis: "viral exanthem",
  },
  {
    id: "pediatric_wheeze",
    name: "Pediatric: Wheezing Episode",
    clinical_context: {
      chief_complaint: "Difficulty breathing with wheezing sounds",
      symptoms: ["wheezing", "cough", "shortness of breath", "chest tightness"],
      age: 6, sex: "male",
      vitals: { temperature: 37.0, heartRate: 110, bloodPressure: "95/60", respiratoryRate: 28, spo2: 94 },
      medical_history: ["asthma"],
      duration: "4 hours",
    },
    expected_top_diagnosis: "asthma exacerbation",
  },
  {
    id: "elderly_confusion",
    name: "Elderly: Acute Confusion",
    clinical_context: {
      chief_complaint: "Sudden confusion and agitation in elderly patient",
      symptoms: ["confusion", "agitation", "reduced urine output", "fever"],
      age: 82, sex: "female",
      vitals: { temperature: 38.3, heartRate: 98, bloodPressure: "100/65", respiratoryRate: 22, spo2: 94 },
      medical_history: ["diabetes", "chronic kidney disease", "dementia"],
      duration: "1 day",
    },
    expected_top_diagnosis: "urinary tract infection",
    sensitivity_variant: {
      label: "Remove fever → delirium rises",
      overrides: {
        symptoms: ["confusion", "agitation", "reduced urine output"],
        vitals: { temperature: 36.8, heartRate: 88, bloodPressure: "100/65", respiratoryRate: 18, spo2: 96 },
      },
      expected_effect: "decrease",
      target_diagnosis: "urinary tract infection",
    },
  },
  {
    id: "female_chest_pain_atypical",
    name: "Female: Atypical ACS Presentation",
    clinical_context: {
      chief_complaint: "Jaw pain with nausea and fatigue",
      symptoms: ["jaw pain", "nausea", "fatigue", "shortness of breath", "epigastric discomfort"],
      age: 68, sex: "female",
      vitals: { temperature: 37.0, heartRate: 96, bloodPressure: "155/90", respiratoryRate: 20, spo2: 96 },
      medical_history: ["diabetes", "hypertension"],
      duration: "3 hours",
    },
    expected_top_diagnosis: "acute coronary syndrome",
  },
  {
    id: "young_female_thyroid",
    name: "Young Female: Thyroid Storm Signs",
    clinical_context: {
      chief_complaint: "Palpitations, tremor, and weight loss",
      symptoms: ["palpitations", "tremor", "weight loss", "heat intolerance", "anxiety", "diarrhea"],
      age: 28, sex: "female",
      vitals: { temperature: 37.8, heartRate: 130, bloodPressure: "145/65", respiratoryRate: 22, spo2: 98 },
      medical_history: ["Graves disease"],
      duration: "2 weeks",
    },
    expected_top_diagnosis: "hyperthyroidism",
  },

  // ═══════════════════════════════════════════
  // MULTI-SYSTEM PRESENTATIONS
  // ═══════════════════════════════════════════
  {
    id: "multi_dka",
    name: "Multi-system: Diabetic Ketoacidosis",
    clinical_context: {
      chief_complaint: "Nausea, vomiting, abdominal pain with deep rapid breathing",
      symptoms: ["nausea", "vomiting", "abdominal pain", "deep breathing", "fruity breath", "polyuria", "polydipsia"],
      age: 22, sex: "male",
      vitals: { temperature: 37.2, heartRate: 115, bloodPressure: "100/60", respiratoryRate: 32, spo2: 99 },
      medical_history: ["type 1 diabetes"],
      duration: "1 day",
    },
    expected_top_diagnosis: "diabetic ketoacidosis",
  },
  {
    id: "multi_chf_exacerbation",
    name: "Multi-system: CHF Exacerbation",
    clinical_context: {
      chief_complaint: "Worsening shortness of breath with leg swelling",
      symptoms: ["dyspnea", "orthopnea", "leg swelling", "paroxysmal nocturnal dyspnea", "fatigue", "weight gain"],
      age: 72, sex: "male",
      vitals: { temperature: 36.8, heartRate: 100, bloodPressure: "160/95", respiratoryRate: 26, spo2: 90 },
      medical_history: ["heart failure", "atrial fibrillation", "hypertension"],
      duration: "5 days",
    },
    expected_top_diagnosis: "heart failure exacerbation",
  },
  {
    id: "multi_pancreatitis",
    name: "Multi-system: Acute Pancreatitis",
    clinical_context: {
      chief_complaint: "Severe epigastric pain radiating to back after heavy meal",
      symptoms: ["epigastric pain", "vomiting", "nausea", "abdominal tenderness", "back pain"],
      age: 48, sex: "male",
      vitals: { temperature: 38.0, heartRate: 105, bloodPressure: "110/70", respiratoryRate: 22, spo2: 96 },
      medical_history: ["alcohol use", "gallstones"],
      duration: "8 hours",
    },
    expected_top_diagnosis: "acute pancreatitis",
  },

  // ═══════════════════════════════════════════
  // INFECTIOUS DISEASE VARIANTS
  // ═══════════════════════════════════════════
  {
    id: "dengue_fever",
    name: "Dengue Fever",
    clinical_context: {
      chief_complaint: "High fever with body aches and rash",
      symptoms: ["fever", "body aches", "headache", "retro-orbital pain", "rash", "nausea"],
      age: 25, sex: "male",
      vitals: { temperature: 39.5, heartRate: 100, bloodPressure: "100/65", respiratoryRate: 20, spo2: 97 },
      medical_history: [],
      duration: "4 days",
    },
    expected_top_diagnosis: "dengue fever",
  },
  {
    id: "typhoid_fever",
    name: "Typhoid Fever",
    clinical_context: {
      chief_complaint: "Stepladder fever with abdominal pain and headache",
      symptoms: ["fever", "headache", "abdominal pain", "constipation", "malaise", "rose spots"],
      age: 30, sex: "female",
      vitals: { temperature: 39.8, heartRate: 80, bloodPressure: "110/70", respiratoryRate: 18, spo2: 98 },
      medical_history: [],
      duration: "10 days",
    },
    expected_top_diagnosis: "typhoid fever",
    sensitivity_variant: {
      label: "Add diarrhea → gastroenteritis competes",
      overrides: {
        symptoms: ["fever", "headache", "abdominal pain", "diarrhea", "malaise"],
      },
      expected_effect: "decrease",
      target_diagnosis: "typhoid fever",
    },
  },
  {
    id: "malaria",
    name: "Malaria",
    clinical_context: {
      chief_complaint: "Cyclical high fever with chills and sweating",
      symptoms: ["fever", "chills", "sweating", "headache", "body aches", "nausea"],
      age: 35, sex: "male",
      vitals: { temperature: 40.0, heartRate: 110, bloodPressure: "105/65", respiratoryRate: 22, spo2: 96 },
      medical_history: ["recent travel to endemic area"],
      duration: "5 days",
    },
    expected_top_diagnosis: "malaria",
  },
  {
    id: "tuberculosis",
    name: "Pulmonary Tuberculosis",
    clinical_context: {
      chief_complaint: "Chronic cough with blood in sputum and night sweats",
      symptoms: ["cough", "hemoptysis", "night sweats", "weight loss", "fever", "fatigue"],
      age: 38, sex: "male",
      vitals: { temperature: 37.8, heartRate: 88, bloodPressure: "115/72", respiratoryRate: 20, spo2: 96 },
      medical_history: ["TB contact"],
      duration: "6 weeks",
    },
    expected_top_diagnosis: "pulmonary tuberculosis",
  },

  // ═══════════════════════════════════════════
  // GASTROINTESTINAL SCENARIOS
  // ═══════════════════════════════════════════
  {
    id: "acute_gastroenteritis",
    name: "Acute Gastroenteritis",
    clinical_context: {
      chief_complaint: "Watery diarrhea with vomiting and abdominal cramps",
      symptoms: ["diarrhea", "vomiting", "abdominal pain", "nausea", "fever"],
      age: 28, sex: "female",
      vitals: { temperature: 38.2, heartRate: 98, bloodPressure: "108/68", respiratoryRate: 18, spo2: 98 },
      medical_history: [],
      duration: "1 day",
    },
    expected_top_diagnosis: "gastroenteritis",
  },
  {
    id: "peptic_ulcer",
    name: "Peptic Ulcer Disease",
    clinical_context: {
      chief_complaint: "Burning epigastric pain worse on empty stomach",
      symptoms: ["epigastric pain", "heartburn", "nausea", "bloating", "early satiety"],
      age: 45, sex: "male",
      vitals: { temperature: 36.8, heartRate: 78, bloodPressure: "125/80", respiratoryRate: 16, spo2: 99 },
      medical_history: ["NSAID use", "H. pylori positive"],
      duration: "3 weeks",
    },
    expected_top_diagnosis: "peptic ulcer disease",
  },
  {
    id: "cholecystitis",
    name: "Acute Cholecystitis",
    clinical_context: {
      chief_complaint: "Right upper abdominal pain after fatty meal with fever",
      symptoms: ["right upper quadrant pain", "nausea", "vomiting", "fever", "Murphy sign positive"],
      age: 42, sex: "female",
      vitals: { temperature: 38.5, heartRate: 96, bloodPressure: "130/82", respiratoryRate: 18, spo2: 98 },
      medical_history: ["gallstones"],
      duration: "12 hours",
    },
    expected_top_diagnosis: "acute cholecystitis",
  },

  // ═══════════════════════════════════════════
  // NEUROLOGICAL SCENARIOS
  // ═══════════════════════════════════════════
  {
    id: "stroke_ischemic",
    name: "Ischemic Stroke",
    clinical_context: {
      chief_complaint: "Sudden weakness on right side with slurred speech",
      symptoms: ["hemiparesis", "slurred speech", "facial droop", "confusion", "headache"],
      age: 70, sex: "male",
      vitals: { temperature: 37.0, heartRate: 88, bloodPressure: "175/100", respiratoryRate: 18, spo2: 97 },
      medical_history: ["hypertension", "atrial fibrillation", "diabetes"],
      duration: "2 hours",
    },
    expected_top_diagnosis: "ischemic stroke",
  },
  {
    id: "seizure_first",
    name: "First-time Seizure",
    clinical_context: {
      chief_complaint: "Witnessed generalized tonic-clonic seizure with confusion",
      symptoms: ["seizure", "confusion", "tongue bite", "urinary incontinence", "post-ictal drowsiness"],
      age: 20, sex: "male",
      vitals: { temperature: 37.2, heartRate: 102, bloodPressure: "140/88", respiratoryRate: 20, spo2: 97 },
      medical_history: [],
      duration: "30 minutes",
    },
    expected_top_diagnosis: "seizure",
  },

  // ═══════════════════════════════════════════
  // MUSCULOSKELETAL / RHEUMATIC
  // ═══════════════════════════════════════════
  {
    id: "acute_gout",
    name: "Acute Gout",
    clinical_context: {
      chief_complaint: "Sudden severe pain in big toe joint, red and swollen",
      symptoms: ["joint pain", "swelling", "redness", "warmth", "limited range of motion"],
      age: 55, sex: "male",
      vitals: { temperature: 37.5, heartRate: 82, bloodPressure: "140/88", respiratoryRate: 16, spo2: 99 },
      medical_history: ["hypertension", "high uric acid"],
      duration: "12 hours",
    },
    expected_top_diagnosis: "gout",
  },
  {
    id: "cellulitis",
    name: "Cellulitis",
    clinical_context: {
      chief_complaint: "Red, warm, swollen area on left leg with fever",
      symptoms: ["rash", "swelling", "warmth", "pain", "fever"],
      age: 55, sex: "male",
      vitals: { temperature: 38.5, heartRate: 92, bloodPressure: "130/80", respiratoryRate: 18, spo2: 98 },
      medical_history: ["diabetes", "peripheral vascular disease"],
      duration: "3 days",
    },
    expected_top_diagnosis: "cellulitis",
  },

  // ═══════════════════════════════════════════
  // RENAL / UROLOGICAL
  // ═══════════════════════════════════════════
  {
    id: "kidney_stone",
    name: "Renal Colic (Kidney Stone)",
    clinical_context: {
      chief_complaint: "Severe flank pain radiating to groin with nausea",
      symptoms: ["flank pain", "groin pain", "nausea", "vomiting", "hematuria", "restlessness"],
      age: 38, sex: "male",
      vitals: { temperature: 37.0, heartRate: 100, bloodPressure: "145/90", respiratoryRate: 20, spo2: 99 },
      medical_history: ["previous kidney stones"],
      duration: "4 hours",
    },
    expected_top_diagnosis: "renal colic",
  },
  {
    id: "pyelonephritis",
    name: "Pyelonephritis",
    clinical_context: {
      chief_complaint: "Fever with back pain and burning urination",
      symptoms: ["fever", "flank pain", "dysuria", "frequency", "nausea", "chills"],
      age: 30, sex: "female",
      vitals: { temperature: 39.0, heartRate: 100, bloodPressure: "115/72", respiratoryRate: 20, spo2: 98 },
      medical_history: ["recurrent UTIs"],
      duration: "2 days",
    },
    expected_top_diagnosis: "pyelonephritis",
  },

  // ═══════════════════════════════════════════
  // RESPIRATORY VARIANTS
  // ═══════════════════════════════════════════
  {
    id: "copd_exacerbation",
    name: "COPD Exacerbation",
    clinical_context: {
      chief_complaint: "Worsening breathlessness with increased sputum",
      symptoms: ["dyspnea", "cough", "sputum production", "wheezing", "chest tightness"],
      age: 65, sex: "male",
      vitals: { temperature: 37.2, heartRate: 100, bloodPressure: "135/85", respiratoryRate: 26, spo2: 88 },
      medical_history: ["COPD", "smoking 40 pack-years"],
      duration: "3 days",
    },
    expected_top_diagnosis: "COPD exacerbation",
  },
  {
    id: "pneumothorax",
    name: "Spontaneous Pneumothorax",
    clinical_context: {
      chief_complaint: "Sudden sharp chest pain with difficulty breathing",
      symptoms: ["chest pain", "dyspnea", "decreased breath sounds"],
      age: 22, sex: "male",
      vitals: { temperature: 37.0, heartRate: 110, bloodPressure: "120/78", respiratoryRate: 24, spo2: 93 },
      medical_history: ["tall thin build", "smoker"],
      duration: "1 hour",
    },
    expected_top_diagnosis: "pneumothorax",
  },

  // ═══════════════════════════════════════════
  // ENDOCRINE
  // ═══════════════════════════════════════════
  {
    id: "hypoglycemia",
    name: "Hypoglycemia",
    clinical_context: {
      chief_complaint: "Trembling, sweating, and confusion",
      symptoms: ["tremor", "sweating", "confusion", "palpitations", "hunger", "weakness"],
      age: 55, sex: "male",
      vitals: { temperature: 36.5, heartRate: 108, bloodPressure: "130/85", respiratoryRate: 20, spo2: 98 },
      medical_history: ["type 2 diabetes", "insulin therapy"],
      duration: "30 minutes",
    },
    expected_top_diagnosis: "hypoglycemia",
  },
  {
    id: "addisonian_crisis",
    name: "Adrenal Crisis",
    clinical_context: {
      chief_complaint: "Severe fatigue, nausea, and dizziness with low blood pressure",
      symptoms: ["fatigue", "nausea", "vomiting", "abdominal pain", "dizziness", "confusion"],
      age: 40, sex: "female",
      vitals: { temperature: 37.5, heartRate: 115, bloodPressure: "78/50", respiratoryRate: 22, spo2: 96 },
      medical_history: ["Addison disease", "recent steroid dose missed"],
      duration: "6 hours",
    },
    expected_top_diagnosis: "adrenal crisis",
  },

  // ═══════════════════════════════════════════
  // PSYCHIATRIC / FUNCTIONAL
  // ═══════════════════════════════════════════
  {
    id: "panic_attack",
    name: "Panic Attack (Mimics ACS)",
    clinical_context: {
      chief_complaint: "Chest tightness with palpitations and tingling hands",
      symptoms: ["chest tightness", "palpitations", "tingling", "shortness of breath", "fear of dying", "sweating"],
      age: 28, sex: "female",
      vitals: { temperature: 37.0, heartRate: 110, bloodPressure: "135/82", respiratoryRate: 24, spo2: 99 },
      medical_history: ["anxiety disorder"],
      duration: "20 minutes",
    },
    expected_top_diagnosis: "panic attack",
  },

  // ═══════════════════════════════════════════
  // DERMATOLOGICAL
  // ═══════════════════════════════════════════
  {
    id: "herpes_zoster",
    name: "Herpes Zoster (Shingles)",
    clinical_context: {
      chief_complaint: "Painful vesicular rash on one side of trunk",
      symptoms: ["rash", "pain", "burning sensation", "tingling", "fever"],
      age: 65, sex: "male",
      vitals: { temperature: 37.5, heartRate: 80, bloodPressure: "130/80", respiratoryRate: 16, spo2: 99 },
      medical_history: ["previous chickenpox"],
      duration: "4 days",
    },
    expected_top_diagnosis: "herpes zoster",
  },

  // ═══════════════════════════════════════════
  // OBSTETRIC EMERGENCY
  // ═══════════════════════════════════════════
  {
    id: "ectopic_pregnancy",
    name: "Ectopic Pregnancy",
    clinical_context: {
      chief_complaint: "Lower abdominal pain with vaginal bleeding and dizziness",
      symptoms: ["abdominal pain", "vaginal bleeding", "dizziness", "shoulder tip pain", "amenorrhea"],
      age: 29, sex: "female",
      vitals: { temperature: 37.0, heartRate: 112, bloodPressure: "90/55", respiratoryRate: 22, spo2: 98 },
      medical_history: ["previous ectopic pregnancy"],
      duration: "6 hours",
    },
    expected_top_diagnosis: "ectopic pregnancy",
  },

  // ═══════════════════════════════════════════
  // TOXICOLOGICAL
  // ═══════════════════════════════════════════
  {
    id: "paracetamol_overdose",
    name: "Paracetamol Overdose",
    clinical_context: {
      chief_complaint: "Nausea and vomiting after taking too many paracetamol tablets",
      symptoms: ["nausea", "vomiting", "abdominal pain", "malaise"],
      age: 20, sex: "female",
      vitals: { temperature: 37.0, heartRate: 88, bloodPressure: "115/72", respiratoryRate: 18, spo2: 99 },
      medical_history: [],
      duration: "6 hours",
    },
    expected_top_diagnosis: "paracetamol overdose",
  },

  // ═══════════════════════════════════════════
  // ALLERGIC / IMMUNOLOGICAL
  // ═══════════════════════════════════════════
  {
    id: "anaphylaxis",
    name: "Anaphylaxis",
    clinical_context: {
      chief_complaint: "Difficulty breathing and swollen lips after eating peanuts",
      symptoms: ["dyspnea", "swelling", "rash", "itching", "hypotension", "wheeze"],
      age: 18, sex: "male",
      vitals: { temperature: 37.0, heartRate: 125, bloodPressure: "80/45", respiratoryRate: 30, spo2: 91 },
      medical_history: ["peanut allergy"],
      allergies: ["peanuts"],
      duration: "15 minutes",
    },
    expected_top_diagnosis: "anaphylaxis",
  },

  // ═══════════════════════════════════════════
  // STABILITY / NOISE INJECTION TESTS
  // ═══════════════════════════════════════════
  {
    id: "noise_sepsis_plus_headache",
    name: "Noise: Sepsis + irrelevant headache",
    clinical_context: {
      chief_complaint: "High fever with confusion and low blood pressure, also mentions mild headache",
      symptoms: ["fever", "chills", "confusion", "shortness of breath", "reduced urine output", "headache"],
      age: 58, sex: "male",
      vitals: { temperature: 39.2, heartRate: 120, bloodPressure: "90/60", respiratoryRate: 26, spo2: 92 },
      medical_history: ["diabetes", "recent urinary tract infection"],
      duration: "2 days",
    },
    expected_top_diagnosis: "sepsis",
  },
  {
    id: "noise_acs_plus_cough",
    name: "Noise: ACS + irrelevant cough",
    clinical_context: {
      chief_complaint: "Crushing chest pain radiating to left arm, also has mild cough",
      symptoms: ["chest pain", "left arm pain", "sweating", "nausea", "shortness of breath", "cough"],
      age: 62, sex: "male",
      vitals: { temperature: 37.0, heartRate: 105, bloodPressure: "150/95", respiratoryRate: 22, spo2: 95 },
      medical_history: ["hypertension", "hyperlipidemia", "smoking"],
      duration: "1 hour",
    },
    expected_top_diagnosis: "acute coronary syndrome",
  },

  // ═══════════════════════════════════════════
  // EXTREME VITALS / EDGE CASES
  // ═══════════════════════════════════════════
  {
    id: "extreme_hypotension",
    name: "Edge: Extreme Hypotension",
    clinical_context: {
      chief_complaint: "Collapsed with very low blood pressure",
      symptoms: ["hypotension", "confusion", "cold extremities", "weak pulse"],
      age: 60, sex: "male",
      vitals: { temperature: 35.5, heartRate: 130, bloodPressure: "60/35", respiratoryRate: 30, spo2: 85 },
      medical_history: ["heart failure"],
      duration: "1 hour",
    },
    expected_top_diagnosis: "cardiogenic shock",
  },
  {
    id: "normal_vitals_red_flags",
    name: "Edge: Normal Vitals but Red Flag Symptoms",
    clinical_context: {
      chief_complaint: "Sudden worst headache of life",
      symptoms: ["headache", "neck stiffness", "vomiting", "photophobia"],
      age: 45, sex: "female",
      vitals: { temperature: 37.0, heartRate: 78, bloodPressure: "145/90", respiratoryRate: 16, spo2: 99 },
      medical_history: [],
      duration: "2 hours",
    },
    expected_top_diagnosis: "subarachnoid hemorrhage",
  },
  {
    id: "minimal_information",
    name: "Edge: Minimal Clinical Information",
    clinical_context: {
      chief_complaint: "Not feeling well",
      symptoms: ["malaise"],
      age: 50, sex: "male",
      vitals: { temperature: 37.0, heartRate: 80, bloodPressure: "120/78", respiratoryRate: 16, spo2: 98 },
      medical_history: [],
      duration: "3 days",
    },
    expected_top_diagnosis: "viral infection",
  },
];
