/**
 * Benchmark v6 — 205 Clinical Cases
 *
 * Distribution:
 *   Cardiology: 25, Neurology: 25, Pulmonology: 25, Gastroenterology: 25,
 *   Infectious Disease: 25, Emergency Medicine: 25, Endocrinology: 15,
 *   Nephrology: 10, Dermatology: 10, Pediatrics: 10, Psychiatry: 5, Rare Diseases: 5
 *
 * Difficulty: 40% common, 35% moderate, 20% complex, 5% rare
 */

import type { MergedContextObject } from "@/services/context_service";
import type { BenchmarkCaseV6, Specialty, CaseDifficulty } from "./types";

// ── Case Factory ──

let caseCounter = 0;

function makeCase(
  specialty: Specialty,
  difficulty: CaseDifficulty,
  name: string,
  overrides: Partial<MergedContextObject>,
  ground_truth: BenchmarkCaseV6["ground_truth"],
  tags: string[] = [],
): BenchmarkCaseV6 {
  caseCounter++;
  const id = `v6-${String(caseCounter).padStart(3, "0")}`;
  return {
    id,
    name,
    specialty,
    difficulty,
    tags,
    context: {
      visit_id: `bench-v6-${id}`,
      patient_id: "bench-patient",
      clinic_id: "bench-clinic",
      chief_complaint: "",
      symptoms: [],
      symptom_duration: "",
      associated_symptoms: [],
      medical_history: [],
      family_history: [],
      risk_factors: [],
      medications: [],
      allergies: [],
      vitals: null,
      lab_results: [],
      risk_flags: [],
      missing_information: [],
      context_confidence: 0.8,
      source_priority: ["benchmark"],
      ...overrides,
    },
    ground_truth,
  };
}

// ═══════════════════════════════════════════════════════
// CARDIOLOGY — 25 cases
// ═══════════════════════════════════════════════════════

const CARDIOLOGY: BenchmarkCaseV6[] = [
  makeCase("cardiology", "common", "Stable Angina Pectoris", {
    chief_complaint: "Chest pain on exertion relieved by rest",
    symptoms: ["chest pain", "exertional dyspnea"],
    symptom_duration: "2 weeks",
    associated_symptoms: ["fatigue"],
    vitals: { bp_systolic: 145, bp_diastolic: 90, pulse: 78, spo2: 97 },
    medical_history: ["Hypertension"],
    risk_factors: ["smoking", "age > 55"],
  }, {
    gold_standard_diagnosis: "Stable Angina",
    top_differential_diagnoses: ["Stable Angina", "Costochondritis", "GERD"],
    recommended_tests: ["ECG", "Stress Test", "Troponin", "Lipid Panel"],
    recommended_medications: ["Nitroglycerin", "Aspirin", "Atorvastatin", "Metoprolol"],
    guideline_reference: "AHA/ACC Chronic Coronary Disease 2023",
    danger_flag: false,
    organ_system: "cardiovascular",
  }, ["exertional", "chronic"]),

  makeCase("cardiology", "common", "Acute STEMI", {
    chief_complaint: "Severe crushing chest pain radiating to left arm for 30 minutes",
    symptoms: ["chest pain", "left arm pain", "diaphoresis", "shortness of breath"],
    symptom_duration: "30 minutes",
    associated_symptoms: ["nausea", "dizziness", "anxiety"],
    vitals: { bp_systolic: 160, bp_diastolic: 95, pulse: 110, spo2: 92 },
    medical_history: ["Hypertension", "Diabetes"],
    risk_factors: ["smoking", "family history of CAD", "obesity"],
    medications: ["Metformin", "Amlodipine"],
  }, {
    gold_standard_diagnosis: "Acute Myocardial Infarction",
    top_differential_diagnoses: ["Acute Myocardial Infarction", "Unstable Angina", "Aortic Dissection", "Pulmonary Embolism"],
    recommended_tests: ["ECG", "Troponin", "CK-MB", "Chest X-ray", "BMP"],
    recommended_medications: ["Aspirin", "Heparin", "Nitroglycerin", "Clopidogrel", "Morphine"],
    guideline_reference: "AHA STEMI Guidelines 2023",
    danger_flag: true,
    organ_system: "cardiovascular",
  }, ["emergency", "must_not_miss"]),

  makeCase("cardiology", "moderate", "Atrial Fibrillation with RVR", {
    chief_complaint: "Palpitations and irregular heartbeat for 2 hours",
    symptoms: ["palpitations", "irregular heartbeat", "chest discomfort"],
    symptom_duration: "2 hours",
    associated_symptoms: ["dizziness", "shortness of breath", "fatigue"],
    vitals: { bp_systolic: 135, bp_diastolic: 85, pulse: 145, spo2: 95 },
    medical_history: ["Hypertension"],
    risk_factors: ["age > 65", "alcohol use"],
  }, {
    gold_standard_diagnosis: "Atrial Fibrillation",
    top_differential_diagnoses: ["Atrial Fibrillation", "Atrial Flutter", "SVT", "Thyrotoxicosis"],
    recommended_tests: ["ECG", "TSH", "Echocardiogram", "BMP", "CBC"],
    recommended_medications: ["Metoprolol", "Diltiazem", "Amiodarone", "Warfarin"],
    guideline_reference: "AHA AF Guidelines 2023",
    danger_flag: false,
    organ_system: "cardiovascular",
  }, ["arrhythmia"]),

  makeCase("cardiology", "moderate", "Heart Failure Exacerbation", {
    chief_complaint: "Progressive shortness of breath and leg swelling for 1 week",
    symptoms: ["dyspnea", "bilateral leg edema", "orthopnea"],
    symptom_duration: "1 week",
    associated_symptoms: ["paroxysmal nocturnal dyspnea", "weight gain", "fatigue"],
    vitals: { bp_systolic: 150, bp_diastolic: 90, pulse: 95, spo2: 90, respiratory_rate: 24 },
    medical_history: ["Heart Failure", "Hypertension", "Diabetes"],
    medications: ["Furosemide", "Lisinopril", "Carvedilol"],
  }, {
    gold_standard_diagnosis: "Acute Decompensated Heart Failure",
    top_differential_diagnoses: ["Heart Failure Exacerbation", "Pneumonia", "Pulmonary Embolism", "Renal Failure"],
    recommended_tests: ["BNP", "Chest X-ray", "Echocardiogram", "BMP", "CBC"],
    recommended_medications: ["Furosemide", "Lisinopril", "Carvedilol", "Spironolactone"],
    guideline_reference: "AHA/ACC Heart Failure Guidelines 2022",
    danger_flag: false,
    organ_system: "cardiovascular",
  }, ["chronic_exacerbation"]),

  makeCase("cardiology", "complex", "Aortic Dissection", {
    chief_complaint: "Sudden tearing chest pain radiating to back",
    symptoms: ["severe chest pain", "back pain", "tearing sensation"],
    symptom_duration: "1 hour",
    associated_symptoms: ["diaphoresis", "anxiety", "unequal blood pressure in arms"],
    vitals: { bp_systolic: 180, bp_diastolic: 110, pulse: 105, spo2: 95 },
    medical_history: ["Hypertension", "Marfan Syndrome"],
    risk_factors: ["connective tissue disorder"],
  }, {
    gold_standard_diagnosis: "Aortic Dissection",
    top_differential_diagnoses: ["Aortic Dissection", "Acute MI", "Pulmonary Embolism", "Tension Pneumothorax"],
    recommended_tests: ["CT Angiography", "Chest X-ray", "D-dimer", "ECG", "Troponin"],
    recommended_medications: ["Labetalol", "Esmolol", "Nitroprusside", "Morphine"],
    guideline_reference: "AHA Aortic Disease Guidelines 2022",
    danger_flag: true,
    organ_system: "cardiovascular",
  }, ["emergency", "must_not_miss", "tearing_pain"]),

  makeCase("cardiology", "common", "Hypertensive Crisis", {
    chief_complaint: "Severe headache with very high blood pressure",
    symptoms: ["severe headache", "blurred vision", "chest pain"],
    symptom_duration: "3 hours",
    associated_symptoms: ["nausea", "confusion"],
    vitals: { bp_systolic: 210, bp_diastolic: 130, pulse: 100, spo2: 96 },
    medical_history: ["Hypertension"],
    risk_factors: ["medication non-compliance"],
  }, {
    gold_standard_diagnosis: "Hypertensive Emergency",
    top_differential_diagnoses: ["Hypertensive Emergency", "Stroke", "Subarachnoid Hemorrhage", "Pheochromocytoma"],
    recommended_tests: ["ECG", "BMP", "Urinalysis", "CT Head", "Troponin"],
    recommended_medications: ["Labetalol", "Nicardipine", "Nitroprusside"],
    guideline_reference: "AHA Hypertension Guidelines 2017",
    danger_flag: true,
    organ_system: "cardiovascular",
  }, ["emergency", "hypertension"]),

  makeCase("cardiology", "moderate", "Pericarditis", {
    chief_complaint: "Sharp chest pain worse with deep breathing and lying down",
    symptoms: ["sharp chest pain", "pleuritic pain", "pain worse lying down"],
    symptom_duration: "2 days",
    associated_symptoms: ["low-grade fever", "pericardial friction rub"],
    vitals: { bp_systolic: 120, bp_diastolic: 75, pulse: 88, spo2: 98, temperature: 37.9 },
    medical_history: ["Recent viral illness"],
  }, {
    gold_standard_diagnosis: "Acute Pericarditis",
    top_differential_diagnoses: ["Pericarditis", "Pleuritis", "Costochondritis", "Myocardial Infarction"],
    recommended_tests: ["ECG", "Echocardiogram", "Troponin", "CRP", "ESR"],
    recommended_medications: ["Ibuprofen", "Colchicine", "Aspirin"],
    guideline_reference: "ESC Pericardial Disease Guidelines 2015",
    danger_flag: false,
    organ_system: "cardiovascular",
  }, ["inflammatory"]),

  makeCase("cardiology", "complex", "Infective Endocarditis", {
    chief_complaint: "Persistent fever with new heart murmur",
    symptoms: ["fever", "night sweats", "fatigue", "new heart murmur"],
    symptom_duration: "2 weeks",
    associated_symptoms: ["weight loss", "petechiae", "splinter hemorrhages", "Janeway lesions"],
    vitals: { temperature: 38.8, pulse: 100, bp_systolic: 110, bp_diastolic: 65, spo2: 96 },
    medical_history: ["IV drug use", "Prosthetic heart valve"],
    risk_factors: ["IV drug use"],
  }, {
    gold_standard_diagnosis: "Infective Endocarditis",
    top_differential_diagnoses: ["Infective Endocarditis", "Rheumatic Fever", "SLE", "Lymphoma"],
    recommended_tests: ["Blood Culture", "Echocardiogram", "CBC", "ESR", "CRP"],
    recommended_medications: ["Vancomycin", "Gentamicin", "Ceftriaxone"],
    guideline_reference: "AHA Endocarditis Guidelines 2015",
    danger_flag: true,
    organ_system: "cardiovascular",
  }, ["infectious", "complex"]),

  makeCase("cardiology", "common", "Mitral Valve Prolapse", {
    chief_complaint: "Occasional palpitations and chest discomfort",
    symptoms: ["palpitations", "chest discomfort", "lightheadedness"],
    symptom_duration: "3 months",
    associated_symptoms: ["anxiety", "fatigue"],
    vitals: { bp_systolic: 115, bp_diastolic: 70, pulse: 75, spo2: 99 },
    risk_factors: ["female", "thin body habitus"],
  }, {
    gold_standard_diagnosis: "Mitral Valve Prolapse",
    top_differential_diagnoses: ["Mitral Valve Prolapse", "Anxiety Disorder", "PVCs", "Hyperthyroidism"],
    recommended_tests: ["Echocardiogram", "ECG", "Holter Monitor", "TSH"],
    recommended_medications: ["Metoprolol", "Propranolol"],
    guideline_reference: "AHA Valve Disease Guidelines 2020",
    danger_flag: false,
    organ_system: "cardiovascular",
  }, ["benign", "chronic"]),

  makeCase("cardiology", "moderate", "Deep Vein Thrombosis", {
    chief_complaint: "Painful swelling in left calf for 3 days",
    symptoms: ["calf pain", "leg swelling", "warmth in leg"],
    symptom_duration: "3 days",
    associated_symptoms: ["redness", "tenderness"],
    vitals: { bp_systolic: 130, bp_diastolic: 80, pulse: 85, spo2: 97 },
    medical_history: ["Recent surgery", "Oral contraceptive use"],
    risk_factors: ["immobilization", "OCP use"],
  }, {
    gold_standard_diagnosis: "Deep Vein Thrombosis",
    top_differential_diagnoses: ["DVT", "Cellulitis", "Baker Cyst Rupture", "Muscle Strain"],
    recommended_tests: ["D-dimer", "Doppler Ultrasound", "CBC", "PT/INR"],
    recommended_medications: ["Heparin", "Enoxaparin", "Warfarin", "Rivaroxaban"],
    guideline_reference: "ASH VTE Guidelines 2020",
    danger_flag: false,
    organ_system: "cardiovascular",
  }, ["vascular"]),

  makeCase("cardiology", "complex", "Pulmonary Embolism", {
    chief_complaint: "Sudden shortness of breath and pleuritic chest pain",
    symptoms: ["sudden dyspnea", "pleuritic chest pain", "tachycardia"],
    symptom_duration: "2 hours",
    associated_symptoms: ["hemoptysis", "anxiety", "leg swelling"],
    vitals: { bp_systolic: 95, bp_diastolic: 60, pulse: 120, spo2: 88, respiratory_rate: 28 },
    medical_history: ["Recent long flight", "DVT"],
    risk_factors: ["immobilization", "previous DVT"],
  }, {
    gold_standard_diagnosis: "Pulmonary Embolism",
    top_differential_diagnoses: ["Pulmonary Embolism", "Pneumothorax", "Pneumonia", "MI"],
    recommended_tests: ["CT Pulmonary Angiography", "D-dimer", "ECG", "Troponin", "ABG"],
    recommended_medications: ["Heparin", "Enoxaparin", "tPA", "Warfarin"],
    guideline_reference: "ESC PE Guidelines 2019",
    danger_flag: true,
    organ_system: "cardiovascular",
  }, ["emergency", "must_not_miss"]),

  makeCase("cardiology", "common", "Supraventricular Tachycardia", {
    chief_complaint: "Sudden rapid heartbeat lasting 20 minutes",
    symptoms: ["palpitations", "rapid heartbeat", "chest tightness"],
    symptom_duration: "20 minutes",
    associated_symptoms: ["lightheadedness", "shortness of breath"],
    vitals: { bp_systolic: 125, bp_diastolic: 78, pulse: 180, spo2: 97 },
  }, {
    gold_standard_diagnosis: "Supraventricular Tachycardia",
    top_differential_diagnoses: ["SVT", "Atrial Fibrillation", "Ventricular Tachycardia", "Sinus Tachycardia"],
    recommended_tests: ["ECG", "Electrolytes", "TSH", "Holter Monitor"],
    recommended_medications: ["Adenosine", "Verapamil", "Metoprolol"],
    guideline_reference: "AHA SVT Guidelines 2015",
    danger_flag: false,
    organ_system: "cardiovascular",
  }, ["arrhythmia", "acute"]),

  // Additional cardiology cases (13 more to reach 25)
  makeCase("cardiology", "common", "Vasovagal Syncope", {
    chief_complaint: "Fainting episode in a crowded room",
    symptoms: ["syncope", "lightheadedness", "nausea before fainting"],
    symptom_duration: "single episode",
    associated_symptoms: ["diaphoresis", "pallor", "bradycardia"],
    vitals: { bp_systolic: 100, bp_diastolic: 60, pulse: 55, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Vasovagal Syncope",
    top_differential_diagnoses: ["Vasovagal Syncope", "Orthostatic Hypotension", "Cardiac Arrhythmia", "Seizure"],
    recommended_tests: ["ECG", "Tilt Table Test", "Blood Glucose", "CBC"],
    recommended_medications: ["Midodrine", "Fludrocortisone"],
    guideline_reference: "ESC Syncope Guidelines 2018",
    danger_flag: false,
    organ_system: "cardiovascular",
  }),

  makeCase("cardiology", "moderate", "Dilated Cardiomyopathy", {
    chief_complaint: "Progressive exercise intolerance and shortness of breath",
    symptoms: ["exercise intolerance", "dyspnea on exertion", "orthopnea"],
    symptom_duration: "3 months",
    associated_symptoms: ["peripheral edema", "fatigue", "weight gain"],
    vitals: { bp_systolic: 105, bp_diastolic: 65, pulse: 95, spo2: 93 },
    medical_history: ["Heavy alcohol use"],
    risk_factors: ["alcohol use", "family history of cardiomyopathy"],
  }, {
    gold_standard_diagnosis: "Dilated Cardiomyopathy",
    top_differential_diagnoses: ["Dilated Cardiomyopathy", "Ischemic Cardiomyopathy", "Valvular Heart Disease", "Myocarditis"],
    recommended_tests: ["Echocardiogram", "BNP", "Chest X-ray", "Cardiac MRI", "Coronary Angiography"],
    recommended_medications: ["Lisinopril", "Carvedilol", "Spironolactone", "Furosemide"],
    guideline_reference: "AHA Cardiomyopathy Guidelines 2022",
    danger_flag: false,
    organ_system: "cardiovascular",
  }),

  makeCase("cardiology", "complex", "Cardiac Tamponade", {
    chief_complaint: "Progressive dyspnea with muffled heart sounds",
    symptoms: ["dyspnea", "chest pressure", "tachycardia"],
    symptom_duration: "6 hours",
    associated_symptoms: ["hypotension", "jugular venous distension", "muffled heart sounds"],
    vitals: { bp_systolic: 80, bp_diastolic: 55, pulse: 130, spo2: 90 },
    medical_history: ["Recent cardiac surgery", "Malignancy"],
  }, {
    gold_standard_diagnosis: "Cardiac Tamponade",
    top_differential_diagnoses: ["Cardiac Tamponade", "Tension Pneumothorax", "Massive PE", "Cardiogenic Shock"],
    recommended_tests: ["Echocardiogram", "ECG", "Chest X-ray", "CVP Monitoring"],
    recommended_medications: ["IV Fluids", "Pericardiocentesis"],
    guideline_reference: "ACC Emergency Cardiac Care 2021",
    danger_flag: true,
    organ_system: "cardiovascular",
  }, ["emergency", "must_not_miss"]),

  makeCase("cardiology", "common", "Hypertrophic Cardiomyopathy", {
    chief_complaint: "Exertional chest pain and near-syncope during exercise",
    symptoms: ["exertional chest pain", "near-syncope", "dyspnea"],
    symptom_duration: "6 months",
    associated_symptoms: ["palpitations", "systolic murmur"],
    vitals: { bp_systolic: 120, bp_diastolic: 75, pulse: 72, spo2: 98 },
    family_history: ["Sudden cardiac death in sibling"],
  }, {
    gold_standard_diagnosis: "Hypertrophic Cardiomyopathy",
    top_differential_diagnoses: ["HCM", "Aortic Stenosis", "Coronary Artery Disease", "Athlete's Heart"],
    recommended_tests: ["Echocardiogram", "ECG", "Cardiac MRI", "Genetic Testing"],
    recommended_medications: ["Metoprolol", "Verapamil", "Disopyramide"],
    guideline_reference: "AHA/ACC HCM Guidelines 2020",
    danger_flag: true,
    organ_system: "cardiovascular",
  }, ["genetic", "sudden_death_risk"]),

  makeCase("cardiology", "moderate", "Aortic Stenosis", {
    chief_complaint: "Progressive dyspnea and exertional syncope",
    symptoms: ["exertional dyspnea", "syncope", "angina"],
    symptom_duration: "4 months",
    associated_symptoms: ["fatigue", "systolic crescendo-decrescendo murmur"],
    vitals: { bp_systolic: 140, bp_diastolic: 85, pulse: 70, spo2: 96 },
    medical_history: ["Bicuspid aortic valve"],
    risk_factors: ["age > 65"],
  }, {
    gold_standard_diagnosis: "Aortic Stenosis",
    top_differential_diagnoses: ["Aortic Stenosis", "HCM", "Coronary Artery Disease", "Pulmonary Hypertension"],
    recommended_tests: ["Echocardiogram", "ECG", "Cardiac Catheterization", "BNP"],
    recommended_medications: ["Diuretics"],
    guideline_reference: "AHA/ACC Valve Disease Guidelines 2020",
    danger_flag: false,
    organ_system: "cardiovascular",
  }),

  makeCase("cardiology", "complex", "Acute Myocarditis", {
    chief_complaint: "Chest pain and dyspnea after recent viral illness",
    symptoms: ["chest pain", "dyspnea", "fatigue"],
    symptom_duration: "3 days",
    associated_symptoms: ["low-grade fever", "palpitations", "recent URI"],
    vitals: { bp_systolic: 105, bp_diastolic: 65, pulse: 100, spo2: 95, temperature: 37.8 },
    medical_history: ["Recent viral illness 2 weeks ago"],
  }, {
    gold_standard_diagnosis: "Acute Myocarditis",
    top_differential_diagnoses: ["Myocarditis", "Pericarditis", "Acute MI", "Pulmonary Embolism"],
    recommended_tests: ["Troponin", "ECG", "Cardiac MRI", "Echocardiogram", "BNP"],
    recommended_medications: ["NSAIDs", "ACE Inhibitors", "Beta-blockers"],
    guideline_reference: "AHA Myocarditis Statement 2021",
    danger_flag: true,
    organ_system: "cardiovascular",
  }),

  makeCase("cardiology", "common", "Peripheral Arterial Disease", {
    chief_complaint: "Cramping leg pain when walking relieved by rest",
    symptoms: ["intermittent claudication", "leg pain on walking", "cold feet"],
    symptom_duration: "2 months",
    associated_symptoms: ["diminished pedal pulses", "pale legs on elevation"],
    vitals: { bp_systolic: 155, bp_diastolic: 92, pulse: 75, spo2: 97 },
    medical_history: ["Diabetes", "Smoking"],
    risk_factors: ["smoking", "diabetes"],
  }, {
    gold_standard_diagnosis: "Peripheral Arterial Disease",
    top_differential_diagnoses: ["PAD", "Spinal Stenosis", "DVT", "Venous Insufficiency"],
    recommended_tests: ["Ankle-Brachial Index", "Doppler Ultrasound", "Lipid Panel", "HbA1c"],
    recommended_medications: ["Cilostazol", "Aspirin", "Atorvastatin"],
    guideline_reference: "AHA/ACC PAD Guidelines 2016",
    danger_flag: false,
    organ_system: "cardiovascular",
  }),

  makeCase("cardiology", "moderate", "Wolff-Parkinson-White Syndrome", {
    chief_complaint: "Recurrent episodes of rapid heartbeat",
    symptoms: ["palpitations", "rapid heartbeat", "lightheadedness"],
    symptom_duration: "recurrent over 6 months",
    associated_symptoms: ["chest discomfort", "near-syncope"],
    vitals: { bp_systolic: 118, bp_diastolic: 72, pulse: 88, spo2: 99 },
    risk_factors: ["young adult"],
  }, {
    gold_standard_diagnosis: "Wolff-Parkinson-White Syndrome",
    top_differential_diagnoses: ["WPW", "SVT", "Atrial Fibrillation", "Ventricular Tachycardia"],
    recommended_tests: ["ECG", "Electrophysiology Study", "Holter Monitor"],
    recommended_medications: ["Procainamide", "Flecainide"],
    guideline_reference: "AHA SVT Guidelines 2015",
    danger_flag: true,
    organ_system: "cardiovascular",
  }),

  makeCase("cardiology", "complex", "Takotsubo Cardiomyopathy", {
    chief_complaint: "Acute chest pain after severe emotional stress",
    symptoms: ["chest pain", "dyspnea", "diaphoresis"],
    symptom_duration: "4 hours",
    associated_symptoms: ["nausea", "T-wave inversion on ECG"],
    vitals: { bp_systolic: 100, bp_diastolic: 65, pulse: 95, spo2: 94 },
    medical_history: ["Recent bereavement"],
    risk_factors: ["postmenopausal female", "emotional stress"],
  }, {
    gold_standard_diagnosis: "Takotsubo Cardiomyopathy",
    top_differential_diagnoses: ["Takotsubo", "Acute MI", "Unstable Angina", "Myocarditis"],
    recommended_tests: ["ECG", "Troponin", "Echocardiogram", "Coronary Angiography", "Cardiac MRI"],
    recommended_medications: ["Beta-blockers", "ACE Inhibitors", "Aspirin"],
    guideline_reference: "AHA Stress Cardiomyopathy Statement 2018",
    danger_flag: true,
    organ_system: "cardiovascular",
  }, ["stress-related", "mimics_MI"]),

  makeCase("cardiology", "common", "Hypertension Stage 2", {
    chief_complaint: "Incidental finding of high blood pressure at routine check",
    symptoms: ["headache", "mild dizziness"],
    symptom_duration: "asymptomatic mostly",
    vitals: { bp_systolic: 165, bp_diastolic: 100, pulse: 80, spo2: 98 },
    risk_factors: ["obesity", "sedentary lifestyle", "family history"],
  }, {
    gold_standard_diagnosis: "Hypertension Stage 2",
    top_differential_diagnoses: ["Essential Hypertension", "Secondary Hypertension", "White Coat Hypertension"],
    recommended_tests: ["BMP", "Lipid Panel", "Urinalysis", "ECG", "HbA1c"],
    recommended_medications: ["Amlodipine", "Lisinopril", "Hydrochlorothiazide"],
    guideline_reference: "AHA Hypertension Guidelines 2017",
    danger_flag: false,
    organ_system: "cardiovascular",
  }),

  makeCase("cardiology", "moderate", "Ventricular Tachycardia", {
    chief_complaint: "Episode of sustained rapid heartbeat with dizziness",
    symptoms: ["palpitations", "dizziness", "presyncope"],
    symptom_duration: "15 minutes",
    associated_symptoms: ["chest pain", "dyspnea"],
    vitals: { bp_systolic: 90, bp_diastolic: 55, pulse: 180, spo2: 92 },
    medical_history: ["Previous MI", "Ischemic Cardiomyopathy"],
  }, {
    gold_standard_diagnosis: "Ventricular Tachycardia",
    top_differential_diagnoses: ["VT", "SVT with Aberrancy", "Torsades de Pointes"],
    recommended_tests: ["ECG", "Electrolytes", "Troponin", "Echocardiogram"],
    recommended_medications: ["Amiodarone", "Lidocaine", "Procainamide"],
    guideline_reference: "AHA Ventricular Arrhythmia Guidelines 2017",
    danger_flag: true,
    organ_system: "cardiovascular",
  }, ["emergency", "arrhythmia"]),
];

// ═══════════════════════════════════════════════════════
// NEUROLOGY — 25 cases
// ═══════════════════════════════════════════════════════

const NEUROLOGY: BenchmarkCaseV6[] = [
  makeCase("neurology", "common", "Migraine with Aura", {
    chief_complaint: "Severe throbbing headache with visual disturbances",
    symptoms: ["throbbing headache", "visual aura", "photophobia", "phonophobia"],
    symptom_duration: "6 hours",
    associated_symptoms: ["nausea", "vomiting", "scotoma"],
    vitals: { bp_systolic: 130, bp_diastolic: 85, pulse: 80, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Migraine with Aura",
    top_differential_diagnoses: ["Migraine with Aura", "Tension Headache", "Cluster Headache", "TIA"],
    recommended_tests: ["CT Head", "MRI Brain"],
    recommended_medications: ["Sumatriptan", "Ibuprofen", "Metoclopramide"],
    guideline_reference: "AAN Migraine Guidelines 2021",
    danger_flag: false,
    organ_system: "neurological",
  }),

  makeCase("neurology", "common", "Acute Ischemic Stroke", {
    chief_complaint: "Sudden weakness on right side and difficulty speaking",
    symptoms: ["right-sided weakness", "aphasia", "facial droop"],
    symptom_duration: "1 hour",
    associated_symptoms: ["confusion", "difficulty swallowing"],
    vitals: { bp_systolic: 185, bp_diastolic: 105, pulse: 88, spo2: 96 },
    medical_history: ["Atrial Fibrillation", "Hypertension"],
    risk_factors: ["AF", "smoking"],
  }, {
    gold_standard_diagnosis: "Acute Ischemic Stroke",
    top_differential_diagnoses: ["Ischemic Stroke", "Hemorrhagic Stroke", "TIA", "Todd Paralysis"],
    recommended_tests: ["CT Head", "CT Angiography", "MRI Brain", "CBC", "PT/INR", "Blood Glucose"],
    recommended_medications: ["tPA", "Aspirin", "Heparin"],
    guideline_reference: "AHA/ASA Stroke Guidelines 2019",
    danger_flag: true,
    organ_system: "neurological",
  }, ["emergency", "must_not_miss", "time_critical"]),

  makeCase("neurology", "moderate", "Epileptic Seizure — New Onset", {
    chief_complaint: "First-time generalized seizure witnessed by family",
    symptoms: ["generalized tonic-clonic seizure", "loss of consciousness", "post-ictal confusion"],
    symptom_duration: "2 minutes",
    associated_symptoms: ["tongue biting", "urinary incontinence", "drowsiness"],
    vitals: { bp_systolic: 145, bp_diastolic: 90, pulse: 100, spo2: 95, temperature: 37.2 },
  }, {
    gold_standard_diagnosis: "Epileptic Seizure",
    top_differential_diagnoses: ["Epilepsy", "Syncope", "Psychogenic Seizure", "Hypoglycemia", "Meningitis"],
    recommended_tests: ["EEG", "CT Head", "MRI Brain", "Blood Glucose", "Electrolytes", "Prolactin"],
    recommended_medications: ["Levetiracetam", "Valproic Acid", "Lorazepam"],
    guideline_reference: "AAN Epilepsy Guidelines 2022",
    danger_flag: false,
    organ_system: "neurological",
  }),

  makeCase("neurology", "complex", "Subarachnoid Hemorrhage", {
    chief_complaint: "Thunderclap headache — worst headache of my life",
    symptoms: ["thunderclap headache", "neck stiffness", "photophobia"],
    symptom_duration: "2 hours",
    associated_symptoms: ["vomiting", "altered consciousness", "seizure"],
    vitals: { bp_systolic: 190, bp_diastolic: 110, pulse: 60, spo2: 95 },
  }, {
    gold_standard_diagnosis: "Subarachnoid Hemorrhage",
    top_differential_diagnoses: ["SAH", "Meningitis", "Migraine", "Hypertensive Emergency"],
    recommended_tests: ["CT Head", "Lumbar Puncture", "CT Angiography", "CBC"],
    recommended_medications: ["Nimodipine", "Labetalol", "Levetiracetam"],
    guideline_reference: "AHA/ASA SAH Guidelines 2012",
    danger_flag: true,
    organ_system: "neurological",
  }, ["emergency", "must_not_miss"]),

  makeCase("neurology", "common", "Tension-Type Headache", {
    chief_complaint: "Bilateral pressing headache for 2 days",
    symptoms: ["bilateral headache", "pressing quality", "mild to moderate intensity"],
    symptom_duration: "2 days",
    associated_symptoms: ["scalp tenderness", "neck stiffness"],
    vitals: { bp_systolic: 120, bp_diastolic: 75, pulse: 72, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Tension-Type Headache",
    top_differential_diagnoses: ["Tension Headache", "Migraine", "Cervicogenic Headache", "Sinusitis"],
    recommended_tests: [],
    recommended_medications: ["Acetaminophen", "Ibuprofen", "Amitriptyline"],
    guideline_reference: "AAN Headache Guidelines 2021",
    danger_flag: false,
    organ_system: "neurological",
  }),

  makeCase("neurology", "moderate", "Multiple Sclerosis — First Presentation", {
    chief_complaint: "Numbness in legs and blurred vision for 1 week",
    symptoms: ["leg numbness", "blurred vision", "tingling", "fatigue"],
    symptom_duration: "1 week",
    associated_symptoms: ["Lhermitte sign", "optic neuritis", "urinary urgency"],
    vitals: { bp_systolic: 118, bp_diastolic: 72, pulse: 70, spo2: 99 },
    risk_factors: ["young female"],
  }, {
    gold_standard_diagnosis: "Multiple Sclerosis",
    top_differential_diagnoses: ["MS", "Neuromyelitis Optica", "Vitamin B12 Deficiency", "SLE"],
    recommended_tests: ["MRI Brain", "MRI Spine", "CSF Analysis", "VEP", "Oligoclonal Bands"],
    recommended_medications: ["Methylprednisolone", "Interferon Beta", "Glatiramer"],
    guideline_reference: "AAN MS Guidelines 2018",
    danger_flag: false,
    organ_system: "neurological",
  }),

  makeCase("neurology", "complex", "Bacterial Meningitis", {
    chief_complaint: "Severe headache with neck stiffness, fever, and confusion",
    symptoms: ["severe headache", "neck stiffness", "high fever", "photophobia"],
    symptom_duration: "12 hours",
    associated_symptoms: ["confusion", "vomiting", "petechial rash", "seizure"],
    vitals: { temperature: 39.8, pulse: 120, bp_systolic: 90, bp_diastolic: 55, spo2: 94 },
  }, {
    gold_standard_diagnosis: "Bacterial Meningitis",
    top_differential_diagnoses: ["Bacterial Meningitis", "Viral Meningitis", "Encephalitis", "SAH"],
    recommended_tests: ["Lumbar Puncture", "CSF Analysis", "Blood Culture", "CBC", "CRP", "CT Head"],
    recommended_medications: ["Ceftriaxone", "Vancomycin", "Dexamethasone", "Acyclovir"],
    guideline_reference: "IDSA Meningitis Guidelines 2017",
    danger_flag: true,
    organ_system: "neurological",
  }, ["emergency", "must_not_miss"]),

  makeCase("neurology", "common", "Bell's Palsy", {
    chief_complaint: "Sudden weakness of the right side of face",
    symptoms: ["unilateral facial weakness", "inability to close eye", "mouth drooping"],
    symptom_duration: "1 day",
    associated_symptoms: ["ear pain", "altered taste", "hyperacusis"],
    vitals: { bp_systolic: 125, bp_diastolic: 78, pulse: 76, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Bell's Palsy",
    top_differential_diagnoses: ["Bell's Palsy", "Stroke", "Ramsay Hunt Syndrome", "Lyme Disease"],
    recommended_tests: ["CT Head", "Lyme Serology", "Blood Glucose"],
    recommended_medications: ["Prednisolone", "Valacyclovir"],
    guideline_reference: "AAN Bell's Palsy Guidelines 2012",
    danger_flag: false,
    organ_system: "neurological",
  }),

  makeCase("neurology", "moderate", "Parkinson's Disease", {
    chief_complaint: "Tremor in right hand and difficulty walking for 6 months",
    symptoms: ["resting tremor", "bradykinesia", "rigidity", "postural instability"],
    symptom_duration: "6 months",
    associated_symptoms: ["small handwriting", "masked facies", "shuffling gait"],
    vitals: { bp_systolic: 135, bp_diastolic: 80, pulse: 68, spo2: 98 },
    risk_factors: ["age > 60"],
  }, {
    gold_standard_diagnosis: "Parkinson's Disease",
    top_differential_diagnoses: ["Parkinson's Disease", "Essential Tremor", "Drug-Induced Parkinsonism", "PSP"],
    recommended_tests: ["DaTscan", "MRI Brain", "Medication Trial"],
    recommended_medications: ["Levodopa/Carbidopa", "Ropinirole", "Selegiline"],
    guideline_reference: "AAN Parkinson's Guidelines 2019",
    danger_flag: false,
    organ_system: "neurological",
  }),

  makeCase("neurology", "complex", "Guillain-Barré Syndrome", {
    chief_complaint: "Ascending weakness in both legs progressing to arms",
    symptoms: ["ascending weakness", "bilateral leg weakness", "areflexia"],
    symptom_duration: "4 days",
    associated_symptoms: ["tingling in feet", "back pain", "difficulty breathing", "recent diarrheal illness"],
    vitals: { bp_systolic: 130, bp_diastolic: 80, pulse: 90, spo2: 94, respiratory_rate: 22 },
    medical_history: ["Recent Campylobacter infection"],
  }, {
    gold_standard_diagnosis: "Guillain-Barré Syndrome",
    top_differential_diagnoses: ["GBS", "Transverse Myelitis", "Myasthenia Gravis", "Botulism"],
    recommended_tests: ["CSF Analysis", "Nerve Conduction Study", "EMG", "Pulmonary Function Tests"],
    recommended_medications: ["IVIG", "Plasmapheresis"],
    guideline_reference: "AAN GBS Guidelines 2012",
    danger_flag: true,
    organ_system: "neurological",
  }, ["ascending", "respiratory_risk"]),

  makeCase("neurology", "common", "Carpal Tunnel Syndrome", {
    chief_complaint: "Numbness and tingling in right hand, worse at night",
    symptoms: ["numbness in thumb and index finger", "tingling", "hand weakness"],
    symptom_duration: "3 months",
    associated_symptoms: ["dropping objects", "pain radiating to forearm"],
    vitals: { bp_systolic: 120, bp_diastolic: 75, pulse: 72, spo2: 99 },
    risk_factors: ["computer use", "pregnancy"],
  }, {
    gold_standard_diagnosis: "Carpal Tunnel Syndrome",
    top_differential_diagnoses: ["Carpal Tunnel", "Cervical Radiculopathy", "Ulnar Neuropathy", "Thoracic Outlet Syndrome"],
    recommended_tests: ["Nerve Conduction Study", "EMG", "Tinel Test", "Phalen Test"],
    recommended_medications: ["NSAIDs", "Wrist Splint", "Corticosteroid Injection"],
    guideline_reference: "AAOS CTS Guidelines 2016",
    danger_flag: false,
    organ_system: "neurological",
  }),

  makeCase("neurology", "moderate", "Trigeminal Neuralgia", {
    chief_complaint: "Severe stabbing face pain triggered by chewing",
    symptoms: ["unilateral face pain", "stabbing pain", "electric shock-like pain"],
    symptom_duration: "2 weeks",
    associated_symptoms: ["pain triggered by touch", "chewing triggers attacks"],
    vitals: { bp_systolic: 140, bp_diastolic: 85, pulse: 82, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Trigeminal Neuralgia",
    top_differential_diagnoses: ["Trigeminal Neuralgia", "TMJ Disorder", "Dental Abscess", "MS"],
    recommended_tests: ["MRI Brain", "CT Head"],
    recommended_medications: ["Carbamazepine", "Oxcarbazepine", "Gabapentin"],
    guideline_reference: "AAN Trigeminal Neuralgia Guidelines 2008",
    danger_flag: false,
    organ_system: "neurological",
  }),

  makeCase("neurology", "complex", "Myasthenia Gravis", {
    chief_complaint: "Fluctuating double vision and difficulty swallowing",
    symptoms: ["diplopia", "dysphagia", "ptosis", "fluctuating weakness"],
    symptom_duration: "3 weeks",
    associated_symptoms: ["fatigue worse in evening", "difficulty chewing", "nasal speech"],
    vitals: { bp_systolic: 120, bp_diastolic: 75, pulse: 76, spo2: 97 },
  }, {
    gold_standard_diagnosis: "Myasthenia Gravis",
    top_differential_diagnoses: ["Myasthenia Gravis", "Lambert-Eaton", "Botulism", "MS"],
    recommended_tests: ["AChR Antibody", "Anti-MuSK", "CT Chest", "Edrophonium Test", "EMG"],
    recommended_medications: ["Pyridostigmine", "Prednisolone", "Azathioprine"],
    guideline_reference: "AAN Myasthenia Gravis Guidelines 2016",
    danger_flag: false,
    organ_system: "neurological",
  }),

  makeCase("neurology", "common", "Benign Positional Vertigo", {
    chief_complaint: "Brief spinning episodes when turning in bed",
    symptoms: ["vertigo", "dizziness", "nausea"],
    symptom_duration: "1 week",
    associated_symptoms: ["positional nystagmus"],
    vitals: { bp_systolic: 125, bp_diastolic: 78, pulse: 74, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Benign Paroxysmal Positional Vertigo",
    top_differential_diagnoses: ["BPPV", "Meniere's Disease", "Vestibular Neuritis", "Stroke"],
    recommended_tests: ["Dix-Hallpike Maneuver", "Audiometry"],
    recommended_medications: ["Meclizine", "Betahistine"],
    guideline_reference: "AAN BPPV Guidelines 2017",
    danger_flag: false,
    organ_system: "neurological",
  }),

  makeCase("neurology", "moderate", "Lumbar Disc Herniation", {
    chief_complaint: "Lower back pain radiating down the left leg",
    symptoms: ["low back pain", "sciatica", "leg pain", "numbness in foot"],
    symptom_duration: "2 weeks",
    associated_symptoms: ["difficulty walking", "positive straight leg raise"],
    vitals: { bp_systolic: 130, bp_diastolic: 82, pulse: 78, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Lumbar Disc Herniation",
    top_differential_diagnoses: ["Disc Herniation", "Spinal Stenosis", "Piriformis Syndrome", "Cauda Equina"],
    recommended_tests: ["MRI Lumbar Spine", "X-ray Spine", "EMG"],
    recommended_medications: ["NSAIDs", "Gabapentin", "Muscle Relaxants", "Epidural Steroid"],
    guideline_reference: "AAN Low Back Pain Guidelines 2017",
    danger_flag: false,
    organ_system: "neurological",
  }),

  makeCase("neurology", "complex", "Status Epilepticus", {
    chief_complaint: "Continuous seizure activity for 10 minutes not stopping",
    symptoms: ["continuous generalized seizure", "loss of consciousness", "cyanosis"],
    symptom_duration: "10 minutes",
    associated_symptoms: ["hyperthermia", "tachycardia", "metabolic acidosis"],
    vitals: { temperature: 39.5, pulse: 140, bp_systolic: 170, bp_diastolic: 100, spo2: 85 },
    medical_history: ["Epilepsy"],
    medications: ["Levetiracetam"],
  }, {
    gold_standard_diagnosis: "Status Epilepticus",
    top_differential_diagnoses: ["Status Epilepticus", "Pseudoseizure", "Encephalitis", "Metabolic Encephalopathy"],
    recommended_tests: ["Blood Glucose", "Electrolytes", "ABG", "EEG", "CT Head", "Toxicology Screen"],
    recommended_medications: ["Lorazepam", "Phenytoin", "Levetiracetam", "Propofol"],
    guideline_reference: "AES Status Epilepticus Guidelines 2016",
    danger_flag: true,
    organ_system: "neurological",
  }, ["emergency"]),

  makeCase("neurology", "moderate", "Alzheimer's Disease", {
    chief_complaint: "Progressive memory loss and confusion over 1 year",
    symptoms: ["memory loss", "confusion", "word-finding difficulty"],
    symptom_duration: "1 year",
    associated_symptoms: ["getting lost in familiar places", "personality changes", "difficulty with daily tasks"],
    vitals: { bp_systolic: 135, bp_diastolic: 80, pulse: 72, spo2: 98 },
    risk_factors: ["age > 70", "family history of dementia"],
  }, {
    gold_standard_diagnosis: "Alzheimer's Disease",
    top_differential_diagnoses: ["Alzheimer's Disease", "Vascular Dementia", "Lewy Body Dementia", "Depression"],
    recommended_tests: ["MMSE", "MRI Brain", "PET Scan", "TSH", "Vitamin B12", "CBC"],
    recommended_medications: ["Donepezil", "Memantine", "Rivastigmine"],
    guideline_reference: "AAN Dementia Guidelines 2018",
    danger_flag: false,
    organ_system: "neurological",
  }),

  makeCase("neurology", "common", "Cervical Radiculopathy", {
    chief_complaint: "Neck pain radiating to right arm with numbness",
    symptoms: ["neck pain", "arm pain", "numbness in fingers", "tingling"],
    symptom_duration: "10 days",
    associated_symptoms: ["weakness in grip", "pain with neck extension"],
    vitals: { bp_systolic: 125, bp_diastolic: 78, pulse: 74, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Cervical Radiculopathy",
    top_differential_diagnoses: ["Cervical Radiculopathy", "Carpal Tunnel", "Thoracic Outlet", "Brachial Plexopathy"],
    recommended_tests: ["MRI Cervical Spine", "EMG", "X-ray C-Spine"],
    recommended_medications: ["NSAIDs", "Gabapentin", "Methylprednisolone"],
    guideline_reference: "NASS Cervical Radiculopathy Guidelines 2010",
    danger_flag: false,
    organ_system: "neurological",
  }),

  makeCase("neurology", "complex", "Transverse Myelitis", {
    chief_complaint: "Sudden weakness in both legs with urinary retention",
    symptoms: ["bilateral leg weakness", "back pain", "urinary retention", "sensory level"],
    symptom_duration: "2 days",
    associated_symptoms: ["bowel dysfunction", "band-like sensation around trunk"],
    vitals: { bp_systolic: 130, bp_diastolic: 80, pulse: 85, spo2: 97 },
    medical_history: ["Recent vaccination"],
  }, {
    gold_standard_diagnosis: "Transverse Myelitis",
    top_differential_diagnoses: ["Transverse Myelitis", "GBS", "MS", "Spinal Cord Compression", "NMO"],
    recommended_tests: ["MRI Spine", "CSF Analysis", "AQP4 Antibody", "VEP"],
    recommended_medications: ["Methylprednisolone", "IVIG", "Plasmapheresis"],
    guideline_reference: "AAN Myelitis Guidelines 2011",
    danger_flag: true,
    organ_system: "neurological",
  }),

  makeCase("neurology", "moderate", "Essential Tremor", {
    chief_complaint: "Bilateral hand tremor worse with movement for 2 years",
    symptoms: ["action tremor", "bilateral hand tremor", "difficulty writing"],
    symptom_duration: "2 years",
    associated_symptoms: ["head tremor", "tremor improves with alcohol"],
    vitals: { bp_systolic: 125, bp_diastolic: 75, pulse: 72, spo2: 99 },
    family_history: ["Father has tremor"],
  }, {
    gold_standard_diagnosis: "Essential Tremor",
    top_differential_diagnoses: ["Essential Tremor", "Parkinson's Disease", "Hyperthyroidism", "Drug-Induced Tremor"],
    recommended_tests: ["TSH", "MRI Brain"],
    recommended_medications: ["Propranolol", "Primidone", "Topiramate"],
    guideline_reference: "AAN Essential Tremor Guidelines 2011",
    danger_flag: false,
    organ_system: "neurological",
  }),
];

// ═══════════════════════════════════════════════════════
// PULMONOLOGY — 25 cases
// ═══════════════════════════════════════════════════════

const PULMONOLOGY: BenchmarkCaseV6[] = [
  makeCase("pulmonology", "common", "Community Acquired Pneumonia", {
    chief_complaint: "Productive cough with yellow sputum and fever for 5 days",
    symptoms: ["productive cough", "fever", "dyspnea", "pleuritic chest pain"],
    symptom_duration: "5 days",
    associated_symptoms: ["chills", "fatigue", "night sweats"],
    vitals: { temperature: 39.2, pulse: 110, spo2: 92, respiratory_rate: 24, bp_systolic: 115, bp_diastolic: 70 },
    medical_history: ["Diabetes"],
  }, {
    gold_standard_diagnosis: "Community Acquired Pneumonia",
    top_differential_diagnoses: ["Pneumonia", "Bronchitis", "TB", "Lung Abscess"],
    recommended_tests: ["Chest X-ray", "CBC", "Blood Culture", "Sputum Culture", "CRP", "Procalcitonin"],
    recommended_medications: ["Amoxicillin-Clavulanate", "Azithromycin", "Levofloxacin"],
    guideline_reference: "ATS/IDSA CAP Guidelines 2019",
    danger_flag: false,
    organ_system: "respiratory",
  }),

  makeCase("pulmonology", "common", "Acute Asthma Exacerbation", {
    chief_complaint: "Wheezing and difficulty breathing for 4 hours",
    symptoms: ["wheezing", "dyspnea", "chest tightness", "cough"],
    symptom_duration: "4 hours",
    associated_symptoms: ["inability to speak full sentences", "accessory muscle use"],
    vitals: { pulse: 115, spo2: 89, respiratory_rate: 28, bp_systolic: 130, bp_diastolic: 80 },
    medical_history: ["Asthma"],
    medications: ["Salbutamol inhaler"],
    risk_factors: ["allergen exposure"],
  }, {
    gold_standard_diagnosis: "Acute Asthma Exacerbation",
    top_differential_diagnoses: ["Asthma Exacerbation", "COPD Exacerbation", "Pneumothorax", "Foreign Body"],
    recommended_tests: ["Peak Flow", "ABG", "Chest X-ray", "SpO2"],
    recommended_medications: ["Salbutamol", "Ipratropium", "Prednisolone", "Magnesium Sulfate"],
    guideline_reference: "GINA Asthma Guidelines 2023",
    danger_flag: false,
    organ_system: "respiratory",
  }),

  makeCase("pulmonology", "moderate", "COPD Exacerbation", {
    chief_complaint: "Increased breathlessness and productive cough for 3 days",
    symptoms: ["increased dyspnea", "productive cough", "purulent sputum", "wheezing"],
    symptom_duration: "3 days",
    associated_symptoms: ["barrel chest", "pursed lip breathing"],
    vitals: { pulse: 100, spo2: 87, respiratory_rate: 26, bp_systolic: 140, bp_diastolic: 85, temperature: 37.6 },
    medical_history: ["COPD", "Smoking 40 pack-years"],
    medications: ["Tiotropium", "Formoterol"],
  }, {
    gold_standard_diagnosis: "COPD Exacerbation",
    top_differential_diagnoses: ["COPD Exacerbation", "Pneumonia", "Heart Failure", "PE"],
    recommended_tests: ["ABG", "Chest X-ray", "CBC", "Sputum Culture", "BNP"],
    recommended_medications: ["Salbutamol", "Ipratropium", "Prednisolone", "Amoxicillin", "Azithromycin"],
    guideline_reference: "GOLD COPD Guidelines 2023",
    danger_flag: false,
    organ_system: "respiratory",
  }),

  makeCase("pulmonology", "complex", "Tension Pneumothorax", {
    chief_complaint: "Sudden severe chest pain and extreme difficulty breathing",
    symptoms: ["sudden chest pain", "severe dyspnea", "tachycardia"],
    symptom_duration: "30 minutes",
    associated_symptoms: ["absent breath sounds on left", "tracheal deviation", "hypotension", "JVD"],
    vitals: { bp_systolic: 75, bp_diastolic: 45, pulse: 140, spo2: 80, respiratory_rate: 35 },
  }, {
    gold_standard_diagnosis: "Tension Pneumothorax",
    top_differential_diagnoses: ["Tension Pneumothorax", "Cardiac Tamponade", "Massive PE", "Hemothorax"],
    recommended_tests: ["Chest X-ray", "No delay for imaging — clinical diagnosis"],
    recommended_medications: ["Needle Decompression", "Chest Tube"],
    guideline_reference: "ATLS Guidelines",
    danger_flag: true,
    organ_system: "respiratory",
  }, ["emergency", "must_not_miss"]),

  makeCase("pulmonology", "moderate", "Pleural Effusion", {
    chief_complaint: "Progressive dyspnea and dull chest pain for 2 weeks",
    symptoms: ["progressive dyspnea", "dull chest pain", "decreased breath sounds"],
    symptom_duration: "2 weeks",
    associated_symptoms: ["dullness to percussion", "weight loss", "dry cough"],
    vitals: { pulse: 88, spo2: 93, respiratory_rate: 20, bp_systolic: 125, bp_diastolic: 78 },
    medical_history: ["Lung cancer"],
  }, {
    gold_standard_diagnosis: "Pleural Effusion",
    top_differential_diagnoses: ["Pleural Effusion", "Pneumonia", "Lung Cancer", "Heart Failure"],
    recommended_tests: ["Chest X-ray", "Thoracentesis", "CT Chest", "Pleural Fluid Analysis", "LDH", "Protein"],
    recommended_medications: ["Thoracentesis", "Diuretics"],
    guideline_reference: "BTS Pleural Disease Guidelines 2010",
    danger_flag: false,
    organ_system: "respiratory",
  }),

  makeCase("pulmonology", "common", "Acute Bronchitis", {
    chief_complaint: "Persistent cough for 10 days after a cold",
    symptoms: ["persistent cough", "chest discomfort", "mild sputum"],
    symptom_duration: "10 days",
    associated_symptoms: ["low-grade fever", "fatigue"],
    vitals: { temperature: 37.4, pulse: 80, spo2: 98, respiratory_rate: 16 },
  }, {
    gold_standard_diagnosis: "Acute Bronchitis",
    top_differential_diagnoses: ["Acute Bronchitis", "Pneumonia", "Post-Nasal Drip", "Pertussis"],
    recommended_tests: ["Chest X-ray", "CBC"],
    recommended_medications: ["Dextromethorphan", "Guaifenesin", "Honey"],
    guideline_reference: "ACP Acute Bronchitis Guidelines 2016",
    danger_flag: false,
    organ_system: "respiratory",
  }),

  makeCase("pulmonology", "complex", "Pulmonary Tuberculosis", {
    chief_complaint: "Chronic cough with hemoptysis and night sweats for 6 weeks",
    symptoms: ["chronic cough", "hemoptysis", "night sweats", "weight loss"],
    symptom_duration: "6 weeks",
    associated_symptoms: ["fever", "fatigue", "loss of appetite"],
    vitals: { temperature: 38.0, pulse: 90, spo2: 95, respiratory_rate: 18, bp_systolic: 110, bp_diastolic: 70 },
    risk_factors: ["close TB contact", "immunocompromised"],
  }, {
    gold_standard_diagnosis: "Pulmonary Tuberculosis",
    top_differential_diagnoses: ["TB", "Lung Cancer", "Lung Abscess", "Pneumonia", "Bronchiectasis"],
    recommended_tests: ["Sputum AFB", "Chest X-ray", "GeneXpert", "Mantoux Test", "IGRA"],
    recommended_medications: ["Isoniazid", "Rifampicin", "Pyrazinamide", "Ethambutol"],
    guideline_reference: "WHO TB Treatment Guidelines 2022",
    danger_flag: false,
    organ_system: "respiratory",
  }, ["chronic", "infectious"]),

  makeCase("pulmonology", "moderate", "Obstructive Sleep Apnea", {
    chief_complaint: "Excessive daytime sleepiness and loud snoring",
    symptoms: ["excessive daytime sleepiness", "loud snoring", "witnessed apneas"],
    symptom_duration: "6 months",
    associated_symptoms: ["morning headaches", "difficulty concentrating", "nocturia"],
    vitals: { bp_systolic: 145, bp_diastolic: 92, pulse: 78, spo2: 94 },
    risk_factors: ["obesity", "large neck circumference"],
  }, {
    gold_standard_diagnosis: "Obstructive Sleep Apnea",
    top_differential_diagnoses: ["OSA", "Central Sleep Apnea", "Narcolepsy", "Hypothyroidism"],
    recommended_tests: ["Polysomnography", "Epworth Sleepiness Scale", "TSH", "ABG"],
    recommended_medications: ["CPAP"],
    guideline_reference: "AASM OSA Guidelines 2019",
    danger_flag: false,
    organ_system: "respiratory",
  }),

  makeCase("pulmonology", "common", "Upper Respiratory Tract Infection", {
    chief_complaint: "Sore throat, runny nose, and sneezing for 3 days",
    symptoms: ["sore throat", "runny nose", "sneezing", "nasal congestion"],
    symptom_duration: "3 days",
    associated_symptoms: ["mild cough", "low-grade fever", "body ache"],
    vitals: { temperature: 37.6, pulse: 80, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Upper Respiratory Tract Infection",
    top_differential_diagnoses: ["URTI", "Allergic Rhinitis", "Sinusitis", "Influenza"],
    recommended_tests: ["None routinely needed"],
    recommended_medications: ["Paracetamol", "Antihistamine", "Saline Nasal Spray"],
    guideline_reference: "NICE Common Cold Guidelines",
    danger_flag: false,
    organ_system: "respiratory",
  }),

  makeCase("pulmonology", "complex", "ARDS", {
    chief_complaint: "Rapidly worsening shortness of breath requiring ICU",
    symptoms: ["severe dyspnea", "tachypnea", "hypoxemia refractory to oxygen"],
    symptom_duration: "24 hours",
    associated_symptoms: ["bilateral crackles", "cyanosis"],
    vitals: { pulse: 130, spo2: 78, respiratory_rate: 35, bp_systolic: 90, bp_diastolic: 55 },
    medical_history: ["Pneumonia", "Sepsis"],
  }, {
    gold_standard_diagnosis: "Acute Respiratory Distress Syndrome",
    top_differential_diagnoses: ["ARDS", "Cardiogenic Pulmonary Edema", "Diffuse Alveolar Hemorrhage"],
    recommended_tests: ["ABG", "Chest X-ray", "CT Chest", "Echocardiogram", "PaO2/FiO2 Ratio"],
    recommended_medications: ["Lung Protective Ventilation", "Prone Positioning", "Neuromuscular Blockade"],
    guideline_reference: "Berlin Definition ARDS 2012",
    danger_flag: true,
    organ_system: "respiratory",
  }, ["emergency", "icu"]),

  // Additional pulmonology cases
  makeCase("pulmonology", "common", "Allergic Rhinitis", {
    chief_complaint: "Recurrent sneezing, nasal itching, and watery discharge",
    symptoms: ["sneezing", "nasal itching", "watery rhinorrhea", "nasal congestion"],
    symptom_duration: "seasonal",
    associated_symptoms: ["itchy eyes", "postnasal drip"],
    vitals: { bp_systolic: 118, bp_diastolic: 72, pulse: 70, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Allergic Rhinitis",
    top_differential_diagnoses: ["Allergic Rhinitis", "Vasomotor Rhinitis", "URTI", "Sinusitis"],
    recommended_tests: ["Skin Prick Test", "Serum IgE"],
    recommended_medications: ["Cetirizine", "Fluticasone Nasal Spray", "Montelukast"],
    guideline_reference: "ARIA Guidelines 2020",
    danger_flag: false,
    organ_system: "respiratory",
  }),

  makeCase("pulmonology", "moderate", "Lung Abscess", {
    chief_complaint: "Foul-smelling productive cough and fever for 2 weeks",
    symptoms: ["productive cough", "foul sputum", "fever", "chest pain"],
    symptom_duration: "2 weeks",
    associated_symptoms: ["weight loss", "night sweats", "dyspnea"],
    vitals: { temperature: 38.5, pulse: 100, spo2: 93, respiratory_rate: 22 },
    risk_factors: ["alcoholism", "aspiration risk"],
  }, {
    gold_standard_diagnosis: "Lung Abscess",
    top_differential_diagnoses: ["Lung Abscess", "Cavitary TB", "Lung Cancer", "Empyema"],
    recommended_tests: ["Chest X-ray", "CT Chest", "Sputum Culture", "Blood Culture", "CBC"],
    recommended_medications: ["Clindamycin", "Amoxicillin-Clavulanate", "Metronidazole"],
    guideline_reference: "ATS Lung Infections Guidelines",
    danger_flag: false,
    organ_system: "respiratory",
  }),

  makeCase("pulmonology", "common", "Acute Sinusitis", {
    chief_complaint: "Facial pain and thick nasal discharge for 10 days",
    symptoms: ["facial pain", "nasal congestion", "thick nasal discharge", "headache"],
    symptom_duration: "10 days",
    associated_symptoms: ["postnasal drip", "cough", "dental pain"],
    vitals: { temperature: 38.0, pulse: 80, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Acute Bacterial Sinusitis",
    top_differential_diagnoses: ["Bacterial Sinusitis", "Viral Sinusitis", "Allergic Rhinitis", "Dental Infection"],
    recommended_tests: ["Clinical diagnosis", "CT Sinuses if refractory"],
    recommended_medications: ["Amoxicillin", "Nasal Saline", "Decongestant"],
    guideline_reference: "IDSA Sinusitis Guidelines 2012",
    danger_flag: false,
    organ_system: "respiratory",
  }),

  makeCase("pulmonology", "complex", "Interstitial Lung Disease", {
    chief_complaint: "Progressive dry cough and exertional dyspnea for 6 months",
    symptoms: ["dry cough", "exertional dyspnea", "fatigue"],
    symptom_duration: "6 months",
    associated_symptoms: ["digital clubbing", "bibasilar crackles"],
    vitals: { pulse: 85, spo2: 90, respiratory_rate: 20 },
    risk_factors: ["occupational exposure to asbestos"],
  }, {
    gold_standard_diagnosis: "Idiopathic Pulmonary Fibrosis",
    top_differential_diagnoses: ["IPF", "Hypersensitivity Pneumonitis", "Sarcoidosis", "Asbestosis"],
    recommended_tests: ["HRCT Chest", "Pulmonary Function Tests", "6-Minute Walk Test", "Lung Biopsy"],
    recommended_medications: ["Pirfenidone", "Nintedanib"],
    guideline_reference: "ATS/ERS IPF Guidelines 2022",
    danger_flag: false,
    organ_system: "respiratory",
  }),

  makeCase("pulmonology", "moderate", "Bronchiectasis", {
    chief_complaint: "Chronic productive cough with large volumes of sputum",
    symptoms: ["chronic productive cough", "copious sputum", "recurrent infections"],
    symptom_duration: "2 years",
    associated_symptoms: ["hemoptysis", "dyspnea", "fatigue"],
    vitals: { pulse: 85, spo2: 94, respiratory_rate: 18, temperature: 37.2 },
    medical_history: ["Recurrent pneumonia"],
  }, {
    gold_standard_diagnosis: "Bronchiectasis",
    top_differential_diagnoses: ["Bronchiectasis", "COPD", "Chronic Bronchitis", "Cystic Fibrosis"],
    recommended_tests: ["HRCT Chest", "Sputum Culture", "CBC", "Immunoglobulin Levels"],
    recommended_medications: ["Airway Clearance", "Azithromycin", "Inhaled Tobramycin"],
    guideline_reference: "BTS Bronchiectasis Guidelines 2019",
    danger_flag: false,
    organ_system: "respiratory",
  }),

  makeCase("pulmonology", "common", "Croup", {
    chief_complaint: "Barking cough in a 2-year-old with stridor",
    symptoms: ["barking cough", "stridor", "hoarseness"],
    symptom_duration: "1 day",
    associated_symptoms: ["low-grade fever", "inspiratory stridor worse at night"],
    vitals: { temperature: 38.0, pulse: 120, spo2: 96, respiratory_rate: 30 },
    risk_factors: ["age < 5"],
  }, {
    gold_standard_diagnosis: "Croup",
    top_differential_diagnoses: ["Croup", "Epiglottitis", "Foreign Body Aspiration", "Bacterial Tracheitis"],
    recommended_tests: ["Clinical Diagnosis", "AP Neck X-ray"],
    recommended_medications: ["Dexamethasone", "Nebulized Epinephrine"],
    guideline_reference: "AAP Croup Guidelines 2018",
    danger_flag: false,
    organ_system: "respiratory",
  }),

  makeCase("pulmonology", "complex", "Sarcoidosis", {
    chief_complaint: "Persistent dry cough, dyspnea, and bilateral hilar lymphadenopathy",
    symptoms: ["dry cough", "dyspnea", "fatigue", "erythema nodosum"],
    symptom_duration: "3 months",
    associated_symptoms: ["joint pain", "bilateral hilar lymphadenopathy", "uveitis"],
    vitals: { pulse: 80, spo2: 95, respiratory_rate: 18 },
    risk_factors: ["African American", "young adult"],
  }, {
    gold_standard_diagnosis: "Sarcoidosis",
    top_differential_diagnoses: ["Sarcoidosis", "Lymphoma", "TB", "Berylliosis"],
    recommended_tests: ["Chest X-ray", "Serum ACE", "Biopsy", "PFTs", "Calcium"],
    recommended_medications: ["Prednisolone", "Methotrexate"],
    guideline_reference: "ATS/ERS/WASOG Sarcoidosis Statement 2020",
    danger_flag: false,
    organ_system: "respiratory",
  }),

  makeCase("pulmonology", "moderate", "Influenza", {
    chief_complaint: "Sudden high fever, body aches, and cough",
    symptoms: ["high fever", "body aches", "dry cough", "headache"],
    symptom_duration: "2 days",
    associated_symptoms: ["chills", "fatigue", "sore throat", "nasal congestion"],
    vitals: { temperature: 39.5, pulse: 100, spo2: 96, respiratory_rate: 20 },
  }, {
    gold_standard_diagnosis: "Influenza",
    top_differential_diagnoses: ["Influenza", "COVID-19", "RSV", "Parainfluenza"],
    recommended_tests: ["Rapid Influenza Test", "PCR", "Chest X-ray"],
    recommended_medications: ["Oseltamivir", "Paracetamol", "Fluids"],
    guideline_reference: "IDSA Influenza Guidelines 2019",
    danger_flag: false,
    organ_system: "respiratory",
  }),

  makeCase("pulmonology", "complex", "Pulmonary Hypertension", {
    chief_complaint: "Progressive exertional dyspnea and fatigue",
    symptoms: ["exertional dyspnea", "fatigue", "chest pain", "syncope"],
    symptom_duration: "6 months",
    associated_symptoms: ["peripheral edema", "jugular venous distension", "loud P2"],
    vitals: { pulse: 95, spo2: 90, bp_systolic: 100, bp_diastolic: 60, respiratory_rate: 20 },
  }, {
    gold_standard_diagnosis: "Pulmonary Arterial Hypertension",
    top_differential_diagnoses: ["PAH", "Heart Failure", "COPD", "Chronic PE"],
    recommended_tests: ["Echocardiogram", "Right Heart Catheterization", "CT Angiography", "BNP", "PFTs"],
    recommended_medications: ["Sildenafil", "Bosentan", "Epoprostenol", "Ambrisentan"],
    guideline_reference: "ESC/ERS Pulmonary Hypertension Guidelines 2022",
    danger_flag: false,
    organ_system: "respiratory",
  }),

  makeCase("pulmonology", "common", "Pneumothorax — Simple", {
    chief_complaint: "Sudden sharp chest pain and mild dyspnea in tall thin male",
    symptoms: ["sharp chest pain", "mild dyspnea", "decreased breath sounds unilateral"],
    symptom_duration: "2 hours",
    vitals: { pulse: 90, spo2: 96, respiratory_rate: 20, bp_systolic: 120, bp_diastolic: 75 },
    risk_factors: ["tall thin male", "smoking"],
  }, {
    gold_standard_diagnosis: "Primary Spontaneous Pneumothorax",
    top_differential_diagnoses: ["Pneumothorax", "Pleuritis", "Rib Fracture", "PE"],
    recommended_tests: ["Chest X-ray", "CT Chest"],
    recommended_medications: ["Observation", "Chest Tube", "Needle Aspiration"],
    guideline_reference: "BTS Pneumothorax Guidelines 2010",
    danger_flag: false,
    organ_system: "respiratory",
  }),
];

// ═══════════════════════════════════════════════════════
// GASTROENTEROLOGY — 25 cases
// ═══════════════════════════════════════════════════════

const GASTROENTEROLOGY: BenchmarkCaseV6[] = [
  makeCase("gastroenterology", "common", "Acute Gastroenteritis", {
    chief_complaint: "Vomiting and watery diarrhea since yesterday",
    symptoms: ["vomiting", "watery diarrhea", "abdominal cramps", "nausea"],
    symptom_duration: "1 day",
    associated_symptoms: ["dehydration", "low-grade fever", "loss of appetite"],
    vitals: { temperature: 37.6, pulse: 96, bp_systolic: 110, bp_diastolic: 68 },
  }, {
    gold_standard_diagnosis: "Acute Gastroenteritis",
    top_differential_diagnoses: ["Gastroenteritis", "Food Poisoning", "Appendicitis", "IBD Flare"],
    recommended_tests: ["Stool Culture", "Electrolytes", "CBC"],
    recommended_medications: ["ORS", "Ondansetron", "Zinc"],
    guideline_reference: "WHO Diarrheal Disease Guidelines",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),

  makeCase("gastroenterology", "common", "GERD", {
    chief_complaint: "Burning sensation in chest after meals for 3 weeks",
    symptoms: ["heartburn", "acid regurgitation", "chest burning"],
    symptom_duration: "3 weeks",
    associated_symptoms: ["water brash", "chronic cough", "hoarseness"],
    vitals: { bp_systolic: 125, bp_diastolic: 78, pulse: 75, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Gastroesophageal Reflux Disease",
    top_differential_diagnoses: ["GERD", "Peptic Ulcer", "Esophagitis", "Angina"],
    recommended_tests: ["Upper GI Endoscopy", "H. pylori Test"],
    recommended_medications: ["Omeprazole", "Pantoprazole", "Antacid"],
    guideline_reference: "ACG GERD Guidelines 2022",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),

  makeCase("gastroenterology", "moderate", "Acute Pancreatitis", {
    chief_complaint: "Severe epigastric pain radiating to back after heavy drinking",
    symptoms: ["severe epigastric pain", "pain radiating to back", "nausea", "vomiting"],
    symptom_duration: "12 hours",
    associated_symptoms: ["guarding", "unable to eat", "tachycardia"],
    vitals: { pulse: 110, bp_systolic: 100, bp_diastolic: 65, temperature: 38.2 },
    risk_factors: ["heavy alcohol use", "gallstones"],
  }, {
    gold_standard_diagnosis: "Acute Pancreatitis",
    top_differential_diagnoses: ["Acute Pancreatitis", "Perforated Ulcer", "Cholecystitis", "MI"],
    recommended_tests: ["Serum Lipase", "Amylase", "CT Abdomen", "CBC", "LFTs", "Calcium"],
    recommended_medications: ["IV Fluids", "Analgesics", "NPO"],
    guideline_reference: "ACG Pancreatitis Guidelines 2013",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),

  makeCase("gastroenterology", "complex", "Acute Appendicitis", {
    chief_complaint: "Right lower abdominal pain migrating from periumbilical area",
    symptoms: ["RLQ pain", "periumbilical pain migrating to RLQ", "anorexia"],
    symptom_duration: "18 hours",
    associated_symptoms: ["nausea", "vomiting", "rebound tenderness", "Rovsing sign positive"],
    vitals: { temperature: 38.3, pulse: 95, bp_systolic: 120, bp_diastolic: 75 },
  }, {
    gold_standard_diagnosis: "Acute Appendicitis",
    top_differential_diagnoses: ["Appendicitis", "Mesenteric Lymphadenitis", "Ovarian Cyst", "Crohn Disease"],
    recommended_tests: ["CT Abdomen", "CBC", "CRP", "Urinalysis"],
    recommended_medications: ["Ceftriaxone", "Metronidazole", "Appendectomy"],
    guideline_reference: "SAGES Appendicitis Guidelines 2021",
    danger_flag: true,
    organ_system: "gastrointestinal",
  }, ["surgical", "must_not_miss"]),

  makeCase("gastroenterology", "moderate", "Peptic Ulcer Disease", {
    chief_complaint: "Burning epigastric pain worse on empty stomach",
    symptoms: ["epigastric pain", "burning sensation", "bloating"],
    symptom_duration: "3 weeks",
    associated_symptoms: ["nausea", "early satiety", "weight loss"],
    vitals: { bp_systolic: 120, bp_diastolic: 75, pulse: 78 },
  }, {
    gold_standard_diagnosis: "Peptic Ulcer Disease",
    top_differential_diagnoses: ["PUD", "GERD", "Gastric Cancer", "Functional Dyspepsia"],
    recommended_tests: ["Upper GI Endoscopy", "H. pylori Breath Test", "CBC"],
    recommended_medications: ["Omeprazole", "Amoxicillin", "Clarithromycin"],
    guideline_reference: "ACG PUD Guidelines 2017",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),

  makeCase("gastroenterology", "complex", "Upper GI Bleeding", {
    chief_complaint: "Vomiting blood and black tarry stools",
    symptoms: ["hematemesis", "melena", "dizziness", "weakness"],
    symptom_duration: "6 hours",
    associated_symptoms: ["tachycardia", "pallor", "cold clammy skin"],
    vitals: { bp_systolic: 85, bp_diastolic: 50, pulse: 125, spo2: 95 },
    medical_history: ["Alcoholic Liver Disease", "NSAIDs use"],
  }, {
    gold_standard_diagnosis: "Upper Gastrointestinal Bleeding",
    top_differential_diagnoses: ["Peptic Ulcer Bleed", "Variceal Bleed", "Mallory-Weiss Tear", "Gastric Cancer"],
    recommended_tests: ["CBC", "Type and Cross", "BUN/Creatinine", "PT/INR", "Emergent Endoscopy"],
    recommended_medications: ["IV Fluids", "PPI Infusion", "Octreotide", "Blood Transfusion"],
    guideline_reference: "ACG Upper GI Bleed Guidelines 2012",
    danger_flag: true,
    organ_system: "gastrointestinal",
  }, ["emergency", "hemorrhage"]),

  makeCase("gastroenterology", "common", "Acute Cholecystitis", {
    chief_complaint: "Right upper quadrant pain after fatty meal",
    symptoms: ["RUQ pain", "nausea", "vomiting", "fever"],
    symptom_duration: "1 day",
    associated_symptoms: ["Murphy sign positive", "pain radiating to right shoulder"],
    vitals: { temperature: 38.5, pulse: 95, bp_systolic: 130, bp_diastolic: 82 },
    risk_factors: ["female", "obesity", "age 40"],
  }, {
    gold_standard_diagnosis: "Acute Cholecystitis",
    top_differential_diagnoses: ["Cholecystitis", "Choledocholithiasis", "Hepatitis", "Pancreatitis"],
    recommended_tests: ["RUQ Ultrasound", "CBC", "LFTs", "Lipase", "HIDA Scan"],
    recommended_medications: ["Ceftriaxone", "Metronidazole", "Cholecystectomy"],
    guideline_reference: "Tokyo Guidelines 2018",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),

  makeCase("gastroenterology", "moderate", "Ulcerative Colitis Flare", {
    chief_complaint: "Bloody diarrhea and abdominal cramps for 1 week",
    symptoms: ["bloody diarrhea", "abdominal cramps", "tenesmus", "urgency"],
    symptom_duration: "1 week",
    associated_symptoms: ["weight loss", "fatigue", "low-grade fever"],
    vitals: { temperature: 37.8, pulse: 88, bp_systolic: 115, bp_diastolic: 70 },
    medical_history: ["Ulcerative Colitis"],
    medications: ["Mesalamine"],
  }, {
    gold_standard_diagnosis: "Ulcerative Colitis Flare",
    top_differential_diagnoses: ["UC Flare", "Infectious Colitis", "Crohn Disease", "Ischemic Colitis"],
    recommended_tests: ["Colonoscopy", "Stool Culture", "CBC", "CRP", "Calprotectin"],
    recommended_medications: ["Prednisolone", "Mesalamine", "Infliximab"],
    guideline_reference: "ACG UC Guidelines 2019",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),

  makeCase("gastroenterology", "complex", "Bowel Obstruction", {
    chief_complaint: "Severe colicky abdominal pain with inability to pass gas or stool",
    symptoms: ["colicky abdominal pain", "abdominal distension", "vomiting", "constipation"],
    symptom_duration: "2 days",
    associated_symptoms: ["high-pitched bowel sounds", "no flatus"],
    vitals: { pulse: 100, bp_systolic: 105, bp_diastolic: 65, temperature: 37.5 },
    medical_history: ["Previous abdominal surgery"],
  }, {
    gold_standard_diagnosis: "Small Bowel Obstruction",
    top_differential_diagnoses: ["SBO", "Large Bowel Obstruction", "Ileus", "Volvulus"],
    recommended_tests: ["Abdominal X-ray", "CT Abdomen", "BMP", "CBC", "Lactate"],
    recommended_medications: ["NG Decompression", "IV Fluids", "Surgery if strangulated"],
    guideline_reference: "SAGES SBO Guidelines 2017",
    danger_flag: true,
    organ_system: "gastrointestinal",
  }, ["surgical"]),

  makeCase("gastroenterology", "common", "Irritable Bowel Syndrome", {
    chief_complaint: "Recurrent abdominal pain relieved by defecation",
    symptoms: ["recurrent abdominal pain", "altered bowel habits", "bloating"],
    symptom_duration: "6 months",
    associated_symptoms: ["mucus in stool", "pain improves after defecation"],
    vitals: { bp_systolic: 118, bp_diastolic: 72, pulse: 72, spo2: 99 },
  }, {
    gold_standard_diagnosis: "Irritable Bowel Syndrome",
    top_differential_diagnoses: ["IBS", "IBD", "Celiac Disease", "Colorectal Cancer"],
    recommended_tests: ["CBC", "CRP", "Celiac Serology", "Stool Calprotectin"],
    recommended_medications: ["Mebeverine", "Fiber Supplement", "Loperamide"],
    guideline_reference: "ACG IBS Guidelines 2021",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),

  makeCase("gastroenterology", "moderate", "Hepatitis B — Acute", {
    chief_complaint: "Jaundice, dark urine, and fatigue for 1 week",
    symptoms: ["jaundice", "dark urine", "fatigue", "nausea"],
    symptom_duration: "1 week",
    associated_symptoms: ["RUQ pain", "clay-colored stools", "loss of appetite"],
    vitals: { temperature: 37.8, pulse: 82, bp_systolic: 120, bp_diastolic: 75 },
    risk_factors: ["unprotected sexual contact"],
  }, {
    gold_standard_diagnosis: "Acute Hepatitis B",
    top_differential_diagnoses: ["Hepatitis B", "Hepatitis A", "Drug-Induced Hepatitis", "Biliary Obstruction"],
    recommended_tests: ["HBsAg", "Anti-HBc IgM", "LFTs", "PT/INR", "Hepatitis Panel"],
    recommended_medications: ["Supportive Care", "Entecavir"],
    guideline_reference: "AASLD Hepatitis B Guidelines 2018",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),

  makeCase("gastroenterology", "complex", "Acute Liver Failure", {
    chief_complaint: "Rapidly progressive jaundice with confusion",
    symptoms: ["jaundice", "confusion", "coagulopathy"],
    symptom_duration: "5 days",
    associated_symptoms: ["asterixis", "hemorrhagic tendency", "ascites"],
    vitals: { pulse: 110, bp_systolic: 90, bp_diastolic: 55, temperature: 38.0 },
    medical_history: ["Acetaminophen overdose"],
  }, {
    gold_standard_diagnosis: "Acute Liver Failure",
    top_differential_diagnoses: ["Acute Liver Failure", "Decompensated Cirrhosis", "Hepatic Vein Thrombosis"],
    recommended_tests: ["LFTs", "PT/INR", "Ammonia", "Acetaminophen Level", "Hepatitis Panel", "Lactate"],
    recommended_medications: ["N-Acetylcysteine", "Lactulose", "Fresh Frozen Plasma"],
    guideline_reference: "AASLD ALF Guidelines 2011",
    danger_flag: true,
    organ_system: "gastrointestinal",
  }, ["emergency", "icu"]),

  makeCase("gastroenterology", "common", "Functional Dyspepsia", {
    chief_complaint: "Upper abdominal discomfort and early satiety",
    symptoms: ["epigastric discomfort", "early satiety", "bloating"],
    symptom_duration: "2 months",
    vitals: { bp_systolic: 120, bp_diastolic: 75, pulse: 72 },
  }, {
    gold_standard_diagnosis: "Functional Dyspepsia",
    top_differential_diagnoses: ["Functional Dyspepsia", "PUD", "GERD", "Gastroparesis"],
    recommended_tests: ["H. pylori Test", "Upper GI Endoscopy"],
    recommended_medications: ["PPI Trial", "Prokinetics"],
    guideline_reference: "ACG Dyspepsia Guidelines 2017",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),

  makeCase("gastroenterology", "moderate", "Diverticulitis", {
    chief_complaint: "Left lower quadrant pain with fever",
    symptoms: ["LLQ pain", "fever", "nausea"],
    symptom_duration: "2 days",
    associated_symptoms: ["constipation", "guarding"],
    vitals: { temperature: 38.4, pulse: 92, bp_systolic: 130, bp_diastolic: 80 },
    risk_factors: ["age > 50", "low fiber diet"],
  }, {
    gold_standard_diagnosis: "Acute Diverticulitis",
    top_differential_diagnoses: ["Diverticulitis", "Colorectal Cancer", "IBD", "Ovarian Torsion"],
    recommended_tests: ["CT Abdomen", "CBC", "CRP", "Urinalysis"],
    recommended_medications: ["Ciprofloxacin", "Metronidazole", "Clear Liquids"],
    guideline_reference: "AGA Diverticulitis Guidelines 2015",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),

  makeCase("gastroenterology", "complex", "Crohn Disease — New Diagnosis", {
    chief_complaint: "Chronic diarrhea, abdominal pain, and weight loss for 3 months",
    symptoms: ["chronic diarrhea", "abdominal pain", "weight loss"],
    symptom_duration: "3 months",
    associated_symptoms: ["perianal fistula", "oral ulcers", "joint pain", "fever"],
    vitals: { temperature: 37.6, pulse: 85, bp_systolic: 110, bp_diastolic: 70 },
    risk_factors: ["young adult", "smoking"],
  }, {
    gold_standard_diagnosis: "Crohn Disease",
    top_differential_diagnoses: ["Crohn Disease", "Ulcerative Colitis", "Intestinal TB", "Celiac Disease"],
    recommended_tests: ["Colonoscopy with Biopsy", "CT Enterography", "CBC", "CRP", "Fecal Calprotectin"],
    recommended_medications: ["Mesalamine", "Prednisolone", "Azathioprine", "Infliximab"],
    guideline_reference: "ACG Crohn Disease Guidelines 2018",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),

  // Fill remaining GI cases
  makeCase("gastroenterology", "common", "Celiac Disease", {
    chief_complaint: "Chronic diarrhea, bloating, and fatigue",
    symptoms: ["chronic diarrhea", "bloating", "fatigue", "iron deficiency"],
    symptom_duration: "4 months",
    associated_symptoms: ["weight loss", "dermatitis herpetiformis"],
    vitals: { bp_systolic: 110, bp_diastolic: 68, pulse: 78 },
  }, {
    gold_standard_diagnosis: "Celiac Disease",
    top_differential_diagnoses: ["Celiac Disease", "IBS", "IBD", "Lactose Intolerance"],
    recommended_tests: ["tTG-IgA", "Duodenal Biopsy", "CBC", "Iron Studies"],
    recommended_medications: ["Gluten-Free Diet"],
    guideline_reference: "ACG Celiac Guidelines 2013",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),

  makeCase("gastroenterology", "moderate", "Choledocholithiasis", {
    chief_complaint: "Jaundice and RUQ pain after cholecystectomy",
    symptoms: ["jaundice", "RUQ pain", "dark urine", "clay stools"],
    symptom_duration: "3 days",
    associated_symptoms: ["pruritus", "nausea"],
    vitals: { temperature: 37.8, pulse: 85, bp_systolic: 130, bp_diastolic: 80 },
    medical_history: ["Previous cholecystectomy"],
  }, {
    gold_standard_diagnosis: "Choledocholithiasis",
    top_differential_diagnoses: ["CBD Stone", "Cholangitis", "Pancreatic Head Mass", "Drug-Induced Cholestasis"],
    recommended_tests: ["MRCP", "LFTs", "Ultrasound", "ERCP"],
    recommended_medications: ["ERCP with Sphincterotomy", "Antibiotics if cholangitis"],
    guideline_reference: "ASGE CBD Stone Guidelines 2019",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),

  makeCase("gastroenterology", "complex", "Ascending Cholangitis", {
    chief_complaint: "Fever, jaundice, and RUQ pain — Charcot triad",
    symptoms: ["fever", "jaundice", "RUQ pain"],
    symptom_duration: "1 day",
    associated_symptoms: ["confusion", "hypotension", "rigors"],
    vitals: { temperature: 39.5, pulse: 115, bp_systolic: 85, bp_diastolic: 50 },
    medical_history: ["Gallstones"],
  }, {
    gold_standard_diagnosis: "Ascending Cholangitis",
    top_differential_diagnoses: ["Cholangitis", "Cholecystitis", "Hepatic Abscess", "Sepsis"],
    recommended_tests: ["Blood Culture", "LFTs", "CBC", "Ultrasound", "MRCP"],
    recommended_medications: ["Piperacillin-Tazobactam", "ERCP", "IV Fluids"],
    guideline_reference: "Tokyo Guidelines 2018",
    danger_flag: true,
    organ_system: "gastrointestinal",
  }, ["emergency", "sepsis_risk"]),

  makeCase("gastroenterology", "common", "Gastric Ulcer", {
    chief_complaint: "Epigastric pain worse after eating",
    symptoms: ["epigastric pain", "nausea", "weight loss"],
    symptom_duration: "4 weeks",
    associated_symptoms: ["anorexia", "early satiety"],
    vitals: { bp_systolic: 120, bp_diastolic: 75, pulse: 78 },
    medications: ["Ibuprofen"],
  }, {
    gold_standard_diagnosis: "Gastric Ulcer",
    top_differential_diagnoses: ["Gastric Ulcer", "Gastric Cancer", "GERD", "Functional Dyspepsia"],
    recommended_tests: ["Upper GI Endoscopy", "Biopsy", "H. pylori Test", "CBC"],
    recommended_medications: ["Omeprazole", "H. pylori Eradication"],
    guideline_reference: "ACG PUD Guidelines 2017",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),

  makeCase("gastroenterology", "moderate", "Cirrhosis with Ascites", {
    chief_complaint: "Increasing abdominal distension and leg swelling",
    symptoms: ["abdominal distension", "bilateral leg edema", "fatigue"],
    symptom_duration: "3 weeks",
    associated_symptoms: ["jaundice", "spider angiomata", "palmar erythema"],
    vitals: { bp_systolic: 105, bp_diastolic: 62, pulse: 88 },
    medical_history: ["Chronic Hepatitis C", "Heavy alcohol use"],
  }, {
    gold_standard_diagnosis: "Decompensated Liver Cirrhosis",
    top_differential_diagnoses: ["Cirrhosis", "Heart Failure", "Nephrotic Syndrome", "Peritoneal Carcinomatosis"],
    recommended_tests: ["Paracentesis", "LFTs", "Albumin", "INR", "Renal Function", "Ultrasound Abdomen"],
    recommended_medications: ["Spironolactone", "Furosemide", "Salt Restriction", "Albumin"],
    guideline_reference: "AASLD Cirrhosis Guidelines 2021",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),
];

// ═══════════════════════════════════════════════════════
// INFECTIOUS DISEASE — 25 cases
// ═══════════════════════════════════════════════════════

const INFECTIOUS_DISEASE: BenchmarkCaseV6[] = [
  makeCase("infectious_disease", "common", "Dengue Fever", {
    chief_complaint: "High fever, severe body aches, and rash for 4 days",
    symptoms: ["high fever", "severe body aches", "retro-orbital pain", "maculopapular rash"],
    symptom_duration: "4 days",
    associated_symptoms: ["headache", "nausea", "bleeding gums"],
    vitals: { temperature: 39.5, pulse: 100, bp_systolic: 100, bp_diastolic: 60 },
    risk_factors: ["monsoon season", "endemic area"],
  }, {
    gold_standard_diagnosis: "Dengue Fever",
    top_differential_diagnoses: ["Dengue", "Chikungunya", "Malaria", "Zika", "Typhoid"],
    recommended_tests: ["Dengue NS1", "Dengue IgM/IgG", "CBC", "Platelet Count", "LFTs"],
    recommended_medications: ["Paracetamol", "IV Fluids", "Platelet Monitoring"],
    guideline_reference: "WHO Dengue Guidelines 2009",
    danger_flag: false,
    organ_system: "infectious",
  }),

  makeCase("infectious_disease", "common", "Malaria — P. falciparum", {
    chief_complaint: "Cyclical high fever with chills and rigors",
    symptoms: ["high fever", "chills", "rigors", "diaphoresis"],
    symptom_duration: "3 days",
    associated_symptoms: ["headache", "body aches", "nausea", "splenomegaly"],
    vitals: { temperature: 40.0, pulse: 110, bp_systolic: 100, bp_diastolic: 65 },
    risk_factors: ["travel to endemic area"],
  }, {
    gold_standard_diagnosis: "Malaria",
    top_differential_diagnoses: ["Malaria", "Dengue", "Typhoid", "Viral Fever", "Leptospirosis"],
    recommended_tests: ["Blood Smear", "Rapid Malaria Test", "CBC", "LFTs", "Renal Function"],
    recommended_medications: ["Artemether-Lumefantrine", "Chloroquine", "Primaquine"],
    guideline_reference: "WHO Malaria Treatment Guidelines 2022",
    danger_flag: false,
    organ_system: "infectious",
  }),

  makeCase("infectious_disease", "moderate", "Typhoid Fever", {
    chief_complaint: "Step-ladder fever with headache and abdominal pain for 7 days",
    symptoms: ["step-ladder fever", "headache", "abdominal pain", "diarrhea"],
    symptom_duration: "7 days",
    associated_symptoms: ["rose spots", "relative bradycardia", "hepatosplenomegaly"],
    vitals: { temperature: 39.8, pulse: 80, bp_systolic: 110, bp_diastolic: 70 },
    risk_factors: ["contaminated water exposure"],
  }, {
    gold_standard_diagnosis: "Typhoid Fever",
    top_differential_diagnoses: ["Typhoid", "Malaria", "Brucellosis", "Endocarditis"],
    recommended_tests: ["Blood Culture", "Widal Test", "CBC", "LFTs"],
    recommended_medications: ["Azithromycin", "Ceftriaxone", "Ciprofloxacin"],
    guideline_reference: "WHO Typhoid Guidelines",
    danger_flag: false,
    organ_system: "infectious",
  }),

  makeCase("infectious_disease", "complex", "Sepsis — Urinary Source", {
    chief_complaint: "High fever, confusion, and foul-smelling urine",
    symptoms: ["high fever", "confusion", "dysuria", "rigors"],
    symptom_duration: "1 day",
    associated_symptoms: ["hypotension", "tachycardia", "oliguria"],
    vitals: { temperature: 39.5, pulse: 125, bp_systolic: 80, bp_diastolic: 45, spo2: 93 },
    medical_history: ["Diabetes", "Urinary Catheter"],
    risk_factors: ["catheter", "immunocompromised"],
  }, {
    gold_standard_diagnosis: "Sepsis",
    top_differential_diagnoses: ["Urosepsis", "Pyelonephritis", "Endocarditis", "Meningitis"],
    recommended_tests: ["Blood Culture", "Urine Culture", "CBC", "Lactate", "Procalcitonin", "BMP"],
    recommended_medications: ["Piperacillin-Tazobactam", "Vancomycin", "IV Fluids", "Vasopressors"],
    guideline_reference: "Surviving Sepsis Campaign 2021",
    danger_flag: true,
    organ_system: "infectious",
  }, ["emergency", "must_not_miss"]),

  makeCase("infectious_disease", "common", "Urinary Tract Infection", {
    chief_complaint: "Burning during urination and increased frequency",
    symptoms: ["dysuria", "urinary frequency", "urgency", "suprapubic pain"],
    symptom_duration: "3 days",
    associated_symptoms: ["cloudy urine", "mild hematuria"],
    vitals: { temperature: 37.5, pulse: 80, bp_systolic: 120, bp_diastolic: 75 },
    risk_factors: ["female"],
  }, {
    gold_standard_diagnosis: "Lower Urinary Tract Infection",
    top_differential_diagnoses: ["UTI", "Vaginitis", "STI", "Interstitial Cystitis"],
    recommended_tests: ["Urinalysis", "Urine Culture"],
    recommended_medications: ["Nitrofurantoin", "Trimethoprim-Sulfamethoxazole", "Fosfomycin"],
    guideline_reference: "IDSA UTI Guidelines 2011",
    danger_flag: false,
    organ_system: "infectious",
  }),

  makeCase("infectious_disease", "moderate", "Cellulitis", {
    chief_complaint: "Red, warm, swollen area on right leg for 2 days",
    symptoms: ["erythema", "warmth", "swelling", "pain in right leg"],
    symptom_duration: "2 days",
    associated_symptoms: ["fever", "lymphangitis", "red streaking"],
    vitals: { temperature: 38.2, pulse: 88, bp_systolic: 125, bp_diastolic: 78 },
    risk_factors: ["diabetes", "skin break"],
  }, {
    gold_standard_diagnosis: "Cellulitis",
    top_differential_diagnoses: ["Cellulitis", "DVT", "Erysipelas", "Necrotizing Fasciitis"],
    recommended_tests: ["CBC", "Blood Culture", "CRP"],
    recommended_medications: ["Cephalexin", "Clindamycin", "Amoxicillin-Clavulanate"],
    guideline_reference: "IDSA Skin Infection Guidelines 2014",
    danger_flag: false,
    organ_system: "infectious",
  }),

  makeCase("infectious_disease", "complex", "HIV — Acute Retroviral Syndrome", {
    chief_complaint: "Fever, rash, and sore throat for 2 weeks after unprotected sex",
    symptoms: ["fever", "maculopapular rash", "pharyngitis", "lymphadenopathy"],
    symptom_duration: "2 weeks",
    associated_symptoms: ["myalgia", "oral ulcers", "weight loss"],
    vitals: { temperature: 38.5, pulse: 90, bp_systolic: 118, bp_diastolic: 72 },
    risk_factors: ["unprotected sexual contact"],
  }, {
    gold_standard_diagnosis: "Acute HIV Infection",
    top_differential_diagnoses: ["Acute HIV", "Infectious Mononucleosis", "Secondary Syphilis", "CMV"],
    recommended_tests: ["HIV RNA PCR", "4th Gen HIV Test", "CD4 Count", "CBC", "RPR"],
    recommended_medications: ["ART Initiation"],
    guideline_reference: "DHHS HIV Guidelines 2023",
    danger_flag: false,
    organ_system: "infectious",
  }),

  makeCase("infectious_disease", "common", "Chickenpox", {
    chief_complaint: "Vesicular rash on trunk spreading to face and extremities",
    symptoms: ["vesicular rash", "fever", "pruritus"],
    symptom_duration: "3 days",
    associated_symptoms: ["rash in different stages", "fatigue", "headache"],
    vitals: { temperature: 38.2, pulse: 90, spo2: 99 },
    risk_factors: ["unvaccinated", "child contact"],
  }, {
    gold_standard_diagnosis: "Varicella (Chickenpox)",
    top_differential_diagnoses: ["Varicella", "Herpes Zoster Disseminated", "Smallpox", "Hand Foot Mouth"],
    recommended_tests: ["Clinical Diagnosis", "VZV PCR if needed"],
    recommended_medications: ["Acyclovir", "Calamine", "Antihistamine"],
    guideline_reference: "AAP Red Book Varicella 2021",
    danger_flag: false,
    organ_system: "infectious",
  }),

  makeCase("infectious_disease", "moderate", "Tuberculosis — Extrapulmonary (Lymph Node)", {
    chief_complaint: "Painless neck swelling with night sweats and weight loss",
    symptoms: ["cervical lymphadenopathy", "night sweats", "weight loss", "low-grade fever"],
    symptom_duration: "6 weeks",
    associated_symptoms: ["matted lymph nodes", "fatigue"],
    vitals: { temperature: 37.5, pulse: 80, spo2: 98 },
    risk_factors: ["TB contact", "immunosuppressed"],
  }, {
    gold_standard_diagnosis: "TB Lymphadenitis",
    top_differential_diagnoses: ["TB Lymphadenitis", "Lymphoma", "Reactive Lymphadenopathy", "Sarcoidosis"],
    recommended_tests: ["FNAC", "GeneXpert", "Chest X-ray", "Mantoux Test", "Biopsy"],
    recommended_medications: ["HRZE Regimen"],
    guideline_reference: "WHO Extrapulmonary TB Guidelines",
    danger_flag: false,
    organ_system: "infectious",
  }),

  makeCase("infectious_disease", "complex", "Necrotizing Fasciitis", {
    chief_complaint: "Rapidly spreading painful redness and swelling in leg with systemic toxicity",
    symptoms: ["severe pain disproportionate to findings", "rapidly spreading erythema", "blistering"],
    symptom_duration: "12 hours",
    associated_symptoms: ["crepitus", "hemodynamic instability", "high fever"],
    vitals: { temperature: 39.5, pulse: 130, bp_systolic: 85, bp_diastolic: 50 },
    medical_history: ["Diabetes"],
    risk_factors: ["diabetes", "immunocompromised"],
  }, {
    gold_standard_diagnosis: "Necrotizing Fasciitis",
    top_differential_diagnoses: ["Necrotizing Fasciitis", "Cellulitis", "Gas Gangrene", "DVT"],
    recommended_tests: ["CBC", "CRP", "Blood Culture", "CK", "Lactate", "Surgical Exploration"],
    recommended_medications: ["Meropenem", "Vancomycin", "Clindamycin", "Surgical Debridement"],
    guideline_reference: "IDSA Skin Infection Guidelines 2014",
    danger_flag: true,
    organ_system: "infectious",
  }, ["emergency", "surgical"]),

  // Fill remaining infectious disease (15 more)
  makeCase("infectious_disease", "common", "Pharyngitis — Strep", {
    chief_complaint: "Severe sore throat with fever and tonsillar exudates",
    symptoms: ["sore throat", "fever", "difficulty swallowing"],
    symptom_duration: "2 days",
    associated_symptoms: ["tonsillar exudates", "tender anterior cervical lymph nodes", "no cough"],
    vitals: { temperature: 38.5, pulse: 88 },
  }, {
    gold_standard_diagnosis: "Streptococcal Pharyngitis",
    top_differential_diagnoses: ["Strep Pharyngitis", "Viral Pharyngitis", "Infectious Mono", "Peritonsillar Abscess"],
    recommended_tests: ["Rapid Strep Test", "Throat Culture"],
    recommended_medications: ["Amoxicillin", "Penicillin V"],
    guideline_reference: "IDSA Pharyngitis Guidelines 2012",
    danger_flag: false,
    organ_system: "infectious",
  }),

  makeCase("infectious_disease", "moderate", "Infectious Mononucleosis", {
    chief_complaint: "Prolonged sore throat, fatigue, and swollen lymph nodes",
    symptoms: ["sore throat", "fatigue", "lymphadenopathy", "fever"],
    symptom_duration: "2 weeks",
    associated_symptoms: ["splenomegaly", "hepatomegaly", "palatal petechiae"],
    vitals: { temperature: 38.0, pulse: 85 },
    risk_factors: ["young adult"],
  }, {
    gold_standard_diagnosis: "Infectious Mononucleosis",
    top_differential_diagnoses: ["EBV Mono", "Acute HIV", "CMV", "Strep Pharyngitis", "Lymphoma"],
    recommended_tests: ["Monospot", "EBV Panel", "CBC", "LFTs"],
    recommended_medications: ["Supportive Care", "Avoid Contact Sports"],
    guideline_reference: "UpToDate EBV Mono 2023",
    danger_flag: false,
    organ_system: "infectious",
  }),

  makeCase("infectious_disease", "common", "Gastroenteritis — Viral", {
    chief_complaint: "Watery diarrhea and vomiting in family outbreak",
    symptoms: ["watery diarrhea", "vomiting", "nausea", "abdominal cramps"],
    symptom_duration: "2 days",
    associated_symptoms: ["low-grade fever", "myalgia"],
    vitals: { temperature: 37.5, pulse: 90, bp_systolic: 108, bp_diastolic: 65 },
  }, {
    gold_standard_diagnosis: "Viral Gastroenteritis",
    top_differential_diagnoses: ["Norovirus", "Rotavirus", "Food Poisoning", "Bacterial Gastroenteritis"],
    recommended_tests: ["Clinical Diagnosis", "Electrolytes if dehydrated"],
    recommended_medications: ["ORS", "Ondansetron"],
    guideline_reference: "WHO Diarrheal Disease Guidelines",
    danger_flag: false,
    organ_system: "infectious",
  }),

  makeCase("infectious_disease", "moderate", "Pyelonephritis", {
    chief_complaint: "High fever, flank pain, and painful urination",
    symptoms: ["flank pain", "high fever", "dysuria", "urinary frequency"],
    symptom_duration: "2 days",
    associated_symptoms: ["nausea", "vomiting", "CVA tenderness"],
    vitals: { temperature: 39.2, pulse: 100, bp_systolic: 115, bp_diastolic: 70 },
    risk_factors: ["female", "recent UTI"],
  }, {
    gold_standard_diagnosis: "Acute Pyelonephritis",
    top_differential_diagnoses: ["Pyelonephritis", "Renal Abscess", "Nephrolithiasis", "Appendicitis"],
    recommended_tests: ["Urinalysis", "Urine Culture", "Blood Culture", "CBC", "BMP"],
    recommended_medications: ["Ciprofloxacin", "Ceftriaxone", "IV Fluids"],
    guideline_reference: "IDSA UTI Guidelines 2011",
    danger_flag: false,
    organ_system: "infectious",
  }),

  makeCase("infectious_disease", "complex", "Leptospirosis", {
    chief_complaint: "Fever, myalgia, and conjunctival suffusion after flood exposure",
    symptoms: ["fever", "severe myalgia", "conjunctival suffusion", "headache"],
    symptom_duration: "5 days",
    associated_symptoms: ["jaundice", "oliguria", "hemorrhagic manifestations"],
    vitals: { temperature: 39.0, pulse: 105, bp_systolic: 100, bp_diastolic: 60 },
    risk_factors: ["flood water exposure", "monsoon season"],
  }, {
    gold_standard_diagnosis: "Leptospirosis",
    top_differential_diagnoses: ["Leptospirosis", "Dengue", "Malaria", "Hepatitis A", "Hantavirus"],
    recommended_tests: ["Leptospira IgM", "MAT", "CBC", "LFTs", "Renal Function", "Blood Culture"],
    recommended_medications: ["Doxycycline", "Penicillin G", "Ceftriaxone"],
    guideline_reference: "WHO Leptospirosis Guidelines 2003",
    danger_flag: true,
    organ_system: "infectious",
  }, ["tropical", "hemorrhagic_risk"]),

  makeCase("infectious_disease", "common", "Herpes Zoster", {
    chief_complaint: "Painful vesicular rash on left chest in dermatomal pattern",
    symptoms: ["vesicular rash", "dermatomal pain", "burning sensation"],
    symptom_duration: "4 days",
    associated_symptoms: ["hyperesthesia", "fever", "fatigue"],
    vitals: { temperature: 37.5, pulse: 78 },
    risk_factors: ["age > 50", "previous chickenpox"],
  }, {
    gold_standard_diagnosis: "Herpes Zoster",
    top_differential_diagnoses: ["Herpes Zoster", "Contact Dermatitis", "HSV", "Dermatitis Herpetiformis"],
    recommended_tests: ["Clinical Diagnosis", "VZV PCR"],
    recommended_medications: ["Valacyclovir", "Gabapentin", "Calamine"],
    guideline_reference: "IDSA Herpes Zoster Guidelines",
    danger_flag: false,
    organ_system: "infectious",
  }),

  makeCase("infectious_disease", "moderate", "Scrub Typhus", {
    chief_complaint: "Fever with eschar and lymphadenopathy after outdoor exposure",
    symptoms: ["fever", "headache", "myalgia", "rash"],
    symptom_duration: "5 days",
    associated_symptoms: ["eschar", "regional lymphadenopathy", "hepatosplenomegaly"],
    vitals: { temperature: 39.5, pulse: 100, bp_systolic: 105, bp_diastolic: 65 },
    risk_factors: ["rural exposure", "outdoor work"],
  }, {
    gold_standard_diagnosis: "Scrub Typhus",
    top_differential_diagnoses: ["Scrub Typhus", "Murine Typhus", "Dengue", "Leptospirosis", "Malaria"],
    recommended_tests: ["Scrub Typhus IgM", "Weil-Felix Test", "CBC", "LFTs"],
    recommended_medications: ["Doxycycline", "Azithromycin"],
    guideline_reference: "WHO Rickettsial Diseases Guidelines",
    danger_flag: false,
    organ_system: "infectious",
  }),

  makeCase("infectious_disease", "complex", "Tetanus", {
    chief_complaint: "Jaw stiffness and generalized muscle spasms after puncture wound",
    symptoms: ["trismus", "muscle spasms", "opisthotonus"],
    symptom_duration: "3 days",
    associated_symptoms: ["dysphagia", "risus sardonicus", "autonomic instability"],
    vitals: { temperature: 38.0, pulse: 120, bp_systolic: 160, bp_diastolic: 100 },
    risk_factors: ["unvaccinated", "puncture wound"],
  }, {
    gold_standard_diagnosis: "Tetanus",
    top_differential_diagnoses: ["Tetanus", "Strychnine Poisoning", "Meningitis", "Dystonic Reaction"],
    recommended_tests: ["Clinical Diagnosis", "Wound Culture"],
    recommended_medications: ["Tetanus Immunoglobulin", "Metronidazole", "Diazepam", "Tetanus Toxoid"],
    guideline_reference: "WHO Tetanus Guidelines",
    danger_flag: true,
    organ_system: "infectious",
  }, ["emergency"]),

  makeCase("infectious_disease", "common", "Candidal Vaginitis", {
    chief_complaint: "Itching and thick white vaginal discharge",
    symptoms: ["vaginal itching", "thick white discharge", "vulvar burning"],
    symptom_duration: "5 days",
    associated_symptoms: ["dysuria", "dyspareunia"],
    vitals: { bp_systolic: 115, bp_diastolic: 70, pulse: 72 },
    risk_factors: ["recent antibiotic use", "diabetes"],
  }, {
    gold_standard_diagnosis: "Vulvovaginal Candidiasis",
    top_differential_diagnoses: ["Candidal Vaginitis", "Bacterial Vaginosis", "Trichomoniasis", "Contact Dermatitis"],
    recommended_tests: ["Vaginal Swab", "KOH Prep", "pH Testing"],
    recommended_medications: ["Fluconazole", "Clotrimazole"],
    guideline_reference: "CDC STI Guidelines 2021",
    danger_flag: false,
    organ_system: "infectious",
  }),

  makeCase("infectious_disease", "moderate", "Chikungunya", {
    chief_complaint: "Severe joint pain with fever and rash",
    symptoms: ["severe polyarthralgia", "high fever", "maculopapular rash"],
    symptom_duration: "3 days",
    associated_symptoms: ["headache", "myalgia", "conjunctivitis"],
    vitals: { temperature: 39.2, pulse: 95, bp_systolic: 110, bp_diastolic: 70 },
    risk_factors: ["endemic area", "monsoon"],
  }, {
    gold_standard_diagnosis: "Chikungunya",
    top_differential_diagnoses: ["Chikungunya", "Dengue", "Zika", "Rheumatic Fever", "Reactive Arthritis"],
    recommended_tests: ["Chikungunya IgM", "CBC", "CRP"],
    recommended_medications: ["Paracetamol", "NSAIDs", "Rest"],
    guideline_reference: "WHO Chikungunya Guidelines",
    danger_flag: false,
    organ_system: "infectious",
  }),

  makeCase("infectious_disease", "complex", "Cerebral Malaria", {
    chief_complaint: "High fever with altered sensorium and convulsions",
    symptoms: ["high fever", "altered consciousness", "convulsions"],
    symptom_duration: "2 days",
    associated_symptoms: ["severe anemia", "hepatosplenomegaly", "jaundice"],
    vitals: { temperature: 40.5, pulse: 130, bp_systolic: 85, bp_diastolic: 50, spo2: 90 },
    risk_factors: ["endemic malaria area"],
  }, {
    gold_standard_diagnosis: "Cerebral Malaria",
    top_differential_diagnoses: ["Cerebral Malaria", "Meningitis", "Encephalitis", "Typhoid Encephalopathy"],
    recommended_tests: ["Blood Smear", "Rapid Malaria Test", "CBC", "Blood Glucose", "Lactate", "LP"],
    recommended_medications: ["IV Artesunate", "Quinine", "Phenobarbital"],
    guideline_reference: "WHO Severe Malaria Guidelines 2022",
    danger_flag: true,
    organ_system: "infectious",
  }, ["emergency", "must_not_miss"]),
];

// ═══════════════════════════════════════════════════════
// EMERGENCY MEDICINE — 25 cases
// ═══════════════════════════════════════════════════════

const EMERGENCY_MEDICINE: BenchmarkCaseV6[] = [
  makeCase("emergency_medicine", "common", "Anaphylaxis", {
    chief_complaint: "Difficulty breathing and hives after eating peanuts",
    symptoms: ["urticaria", "angioedema", "dyspnea", "wheezing"],
    symptom_duration: "30 minutes",
    associated_symptoms: ["hypotension", "tachycardia", "throat tightness", "vomiting"],
    vitals: { bp_systolic: 75, bp_diastolic: 40, pulse: 130, spo2: 88, respiratory_rate: 28 },
    allergies: ["Peanuts"],
  }, {
    gold_standard_diagnosis: "Anaphylaxis",
    top_differential_diagnoses: ["Anaphylaxis", "Severe Asthma", "Angioedema", "Carcinoid Syndrome"],
    recommended_tests: ["Tryptase Level", "CBC", "ABG"],
    recommended_medications: ["Epinephrine IM", "Diphenhydramine", "Methylprednisolone", "IV Fluids"],
    guideline_reference: "WAO Anaphylaxis Guidelines 2020",
    danger_flag: true,
    organ_system: "immune",
  }, ["emergency", "must_not_miss"]),

  makeCase("emergency_medicine", "complex", "Ectopic Pregnancy", {
    chief_complaint: "Acute lower abdominal pain with vaginal bleeding and missed period",
    symptoms: ["lower abdominal pain", "vaginal bleeding", "amenorrhea"],
    symptom_duration: "6 hours",
    associated_symptoms: ["dizziness", "shoulder tip pain", "adnexal tenderness"],
    vitals: { bp_systolic: 90, bp_diastolic: 55, pulse: 115 },
    risk_factors: ["previous ectopic", "IUD"],
  }, {
    gold_standard_diagnosis: "Ectopic Pregnancy",
    top_differential_diagnoses: ["Ectopic Pregnancy", "Threatened Abortion", "Ovarian Torsion", "Ruptured Ovarian Cyst"],
    recommended_tests: ["Beta-hCG", "Transvaginal Ultrasound", "CBC", "Type and Screen"],
    recommended_medications: ["Methotrexate", "Surgical Intervention"],
    guideline_reference: "ACOG Ectopic Pregnancy Guidelines 2018",
    danger_flag: true,
    organ_system: "reproductive",
  }, ["emergency", "must_not_miss"]),

  makeCase("emergency_medicine", "common", "Acute Burns — Second Degree", {
    chief_complaint: "Burn injury to forearm from hot water",
    symptoms: ["burn pain", "blistering", "erythema"],
    symptom_duration: "1 hour",
    associated_symptoms: ["swelling", "weeping blisters"],
    vitals: { pulse: 95, bp_systolic: 130, bp_diastolic: 82 },
  }, {
    gold_standard_diagnosis: "Second-Degree Burn",
    top_differential_diagnoses: ["Second-Degree Burn", "First-Degree Burn", "Chemical Burn"],
    recommended_tests: ["Clinical Assessment", "Wound Culture if infected"],
    recommended_medications: ["Silver Sulfadiazine", "Analgesics", "Tetanus Update"],
    guideline_reference: "ABA Burn Guidelines",
    danger_flag: false,
    organ_system: "integumentary",
  }),

  makeCase("emergency_medicine", "complex", "Diabetic Ketoacidosis", {
    chief_complaint: "Vomiting, abdominal pain, and rapid breathing in known diabetic",
    symptoms: ["vomiting", "abdominal pain", "Kussmaul breathing", "altered consciousness"],
    symptom_duration: "12 hours",
    associated_symptoms: ["fruity breath", "polyuria", "polydipsia", "dehydration"],
    vitals: { pulse: 120, bp_systolic: 90, bp_diastolic: 55, respiratory_rate: 30, temperature: 37.0 },
    medical_history: ["Type 1 Diabetes"],
    medications: ["Insulin"],
  }, {
    gold_standard_diagnosis: "Diabetic Ketoacidosis",
    top_differential_diagnoses: ["DKA", "HHS", "Sepsis", "Pancreatitis"],
    recommended_tests: ["Blood Glucose", "ABG", "Electrolytes", "Ketones", "BUN/Creatinine", "Anion Gap"],
    recommended_medications: ["IV Insulin", "IV Fluids", "Potassium", "Bicarbonate"],
    guideline_reference: "ADA DKA Guidelines 2023",
    danger_flag: true,
    organ_system: "endocrine",
  }, ["emergency"]),

  makeCase("emergency_medicine", "moderate", "Acute Poisoning — Organophosphate", {
    chief_complaint: "Excessive salivation, vomiting, and blurred vision after pesticide exposure",
    symptoms: ["salivation", "lacrimation", "urination", "defecation", "miosis"],
    symptom_duration: "2 hours",
    associated_symptoms: ["muscle fasciculations", "bradycardia", "bronchospasm"],
    vitals: { pulse: 50, bp_systolic: 100, bp_diastolic: 60, spo2: 88 },
    risk_factors: ["pesticide exposure"],
  }, {
    gold_standard_diagnosis: "Organophosphate Poisoning",
    top_differential_diagnoses: ["OP Poisoning", "Carbamate Poisoning", "Cholinergic Crisis"],
    recommended_tests: ["Cholinesterase Levels", "ABG", "ECG"],
    recommended_medications: ["Atropine", "Pralidoxime", "Diazepam"],
    guideline_reference: "WHO Pesticide Poisoning Guidelines",
    danger_flag: true,
    organ_system: "toxicological",
  }, ["emergency", "toxicology"]),

  makeCase("emergency_medicine", "common", "Acute Gastritis", {
    chief_complaint: "Sudden onset epigastric pain and nausea after NSAID use",
    symptoms: ["epigastric pain", "nausea", "burning sensation"],
    symptom_duration: "1 day",
    associated_symptoms: ["vomiting", "anorexia"],
    vitals: { bp_systolic: 125, bp_diastolic: 78, pulse: 82 },
    medications: ["Ibuprofen"],
  }, {
    gold_standard_diagnosis: "Acute Gastritis",
    top_differential_diagnoses: ["Gastritis", "PUD", "GERD", "Pancreatitis"],
    recommended_tests: ["CBC", "H. pylori Test"],
    recommended_medications: ["Omeprazole", "Sucralfate", "Antacid"],
    guideline_reference: "ACG Guidelines",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),

  makeCase("emergency_medicine", "complex", "Acute Aortic Aneurysm Rupture", {
    chief_complaint: "Sudden severe abdominal pain radiating to back with hypotension",
    symptoms: ["severe abdominal pain", "back pain", "syncope"],
    symptom_duration: "1 hour",
    associated_symptoms: ["pulsatile abdominal mass", "hemodynamic instability"],
    vitals: { bp_systolic: 70, bp_diastolic: 40, pulse: 130 },
    medical_history: ["Known AAA", "Hypertension"],
    risk_factors: ["smoking", "age > 65"],
  }, {
    gold_standard_diagnosis: "Ruptured Abdominal Aortic Aneurysm",
    top_differential_diagnoses: ["Ruptured AAA", "Aortic Dissection", "Mesenteric Ischemia", "Renal Colic"],
    recommended_tests: ["CT Angiography", "CBC", "Type and Cross"],
    recommended_medications: ["IV Fluids", "Blood Products", "Emergency Surgery"],
    guideline_reference: "SVS AAA Guidelines",
    danger_flag: true,
    organ_system: "cardiovascular",
  }, ["emergency", "must_not_miss"]),

  makeCase("emergency_medicine", "common", "Fracture — Colles", {
    chief_complaint: "Wrist pain and deformity after fall on outstretched hand",
    symptoms: ["wrist pain", "swelling", "dinner fork deformity"],
    symptom_duration: "1 hour",
    associated_symptoms: ["limited range of motion", "tenderness"],
    vitals: { bp_systolic: 135, bp_diastolic: 85, pulse: 90 },
  }, {
    gold_standard_diagnosis: "Colles Fracture",
    top_differential_diagnoses: ["Colles Fracture", "Scaphoid Fracture", "Smith Fracture", "Wrist Sprain"],
    recommended_tests: ["X-ray Wrist AP/Lateral", "CT if complex"],
    recommended_medications: ["Analgesics", "Cast Immobilization"],
    guideline_reference: "AAOS Fracture Guidelines",
    danger_flag: false,
    organ_system: "musculoskeletal",
  }),

  makeCase("emergency_medicine", "moderate", "Acute Alcohol Intoxication", {
    chief_complaint: "Found unconscious smelling of alcohol",
    symptoms: ["altered consciousness", "slurred speech", "ataxia"],
    symptom_duration: "unknown",
    associated_symptoms: ["hypothermia", "vomiting", "aspiration risk"],
    vitals: { temperature: 35.5, pulse: 65, bp_systolic: 100, bp_diastolic: 60, spo2: 94 },
  }, {
    gold_standard_diagnosis: "Acute Alcohol Intoxication",
    top_differential_diagnoses: ["Alcohol Intoxication", "Methanol Poisoning", "Hypoglycemia", "Subdural Hematoma"],
    recommended_tests: ["Blood Alcohol Level", "Blood Glucose", "Electrolytes", "CT Head"],
    recommended_medications: ["Thiamine", "Glucose", "IV Fluids"],
    guideline_reference: "ACMT Toxicology Guidelines",
    danger_flag: false,
    organ_system: "toxicological",
  }),

  makeCase("emergency_medicine", "complex", "Mesenteric Ischemia", {
    chief_complaint: "Severe abdominal pain out of proportion to exam",
    symptoms: ["severe abdominal pain", "pain out of proportion to examination"],
    symptom_duration: "6 hours",
    associated_symptoms: ["bloody diarrhea", "nausea", "metabolic acidosis"],
    vitals: { pulse: 115, bp_systolic: 95, bp_diastolic: 55, temperature: 37.8 },
    medical_history: ["Atrial Fibrillation", "Peripheral Vascular Disease"],
    risk_factors: ["AF", "elderly"],
  }, {
    gold_standard_diagnosis: "Acute Mesenteric Ischemia",
    top_differential_diagnoses: ["Mesenteric Ischemia", "Bowel Obstruction", "Perforated Viscus", "Pancreatitis"],
    recommended_tests: ["CT Angiography", "Lactate", "D-dimer", "CBC", "ABG"],
    recommended_medications: ["Heparin", "IV Fluids", "Surgical Exploration"],
    guideline_reference: "ACG Mesenteric Ischemia Guidelines",
    danger_flag: true,
    organ_system: "gastrointestinal",
  }, ["emergency", "must_not_miss"]),

  // Additional emergency cases
  makeCase("emergency_medicine", "common", "Heat Stroke", {
    chief_complaint: "Confusion and high body temperature after outdoor labor",
    symptoms: ["hyperthermia", "confusion", "hot dry skin"],
    symptom_duration: "2 hours",
    associated_symptoms: ["tachycardia", "seizures"],
    vitals: { temperature: 41.5, pulse: 130, bp_systolic: 90, bp_diastolic: 55, spo2: 95 },
  }, {
    gold_standard_diagnosis: "Heat Stroke",
    top_differential_diagnoses: ["Heat Stroke", "Heat Exhaustion", "Neuroleptic Malignant Syndrome", "Sepsis"],
    recommended_tests: ["CBC", "BMP", "CK", "PT/INR", "Urinalysis"],
    recommended_medications: ["Rapid Cooling", "IV Fluids", "Dantrolene"],
    guideline_reference: "Wilderness Medical Society Heat Guidelines",
    danger_flag: true,
    organ_system: "thermoregulatory",
  }, ["emergency"]),

  makeCase("emergency_medicine", "moderate", "Snake Bite — Viperidae", {
    chief_complaint: "Painful swelling at bite site with ecchymosis",
    symptoms: ["local pain", "swelling", "fang marks", "ecchymosis"],
    symptom_duration: "3 hours",
    associated_symptoms: ["bleeding from gums", "ptosis", "vomiting"],
    vitals: { pulse: 100, bp_systolic: 90, bp_diastolic: 55 },
    risk_factors: ["rural India", "agricultural worker"],
  }, {
    gold_standard_diagnosis: "Viperine Snake Envenomation",
    top_differential_diagnoses: ["Viperine Envenomation", "Elapid Envenomation", "Dry Bite", "Allergic Reaction"],
    recommended_tests: ["PT/INR", "CBC", "Clot Time", "Creatinine"],
    recommended_medications: ["Polyvalent Antivenom", "Tetanus Toxoid", "Analgesics"],
    guideline_reference: "WHO Snake Bite Management Guidelines 2016",
    danger_flag: true,
    organ_system: "toxicological",
  }, ["emergency", "tropical"]),

  makeCase("emergency_medicine", "common", "Acute Urinary Retention", {
    chief_complaint: "Inability to urinate for 12 hours with lower abdominal distension",
    symptoms: ["inability to void", "suprapubic pain", "abdominal distension"],
    symptom_duration: "12 hours",
    associated_symptoms: ["overflow incontinence"],
    vitals: { bp_systolic: 150, bp_diastolic: 90, pulse: 85 },
    medical_history: ["BPH"],
    risk_factors: ["elderly male"],
  }, {
    gold_standard_diagnosis: "Acute Urinary Retention",
    top_differential_diagnoses: ["AUR due to BPH", "Urethral Stricture", "Bladder Stone", "Prostate Cancer"],
    recommended_tests: ["Post-Void Residual", "Urinalysis", "PSA", "Renal Function"],
    recommended_medications: ["Catheterization", "Tamsulosin", "Finasteride"],
    guideline_reference: "AUA BPH Guidelines 2021",
    danger_flag: false,
    organ_system: "renal",
  }),

  makeCase("emergency_medicine", "complex", "Cardiac Arrest — VF", {
    chief_complaint: "Sudden collapse and unresponsiveness",
    symptoms: ["unresponsiveness", "no pulse", "apnea"],
    symptom_duration: "minutes",
    associated_symptoms: ["agonal breathing"],
    vitals: { pulse: 0, bp_systolic: 0, bp_diastolic: 0, spo2: 0 },
  }, {
    gold_standard_diagnosis: "Cardiac Arrest — Ventricular Fibrillation",
    top_differential_diagnoses: ["VF Arrest", "Pulseless VT", "Asystole", "PEA"],
    recommended_tests: ["ECG", "Point-of-Care Ultrasound"],
    recommended_medications: ["CPR", "Defibrillation", "Epinephrine", "Amiodarone"],
    guideline_reference: "AHA ACLS Guidelines 2020",
    danger_flag: true,
    organ_system: "cardiovascular",
  }, ["emergency", "must_not_miss"]),

  makeCase("emergency_medicine", "moderate", "Testicular Torsion", {
    chief_complaint: "Sudden severe scrotal pain in 16-year-old",
    symptoms: ["acute scrotal pain", "scrotal swelling", "nausea"],
    symptom_duration: "3 hours",
    associated_symptoms: ["high-riding testis", "absent cremasteric reflex"],
    vitals: { pulse: 100, bp_systolic: 130, bp_diastolic: 80 },
    risk_factors: ["adolescent male"],
  }, {
    gold_standard_diagnosis: "Testicular Torsion",
    top_differential_diagnoses: ["Testicular Torsion", "Epididymitis", "Torsion of Appendix Testis", "Inguinal Hernia"],
    recommended_tests: ["Doppler Ultrasound", "Urinalysis"],
    recommended_medications: ["Surgical Detorsion", "Analgesics"],
    guideline_reference: "AUA Testicular Torsion Guidelines",
    danger_flag: true,
    organ_system: "reproductive",
  }, ["surgical", "time_critical"]),

  makeCase("emergency_medicine", "common", "Acute Otitis Media", {
    chief_complaint: "Ear pain and fever in 3-year-old child",
    symptoms: ["ear pain", "fever", "irritability"],
    symptom_duration: "2 days",
    associated_symptoms: ["pulling at ear", "decreased hearing", "rhinorrhea"],
    vitals: { temperature: 38.8, pulse: 110 },
  }, {
    gold_standard_diagnosis: "Acute Otitis Media",
    top_differential_diagnoses: ["AOM", "Otitis Externa", "Mastoiditis", "TMJ Dysfunction"],
    recommended_tests: ["Otoscopy", "Tympanometry"],
    recommended_medications: ["Amoxicillin", "Ibuprofen", "Ear Drops"],
    guideline_reference: "AAP AOM Guidelines 2013",
    danger_flag: false,
    organ_system: "ent",
  }),

  makeCase("emergency_medicine", "moderate", "Acute Pancreatitis — Gallstone", {
    chief_complaint: "Severe upper abdominal pain after fatty meal with nausea",
    symptoms: ["severe epigastric pain", "nausea", "vomiting"],
    symptom_duration: "8 hours",
    associated_symptoms: ["pain radiating to back", "guarding"],
    vitals: { pulse: 105, bp_systolic: 105, bp_diastolic: 65, temperature: 38.0 },
    medical_history: ["Gallstones"],
  }, {
    gold_standard_diagnosis: "Gallstone Pancreatitis",
    top_differential_diagnoses: ["Gallstone Pancreatitis", "Alcoholic Pancreatitis", "Cholecystitis", "Perforated Ulcer"],
    recommended_tests: ["Lipase", "Amylase", "LFTs", "Ultrasound", "CT Abdomen"],
    recommended_medications: ["IV Fluids", "NPO", "Analgesics", "ERCP"],
    guideline_reference: "ACG Pancreatitis Guidelines 2013",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),

  makeCase("emergency_medicine", "complex", "Disseminated Intravascular Coagulation", {
    chief_complaint: "Bleeding from multiple sites with petechiae and prolonged bleeding",
    symptoms: ["bleeding from venipuncture sites", "petechiae", "purpura"],
    symptom_duration: "12 hours",
    associated_symptoms: ["oozing from surgical site", "hematuria", "altered consciousness"],
    vitals: { pulse: 120, bp_systolic: 80, bp_diastolic: 45, temperature: 39.0 },
    medical_history: ["Sepsis", "Obstetric complication"],
  }, {
    gold_standard_diagnosis: "Disseminated Intravascular Coagulation",
    top_differential_diagnoses: ["DIC", "TTP", "HUS", "Liver Failure"],
    recommended_tests: ["PT/INR", "aPTT", "Fibrinogen", "D-dimer", "Platelet Count", "Blood Smear"],
    recommended_medications: ["Treat Underlying Cause", "FFP", "Platelets", "Cryoprecipitate", "Heparin"],
    guideline_reference: "ISTH DIC Guidelines 2019",
    danger_flag: true,
    organ_system: "hematological",
  }, ["emergency"]),

  makeCase("emergency_medicine", "common", "Febrile Seizure", {
    chief_complaint: "Seizure in 18-month-old with high fever",
    symptoms: ["generalized seizure", "high fever", "post-ictal drowsiness"],
    symptom_duration: "2 minutes",
    associated_symptoms: ["URI symptoms", "irritability"],
    vitals: { temperature: 39.5, pulse: 140, spo2: 97 },
  }, {
    gold_standard_diagnosis: "Simple Febrile Seizure",
    top_differential_diagnoses: ["Febrile Seizure", "Meningitis", "Epilepsy", "Electrolyte Imbalance"],
    recommended_tests: ["Blood Glucose", "Electrolytes"],
    recommended_medications: ["Antipyretics", "Reassurance"],
    guideline_reference: "AAP Febrile Seizure Guidelines 2011",
    danger_flag: false,
    organ_system: "neurological",
  }),

  makeCase("emergency_medicine", "moderate", "Hypoglycemia — Diabetic", {
    chief_complaint: "Confusion, sweating, and tremor in insulin-dependent diabetic",
    symptoms: ["confusion", "diaphoresis", "tremor", "palpitations"],
    symptom_duration: "30 minutes",
    associated_symptoms: ["irritability", "hunger", "blurred vision"],
    vitals: { pulse: 100, bp_systolic: 130, bp_diastolic: 85, spo2: 99 },
    medical_history: ["Type 1 Diabetes"],
    medications: ["Insulin Glargine", "Insulin Lispro"],
  }, {
    gold_standard_diagnosis: "Hypoglycemia",
    top_differential_diagnoses: ["Hypoglycemia", "Stroke", "Seizure", "Alcohol Intoxication"],
    recommended_tests: ["Blood Glucose", "BMP"],
    recommended_medications: ["Dextrose IV", "Glucagon", "Glucose Tablets"],
    guideline_reference: "ADA Hypoglycemia Guidelines 2023",
    danger_flag: true,
    organ_system: "endocrine",
  }, ["emergency"]),

  makeCase("emergency_medicine", "complex", "Massive Hemothorax", {
    chief_complaint: "Chest trauma with severe dyspnea and hypotension",
    symptoms: ["dyspnea", "chest pain", "hypotension", "absent breath sounds"],
    symptom_duration: "1 hour",
    associated_symptoms: ["tracheal deviation", "decreased consciousness"],
    vitals: { bp_systolic: 70, bp_diastolic: 40, pulse: 135, spo2: 82, respiratory_rate: 32 },
  }, {
    gold_standard_diagnosis: "Massive Hemothorax",
    top_differential_diagnoses: ["Hemothorax", "Tension Pneumothorax", "Cardiac Tamponade", "Flail Chest"],
    recommended_tests: ["Chest X-ray", "FAST Exam", "CBC", "Type and Cross"],
    recommended_medications: ["Chest Tube", "Blood Transfusion", "IV Fluids", "Thoracotomy"],
    guideline_reference: "ATLS Guidelines",
    danger_flag: true,
    organ_system: "respiratory",
  }, ["emergency", "trauma"]),
];

// ═══════════════════════════════════════════════════════
// ENDOCRINOLOGY — 15 cases
// ═══════════════════════════════════════════════════════

const ENDOCRINOLOGY: BenchmarkCaseV6[] = [
  makeCase("endocrinology", "common", "Type 2 Diabetes — New Diagnosis", {
    chief_complaint: "Increased thirst and urination for 3 weeks",
    symptoms: ["polyuria", "polydipsia", "fatigue", "blurred vision"],
    symptom_duration: "3 weeks",
    associated_symptoms: ["weight loss", "recurrent infections"],
    vitals: { bp_systolic: 140, bp_diastolic: 88, pulse: 78, spo2: 99 },
    risk_factors: ["obesity", "family history of diabetes", "sedentary"],
  }, {
    gold_standard_diagnosis: "Type 2 Diabetes Mellitus",
    top_differential_diagnoses: ["T2DM", "T1DM", "Diabetes Insipidus", "Hyperthyroidism"],
    recommended_tests: ["Fasting Blood Glucose", "HbA1c", "OGTT", "Lipid Panel", "Renal Function"],
    recommended_medications: ["Metformin", "Lifestyle Modification"],
    guideline_reference: "ADA Diabetes Standards 2023",
    danger_flag: false,
    organ_system: "endocrine",
  }),

  makeCase("endocrinology", "moderate", "Thyrotoxicosis — Graves Disease", {
    chief_complaint: "Weight loss, tremor, and heat intolerance",
    symptoms: ["weight loss", "tremor", "heat intolerance", "palpitations"],
    symptom_duration: "2 months",
    associated_symptoms: ["exophthalmos", "goiter", "diarrhea", "anxiety"],
    vitals: { pulse: 110, bp_systolic: 140, bp_diastolic: 70 },
    risk_factors: ["female", "family history thyroid disease"],
  }, {
    gold_standard_diagnosis: "Graves Disease",
    top_differential_diagnoses: ["Graves Disease", "Toxic Nodular Goiter", "Thyroiditis", "Pheochromocytoma"],
    recommended_tests: ["TSH", "Free T4", "Free T3", "TSI", "Thyroid Uptake Scan"],
    recommended_medications: ["Methimazole", "Propranolol", "Radioiodine"],
    guideline_reference: "ATA Hyperthyroidism Guidelines 2016",
    danger_flag: false,
    organ_system: "endocrine",
  }),

  makeCase("endocrinology", "common", "Hypothyroidism", {
    chief_complaint: "Fatigue, weight gain, and cold intolerance",
    symptoms: ["fatigue", "weight gain", "cold intolerance", "constipation"],
    symptom_duration: "3 months",
    associated_symptoms: ["dry skin", "hair loss", "bradycardia", "depression"],
    vitals: { pulse: 58, bp_systolic: 130, bp_diastolic: 85, temperature: 36.2 },
  }, {
    gold_standard_diagnosis: "Primary Hypothyroidism",
    top_differential_diagnoses: ["Hypothyroidism", "Depression", "Anemia", "Heart Failure"],
    recommended_tests: ["TSH", "Free T4", "Anti-TPO Antibodies", "Lipid Panel"],
    recommended_medications: ["Levothyroxine"],
    guideline_reference: "ATA Hypothyroidism Guidelines 2014",
    danger_flag: false,
    organ_system: "endocrine",
  }),

  makeCase("endocrinology", "complex", "Adrenal Crisis", {
    chief_complaint: "Severe hypotension and altered consciousness in known Addison's",
    symptoms: ["severe hypotension", "confusion", "abdominal pain"],
    symptom_duration: "6 hours",
    associated_symptoms: ["nausea", "vomiting", "fever", "hyperpigmentation"],
    vitals: { bp_systolic: 70, bp_diastolic: 40, pulse: 120, temperature: 38.5 },
    medical_history: ["Addison's Disease"],
    medications: ["Hydrocortisone"],
    risk_factors: ["missed steroid dose", "concurrent infection"],
  }, {
    gold_standard_diagnosis: "Adrenal Crisis",
    top_differential_diagnoses: ["Adrenal Crisis", "Sepsis", "DKA", "Hypovolemic Shock"],
    recommended_tests: ["Cortisol", "ACTH", "Electrolytes", "Blood Glucose", "Blood Culture"],
    recommended_medications: ["Hydrocortisone IV", "IV Normal Saline", "Dextrose"],
    guideline_reference: "Endocrine Society Adrenal Crisis Guidelines 2016",
    danger_flag: true,
    organ_system: "endocrine",
  }, ["emergency"]),

  makeCase("endocrinology", "moderate", "Cushing Syndrome", {
    chief_complaint: "Weight gain, moon face, and purple striae",
    symptoms: ["central obesity", "moon face", "proximal weakness"],
    symptom_duration: "6 months",
    associated_symptoms: ["purple striae", "easy bruising", "hypertension", "glucose intolerance"],
    vitals: { bp_systolic: 155, bp_diastolic: 95, pulse: 80 },
  }, {
    gold_standard_diagnosis: "Cushing Syndrome",
    top_differential_diagnoses: ["Cushing Syndrome", "Metabolic Syndrome", "PCOS", "Depression"],
    recommended_tests: ["24h Urine Cortisol", "Dexamethasone Suppression Test", "Midnight Salivary Cortisol", "ACTH"],
    recommended_medications: ["Ketoconazole", "Metyrapone", "Surgery"],
    guideline_reference: "Endocrine Society Cushing Guidelines 2015",
    danger_flag: false,
    organ_system: "endocrine",
  }),

  makeCase("endocrinology", "common", "PCOS", {
    chief_complaint: "Irregular periods, acne, and hirsutism",
    symptoms: ["irregular menstruation", "acne", "hirsutism"],
    symptom_duration: "1 year",
    associated_symptoms: ["weight gain", "acanthosis nigricans", "difficulty conceiving"],
    vitals: { bp_systolic: 130, bp_diastolic: 82, pulse: 75 },
    risk_factors: ["obesity", "family history PCOS"],
  }, {
    gold_standard_diagnosis: "Polycystic Ovary Syndrome",
    top_differential_diagnoses: ["PCOS", "Congenital Adrenal Hyperplasia", "Cushing Syndrome", "Thyroid Disorder"],
    recommended_tests: ["LH/FSH", "Testosterone", "DHEA-S", "17-OH Progesterone", "Pelvic Ultrasound", "HbA1c"],
    recommended_medications: ["Metformin", "OCP", "Spironolactone"],
    guideline_reference: "Endocrine Society PCOS Guidelines 2013",
    danger_flag: false,
    organ_system: "endocrine",
  }),

  makeCase("endocrinology", "complex", "Pheochromocytoma", {
    chief_complaint: "Episodic severe headache, palpitations, and profuse sweating",
    symptoms: ["paroxysmal headache", "palpitations", "diaphoresis", "severe hypertension"],
    symptom_duration: "recurrent over 3 months",
    associated_symptoms: ["pallor", "tremor", "anxiety"],
    vitals: { bp_systolic: 220, bp_diastolic: 120, pulse: 130 },
    risk_factors: ["family history MEN2"],
  }, {
    gold_standard_diagnosis: "Pheochromocytoma",
    top_differential_diagnoses: ["Pheochromocytoma", "Essential Hypertension Crisis", "Thyrotoxicosis", "Anxiety Disorder"],
    recommended_tests: ["24h Urine Metanephrines", "Plasma Metanephrines", "CT Adrenals", "MIBG Scan"],
    recommended_medications: ["Phenoxybenzamine", "Propranolol", "Surgical Resection"],
    guideline_reference: "Endocrine Society Pheochromocytoma Guidelines 2014",
    danger_flag: true,
    organ_system: "endocrine",
  }),

  makeCase("endocrinology", "common", "Diabetic Neuropathy", {
    chief_complaint: "Numbness and burning pain in both feet",
    symptoms: ["bilateral foot numbness", "burning pain", "tingling"],
    symptom_duration: "6 months",
    associated_symptoms: ["loss of proprioception", "calluses", "balance difficulty"],
    vitals: { bp_systolic: 140, bp_diastolic: 85, pulse: 75 },
    medical_history: ["Type 2 Diabetes for 10 years"],
  }, {
    gold_standard_diagnosis: "Diabetic Peripheral Neuropathy",
    top_differential_diagnoses: ["Diabetic Neuropathy", "B12 Deficiency", "Alcoholic Neuropathy", "CIDP"],
    recommended_tests: ["HbA1c", "Vitamin B12", "Nerve Conduction Study", "Monofilament Test"],
    recommended_medications: ["Gabapentin", "Pregabalin", "Duloxetine"],
    guideline_reference: "ADA Neuropathy Guidelines 2017",
    danger_flag: false,
    organ_system: "endocrine",
  }),

  makeCase("endocrinology", "moderate", "Hypercalcemia — Primary Hyperparathyroidism", {
    chief_complaint: "Fatigue, constipation, and kidney stones",
    symptoms: ["fatigue", "constipation", "bone pain", "recurrent kidney stones"],
    symptom_duration: "4 months",
    associated_symptoms: ["polyuria", "confusion", "depression"],
    vitals: { bp_systolic: 135, bp_diastolic: 82, pulse: 78 },
  }, {
    gold_standard_diagnosis: "Primary Hyperparathyroidism",
    top_differential_diagnoses: ["Primary HPT", "Malignancy-Associated Hypercalcemia", "Sarcoidosis", "Vitamin D Toxicity"],
    recommended_tests: ["Serum Calcium", "PTH", "Phosphorus", "25-OH Vitamin D", "24h Urine Calcium"],
    recommended_medications: ["Parathyroidectomy", "Cinacalcet"],
    guideline_reference: "AAES Hyperparathyroidism Guidelines 2016",
    danger_flag: false,
    organ_system: "endocrine",
  }),

  makeCase("endocrinology", "complex", "Thyroid Storm", {
    chief_complaint: "Extreme agitation, high fever, and rapid heart rate",
    symptoms: ["high fever", "extreme agitation", "tachycardia", "delirium"],
    symptom_duration: "12 hours",
    associated_symptoms: ["vomiting", "diarrhea", "jaundice"],
    vitals: { temperature: 40.5, pulse: 160, bp_systolic: 170, bp_diastolic: 60 },
    medical_history: ["Graves Disease"],
    risk_factors: ["recent surgery", "infection"],
  }, {
    gold_standard_diagnosis: "Thyroid Storm",
    top_differential_diagnoses: ["Thyroid Storm", "Sepsis", "NMS", "Pheochromocytoma"],
    recommended_tests: ["TSH", "Free T4", "Free T3", "CBC", "LFTs"],
    recommended_medications: ["Propylthiouracil", "Lugol's Iodine", "Propranolol", "Hydrocortisone"],
    guideline_reference: "ATA Thyroid Storm Management",
    danger_flag: true,
    organ_system: "endocrine",
  }, ["emergency"]),

  makeCase("endocrinology", "common", "Metabolic Syndrome", {
    chief_complaint: "Elevated blood sugar and high triglycerides at routine check",
    symptoms: ["central obesity", "elevated fasting glucose"],
    symptom_duration: "chronic",
    associated_symptoms: ["hypertension", "low HDL"],
    vitals: { bp_systolic: 145, bp_diastolic: 92, pulse: 78 },
    risk_factors: ["obesity", "sedentary", "family history diabetes"],
  }, {
    gold_standard_diagnosis: "Metabolic Syndrome",
    top_differential_diagnoses: ["Metabolic Syndrome", "Cushing Syndrome", "Hypothyroidism"],
    recommended_tests: ["Fasting Glucose", "Lipid Panel", "HbA1c", "Waist Circumference"],
    recommended_medications: ["Lifestyle Modification", "Metformin"],
    guideline_reference: "ATP III Metabolic Syndrome Guidelines",
    danger_flag: false,
    organ_system: "endocrine",
  }),

  makeCase("endocrinology", "moderate", "Hyperosmolar Hyperglycemic State", {
    chief_complaint: "Progressive confusion and extreme dehydration in elderly diabetic",
    symptoms: ["altered consciousness", "extreme dehydration", "weakness"],
    symptom_duration: "3 days",
    associated_symptoms: ["polyuria", "polydipsia", "seizures"],
    vitals: { pulse: 110, bp_systolic: 85, bp_diastolic: 50, temperature: 37.0 },
    medical_history: ["Type 2 Diabetes"],
    risk_factors: ["elderly", "infection trigger"],
  }, {
    gold_standard_diagnosis: "Hyperosmolar Hyperglycemic State",
    top_differential_diagnoses: ["HHS", "DKA", "Stroke", "Sepsis"],
    recommended_tests: ["Blood Glucose", "Serum Osmolality", "BMP", "CBC", "Urinalysis"],
    recommended_medications: ["IV Fluids", "Insulin", "Electrolyte Replacement"],
    guideline_reference: "ADA HHS Guidelines 2023",
    danger_flag: true,
    organ_system: "endocrine",
  }, ["emergency"]),

  makeCase("endocrinology", "complex", "Acromegaly", {
    chief_complaint: "Enlarged hands, feet, and facial features over several years",
    symptoms: ["enlarged hands", "enlarged feet", "coarsened facial features"],
    symptom_duration: "3 years",
    associated_symptoms: ["headaches", "visual field defects", "carpal tunnel", "joint pain"],
    vitals: { bp_systolic: 145, bp_diastolic: 90, pulse: 78 },
  }, {
    gold_standard_diagnosis: "Acromegaly",
    top_differential_diagnoses: ["Acromegaly", "Pituitary Macroadenoma", "Hypothyroidism"],
    recommended_tests: ["IGF-1", "GH Suppression Test", "MRI Pituitary", "Visual Fields"],
    recommended_medications: ["Octreotide", "Pegvisomant", "Transsphenoidal Surgery"],
    guideline_reference: "Endocrine Society Acromegaly Guidelines 2014",
    danger_flag: false,
    organ_system: "endocrine",
  }),

  makeCase("endocrinology", "moderate", "Diabetic Foot Ulcer — Infected", {
    chief_complaint: "Non-healing ulcer on right foot with discharge",
    symptoms: ["foot ulcer", "purulent discharge", "pain"],
    symptom_duration: "3 weeks",
    associated_symptoms: ["surrounding cellulitis", "foul odor", "fever"],
    vitals: { temperature: 38.2, pulse: 90, bp_systolic: 140, bp_diastolic: 85 },
    medical_history: ["Type 2 Diabetes for 15 years", "Peripheral Neuropathy"],
  }, {
    gold_standard_diagnosis: "Infected Diabetic Foot Ulcer",
    top_differential_diagnoses: ["Diabetic Foot Ulcer", "Osteomyelitis", "Peripheral Vascular Disease"],
    recommended_tests: ["Wound Culture", "X-ray Foot", "MRI Foot", "HbA1c", "ABI"],
    recommended_medications: ["Amoxicillin-Clavulanate", "Wound Care", "Offloading"],
    guideline_reference: "IWGDF Diabetic Foot Guidelines 2023",
    danger_flag: false,
    organ_system: "endocrine",
  }),
];

// ═══════════════════════════════════════════════════════
// NEPHROLOGY — 10 cases
// ═══════════════════════════════════════════════════════

const NEPHROLOGY: BenchmarkCaseV6[] = [
  makeCase("nephrology", "common", "Acute Kidney Injury — Pre-renal", {
    chief_complaint: "Decreased urine output after severe vomiting and diarrhea",
    symptoms: ["oliguria", "fatigue", "nausea"],
    symptom_duration: "2 days",
    associated_symptoms: ["dehydration", "dark concentrated urine"],
    vitals: { bp_systolic: 90, bp_diastolic: 55, pulse: 110 },
    medical_history: ["Gastroenteritis"],
  }, {
    gold_standard_diagnosis: "Pre-renal Acute Kidney Injury",
    top_differential_diagnoses: ["Pre-renal AKI", "ATN", "Post-renal Obstruction", "Glomerulonephritis"],
    recommended_tests: ["BUN/Creatinine", "Electrolytes", "Urinalysis", "FENa", "Renal Ultrasound"],
    recommended_medications: ["IV Fluids", "Electrolyte Correction"],
    guideline_reference: "KDIGO AKI Guidelines 2012",
    danger_flag: false,
    organ_system: "renal",
  }),

  makeCase("nephrology", "moderate", "Nephrotic Syndrome", {
    chief_complaint: "Generalized edema and foamy urine",
    symptoms: ["periorbital edema", "pedal edema", "foamy urine"],
    symptom_duration: "2 weeks",
    associated_symptoms: ["weight gain", "ascites", "fatigue"],
    vitals: { bp_systolic: 135, bp_diastolic: 85, pulse: 78 },
  }, {
    gold_standard_diagnosis: "Nephrotic Syndrome",
    top_differential_diagnoses: ["Nephrotic Syndrome", "Nephritic Syndrome", "Heart Failure", "Liver Cirrhosis"],
    recommended_tests: ["24h Urine Protein", "Serum Albumin", "Lipid Panel", "Renal Biopsy", "ANA"],
    recommended_medications: ["Prednisolone", "ACE Inhibitors", "Diuretics", "Statin"],
    guideline_reference: "KDIGO Glomerulonephritis Guidelines 2021",
    danger_flag: false,
    organ_system: "renal",
  }),

  makeCase("nephrology", "common", "Nephrolithiasis", {
    chief_complaint: "Sudden severe flank pain radiating to groin",
    symptoms: ["severe colicky flank pain", "pain radiating to groin", "hematuria"],
    symptom_duration: "4 hours",
    associated_symptoms: ["nausea", "vomiting", "restlessness"],
    vitals: { bp_systolic: 150, bp_diastolic: 90, pulse: 95 },
  }, {
    gold_standard_diagnosis: "Renal Calculus",
    top_differential_diagnoses: ["Nephrolithiasis", "Pyelonephritis", "AAA", "Ovarian Torsion"],
    recommended_tests: ["CT KUB", "Urinalysis", "BMP", "CBC"],
    recommended_medications: ["Ketorolac", "Tamsulosin", "IV Fluids"],
    guideline_reference: "AUA Kidney Stones Guidelines 2014",
    danger_flag: false,
    organ_system: "renal",
  }),

  makeCase("nephrology", "complex", "Rapidly Progressive Glomerulonephritis", {
    chief_complaint: "Rapidly worsening kidney function with blood in urine",
    symptoms: ["gross hematuria", "oliguria", "edema"],
    symptom_duration: "1 week",
    associated_symptoms: ["hypertension", "fatigue", "hemoptysis"],
    vitals: { bp_systolic: 170, bp_diastolic: 105, pulse: 90 },
  }, {
    gold_standard_diagnosis: "Rapidly Progressive Glomerulonephritis",
    top_differential_diagnoses: ["RPGN", "IgA Nephropathy", "Lupus Nephritis", "Goodpasture Syndrome"],
    recommended_tests: ["Renal Biopsy", "ANCA", "Anti-GBM", "C3/C4", "ANA", "Urinalysis"],
    recommended_medications: ["Methylprednisolone", "Cyclophosphamide", "Plasmapheresis"],
    guideline_reference: "KDIGO GN Guidelines 2021",
    danger_flag: true,
    organ_system: "renal",
  }, ["urgent"]),

  makeCase("nephrology", "moderate", "Chronic Kidney Disease Stage 4", {
    chief_complaint: "Fatigue, nausea, and itching in known CKD patient",
    symptoms: ["fatigue", "nausea", "pruritus", "decreased appetite"],
    symptom_duration: "1 month",
    associated_symptoms: ["peripheral edema", "pallor", "nocturia"],
    vitals: { bp_systolic: 155, bp_diastolic: 95, pulse: 82 },
    medical_history: ["Diabetes", "Hypertension", "CKD Stage 3"],
  }, {
    gold_standard_diagnosis: "CKD Stage 4 Progression",
    top_differential_diagnoses: ["CKD Progression", "AKI on CKD", "Uremia", "Renal Artery Stenosis"],
    recommended_tests: ["BMP", "GFR", "CBC", "PTH", "Phosphorus", "Albumin"],
    recommended_medications: ["ACE Inhibitor", "Sodium Bicarbonate", "Erythropoietin", "Phosphate Binder"],
    guideline_reference: "KDIGO CKD Guidelines 2012",
    danger_flag: false,
    organ_system: "renal",
  }),

  makeCase("nephrology", "common", "Hyperkalemia", {
    chief_complaint: "Muscle weakness and palpitations in CKD patient",
    symptoms: ["muscle weakness", "palpitations", "paresthesias"],
    symptom_duration: "1 day",
    associated_symptoms: ["nausea", "ECG changes"],
    vitals: { pulse: 55, bp_systolic: 140, bp_diastolic: 88 },
    medical_history: ["CKD", "Diabetes"],
    medications: ["Lisinopril", "Spironolactone"],
  }, {
    gold_standard_diagnosis: "Hyperkalemia",
    top_differential_diagnoses: ["Hyperkalemia", "Hypokalemia", "Cardiac Arrhythmia"],
    recommended_tests: ["Potassium", "ECG", "BMP", "ABG"],
    recommended_medications: ["Calcium Gluconate", "Insulin + Dextrose", "Kayexalate", "Salbutamol"],
    guideline_reference: "KDIGO Electrolyte Guidelines",
    danger_flag: true,
    organ_system: "renal",
  }, ["emergency"]),

  makeCase("nephrology", "moderate", "IgA Nephropathy", {
    chief_complaint: "Recurrent episodes of gross hematuria coinciding with URIs",
    symptoms: ["gross hematuria", "flank pain"],
    symptom_duration: "recurrent over 1 year",
    associated_symptoms: ["mild proteinuria", "concurrent upper respiratory infection"],
    vitals: { bp_systolic: 135, bp_diastolic: 85, pulse: 75 },
    risk_factors: ["young adult", "male"],
  }, {
    gold_standard_diagnosis: "IgA Nephropathy",
    top_differential_diagnoses: ["IgA Nephropathy", "Thin Basement Membrane Disease", "Post-Streptococcal GN", "Alport Syndrome"],
    recommended_tests: ["Urinalysis", "Serum IgA", "Renal Biopsy", "Complement Levels"],
    recommended_medications: ["ACE Inhibitors", "Fish Oil", "Prednisolone"],
    guideline_reference: "KDIGO GN Guidelines 2021",
    danger_flag: false,
    organ_system: "renal",
  }),

  makeCase("nephrology", "complex", "Renal Transplant Rejection", {
    chief_complaint: "Decreased urine output and rising creatinine post-transplant",
    symptoms: ["oliguria", "tender transplant kidney", "fever"],
    symptom_duration: "3 days",
    associated_symptoms: ["weight gain", "edema", "malaise"],
    vitals: { temperature: 38.0, pulse: 90, bp_systolic: 160, bp_diastolic: 100 },
    medical_history: ["Renal Transplant 6 months ago"],
    medications: ["Tacrolimus", "Mycophenolate", "Prednisolone"],
  }, {
    gold_standard_diagnosis: "Acute Renal Transplant Rejection",
    top_differential_diagnoses: ["Acute Rejection", "CNI Toxicity", "BK Nephropathy", "Recurrent GN"],
    recommended_tests: ["Creatinine", "Tacrolimus Level", "Renal Biopsy", "BK Virus PCR", "DSA"],
    recommended_medications: ["Methylprednisolone", "Anti-Thymocyte Globulin"],
    guideline_reference: "KDIGO Transplant Guidelines 2009",
    danger_flag: true,
    organ_system: "renal",
  }),

  makeCase("nephrology", "common", "Urinary Tract Infection — Complicated", {
    chief_complaint: "Fever and flank pain in patient with ureteral stent",
    symptoms: ["fever", "flank pain", "dysuria"],
    symptom_duration: "2 days",
    associated_symptoms: ["rigors", "nausea"],
    vitals: { temperature: 39.0, pulse: 100, bp_systolic: 110, bp_diastolic: 70 },
    medical_history: ["Ureteral Stent for kidney stone"],
  }, {
    gold_standard_diagnosis: "Complicated UTI",
    top_differential_diagnoses: ["Complicated UTI", "Pyelonephritis", "Stent Obstruction", "Abscess"],
    recommended_tests: ["Urine Culture", "Blood Culture", "CT KUB", "CBC", "BMP"],
    recommended_medications: ["Ceftriaxone", "Fluoroquinolone"],
    guideline_reference: "IDSA Complicated UTI Guidelines",
    danger_flag: false,
    organ_system: "renal",
  }),

  makeCase("nephrology", "moderate", "Diabetic Nephropathy", {
    chief_complaint: "Foamy urine and swollen ankles in long-standing diabetic",
    symptoms: ["foamy urine", "pedal edema", "fatigue"],
    symptom_duration: "2 months",
    associated_symptoms: ["hypertension", "retinopathy"],
    vitals: { bp_systolic: 155, bp_diastolic: 95, pulse: 80 },
    medical_history: ["Type 2 Diabetes for 15 years", "Hypertension"],
  }, {
    gold_standard_diagnosis: "Diabetic Nephropathy",
    top_differential_diagnoses: ["Diabetic Nephropathy", "IgA Nephropathy", "FSGS", "Amyloidosis"],
    recommended_tests: ["Urine Albumin/Creatinine Ratio", "GFR", "HbA1c", "Renal Ultrasound"],
    recommended_medications: ["ACE Inhibitor", "SGLT2 Inhibitor", "Glycemic Control"],
    guideline_reference: "KDIGO Diabetic Kidney Disease 2020",
    danger_flag: false,
    organ_system: "renal",
  }),
];

// ═══════════════════════════════════════════════════════
// DERMATOLOGY — 10 cases
// ═══════════════════════════════════════════════════════

const DERMATOLOGY: BenchmarkCaseV6[] = [
  makeCase("dermatology", "common", "Atopic Dermatitis", {
    chief_complaint: "Chronic itchy rash on elbows and behind knees",
    symptoms: ["pruritic rash", "erythema", "dry skin", "lichenification"],
    symptom_duration: "6 months",
    associated_symptoms: ["sleep disturbance from itching", "family history of atopy"],
    vitals: { bp_systolic: 118, bp_diastolic: 72, pulse: 72 },
  }, {
    gold_standard_diagnosis: "Atopic Dermatitis",
    top_differential_diagnoses: ["Atopic Dermatitis", "Contact Dermatitis", "Psoriasis", "Scabies"],
    recommended_tests: ["Clinical Diagnosis", "Serum IgE"],
    recommended_medications: ["Topical Corticosteroids", "Emollients", "Antihistamines"],
    guideline_reference: "AAD Atopic Dermatitis Guidelines 2014",
    danger_flag: false,
    organ_system: "dermatological",
  }),

  makeCase("dermatology", "common", "Psoriasis Vulgaris", {
    chief_complaint: "Scaly red patches on elbows and scalp",
    symptoms: ["erythematous plaques", "silvery scales", "pruritus"],
    symptom_duration: "3 months",
    associated_symptoms: ["nail pitting", "joint pain"],
    vitals: { bp_systolic: 125, bp_diastolic: 78, pulse: 72 },
  }, {
    gold_standard_diagnosis: "Psoriasis Vulgaris",
    top_differential_diagnoses: ["Psoriasis", "Eczema", "Fungal Infection", "SLE"],
    recommended_tests: ["Clinical Diagnosis", "Skin Biopsy if uncertain"],
    recommended_medications: ["Topical Corticosteroids", "Calcipotriol", "Methotrexate"],
    guideline_reference: "AAD Psoriasis Guidelines 2019",
    danger_flag: false,
    organ_system: "dermatological",
  }),

  makeCase("dermatology", "moderate", "Stevens-Johnson Syndrome", {
    chief_complaint: "Painful blistering rash and mouth ulcers after starting new medication",
    symptoms: ["target lesions", "skin blistering", "mucosal erosions"],
    symptom_duration: "3 days",
    associated_symptoms: ["fever", "difficulty eating", "eye involvement"],
    vitals: { temperature: 38.5, pulse: 100, bp_systolic: 110, bp_diastolic: 70 },
    medications: ["Allopurinol"],
  }, {
    gold_standard_diagnosis: "Stevens-Johnson Syndrome",
    top_differential_diagnoses: ["SJS", "TEN", "EM Major", "Staphylococcal Scalded Skin"],
    recommended_tests: ["Skin Biopsy", "CBC", "LFTs", "Renal Function"],
    recommended_medications: ["Stop Offending Drug", "IV Fluids", "Wound Care", "IVIG"],
    guideline_reference: "BAD SJS/TEN Guidelines 2016",
    danger_flag: true,
    organ_system: "dermatological",
  }, ["emergency", "drug_reaction"]),

  makeCase("dermatology", "common", "Tinea Corporis", {
    chief_complaint: "Ring-shaped itchy rash on arm",
    symptoms: ["annular erythematous rash", "pruritus", "scaly border"],
    symptom_duration: "2 weeks",
    associated_symptoms: ["central clearing"],
    vitals: { bp_systolic: 118, bp_diastolic: 72, pulse: 72 },
  }, {
    gold_standard_diagnosis: "Tinea Corporis",
    top_differential_diagnoses: ["Tinea Corporis", "Granuloma Annulare", "Pityriasis Rosea", "Nummular Eczema"],
    recommended_tests: ["KOH Prep", "Fungal Culture"],
    recommended_medications: ["Terbinafine Cream", "Clotrimazole", "Oral Terbinafine"],
    guideline_reference: "AAD Fungal Infection Guidelines",
    danger_flag: false,
    organ_system: "dermatological",
  }),

  makeCase("dermatology", "moderate", "Melanoma", {
    chief_complaint: "Changing mole with irregular borders and multiple colors",
    symptoms: ["asymmetric pigmented lesion", "irregular borders", "color variation"],
    symptom_duration: "3 months",
    associated_symptoms: ["itching", "bleeding", "ulceration"],
    vitals: { bp_systolic: 120, bp_diastolic: 75, pulse: 72 },
    risk_factors: ["fair skin", "sun exposure", "family history melanoma"],
  }, {
    gold_standard_diagnosis: "Malignant Melanoma",
    top_differential_diagnoses: ["Melanoma", "Dysplastic Nevus", "Seborrheic Keratosis", "BCC"],
    recommended_tests: ["Excisional Biopsy", "Dermoscopy", "Sentinel Lymph Node Biopsy", "CT/PET"],
    recommended_medications: ["Wide Local Excision", "Immunotherapy", "Targeted Therapy"],
    guideline_reference: "NCCN Melanoma Guidelines 2023",
    danger_flag: true,
    organ_system: "dermatological",
  }),

  makeCase("dermatology", "common", "Acne Vulgaris", {
    chief_complaint: "Facial acne with comedones and inflammatory papules",
    symptoms: ["comedones", "papules", "pustules", "oily skin"],
    symptom_duration: "1 year",
    associated_symptoms: ["scarring", "psychological distress"],
    vitals: { bp_systolic: 115, bp_diastolic: 70, pulse: 72 },
    risk_factors: ["adolescent"],
  }, {
    gold_standard_diagnosis: "Acne Vulgaris",
    top_differential_diagnoses: ["Acne Vulgaris", "Rosacea", "Folliculitis", "Perioral Dermatitis"],
    recommended_tests: ["Clinical Diagnosis"],
    recommended_medications: ["Benzoyl Peroxide", "Adapalene", "Doxycycline", "Isotretinoin"],
    guideline_reference: "AAD Acne Guidelines 2016",
    danger_flag: false,
    organ_system: "dermatological",
  }),

  makeCase("dermatology", "moderate", "Pemphigus Vulgaris", {
    chief_complaint: "Painful flaccid blisters and oral erosions",
    symptoms: ["flaccid blisters", "oral erosions", "skin fragility"],
    symptom_duration: "4 weeks",
    associated_symptoms: ["Nikolsky sign positive", "pain on eating"],
    vitals: { pulse: 82, bp_systolic: 120, bp_diastolic: 75 },
  }, {
    gold_standard_diagnosis: "Pemphigus Vulgaris",
    top_differential_diagnoses: ["Pemphigus Vulgaris", "Bullous Pemphigoid", "SJS", "Lichen Planus"],
    recommended_tests: ["Skin Biopsy", "DIF", "Desmoglein Antibodies"],
    recommended_medications: ["Prednisolone", "Rituximab", "Mycophenolate"],
    guideline_reference: "BAD Pemphigus Guidelines 2017",
    danger_flag: false,
    organ_system: "dermatological",
  }),

  makeCase("dermatology", "common", "Scabies", {
    chief_complaint: "Intense nocturnal itching with papular rash in web spaces",
    symptoms: ["intense pruritus", "papular rash", "burrows", "nocturnal itching"],
    symptom_duration: "3 weeks",
    associated_symptoms: ["family members affected", "rash in web spaces and genitalia"],
    vitals: { bp_systolic: 118, bp_diastolic: 72, pulse: 72 },
  }, {
    gold_standard_diagnosis: "Scabies",
    top_differential_diagnoses: ["Scabies", "Atopic Dermatitis", "Contact Dermatitis", "Insect Bites"],
    recommended_tests: ["Skin Scraping", "Dermoscopy"],
    recommended_medications: ["Permethrin Cream", "Ivermectin"],
    guideline_reference: "WHO Scabies Guidelines",
    danger_flag: false,
    organ_system: "dermatological",
  }),

  makeCase("dermatology", "complex", "Toxic Epidermal Necrolysis", {
    chief_complaint: "Widespread skin detachment with mucosal involvement after carbamazepine",
    symptoms: ["widespread epidermal detachment", "mucosal erosions", "pain"],
    symptom_duration: "2 days",
    associated_symptoms: ["fever", "BSA > 30%", "respiratory compromise"],
    vitals: { temperature: 39.0, pulse: 120, bp_systolic: 95, bp_diastolic: 55, spo2: 92 },
    medications: ["Carbamazepine"],
  }, {
    gold_standard_diagnosis: "Toxic Epidermal Necrolysis",
    top_differential_diagnoses: ["TEN", "SJS", "Staphylococcal Scalded Skin", "Pemphigus"],
    recommended_tests: ["Skin Biopsy", "CBC", "Renal Function", "LFTs"],
    recommended_medications: ["Stop Offending Drug", "ICU Care", "IVIG", "Cyclosporine"],
    guideline_reference: "BAD SJS/TEN Guidelines 2016",
    danger_flag: true,
    organ_system: "dermatological",
  }, ["emergency", "drug_reaction"]),

  makeCase("dermatology", "common", "Urticaria — Acute", {
    chief_complaint: "Sudden itchy wheals all over body",
    symptoms: ["urticaria", "pruritus", "wheals"],
    symptom_duration: "4 hours",
    associated_symptoms: ["mild angioedema"],
    vitals: { bp_systolic: 120, bp_diastolic: 75, pulse: 80 },
  }, {
    gold_standard_diagnosis: "Acute Urticaria",
    top_differential_diagnoses: ["Acute Urticaria", "Anaphylaxis", "Vasculitis", "Drug Reaction"],
    recommended_tests: ["Clinical Diagnosis", "IgE if recurrent"],
    recommended_medications: ["Cetirizine", "Fexofenadine", "Prednisolone"],
    guideline_reference: "EAACI Urticaria Guidelines 2022",
    danger_flag: false,
    organ_system: "dermatological",
  }),
];

// ═══════════════════════════════════════════════════════
// PEDIATRICS — 10 cases
// ═══════════════════════════════════════════════════════

const PEDIATRICS: BenchmarkCaseV6[] = [
  makeCase("pediatrics", "common", "Bronchiolitis", {
    chief_complaint: "Wheezing and difficulty feeding in 6-month-old infant",
    symptoms: ["wheezing", "tachypnea", "nasal flaring", "intercostal retractions"],
    symptom_duration: "3 days",
    associated_symptoms: ["rhinorrhea", "low-grade fever", "poor feeding"],
    vitals: { temperature: 37.8, pulse: 160, spo2: 91, respiratory_rate: 55 },
    risk_factors: ["premature birth", "winter season"],
  }, {
    gold_standard_diagnosis: "Bronchiolitis",
    top_differential_diagnoses: ["Bronchiolitis", "Asthma", "Pneumonia", "Foreign Body"],
    recommended_tests: ["SpO2 Monitoring", "Chest X-ray if severe", "RSV Test"],
    recommended_medications: ["Supportive Care", "Nasal Suctioning", "Oxygen"],
    guideline_reference: "AAP Bronchiolitis Guidelines 2014",
    danger_flag: false,
    organ_system: "respiratory",
  }),

  makeCase("pediatrics", "moderate", "Kawasaki Disease", {
    chief_complaint: "5-day fever with red eyes, cracked lips, and rash in 3-year-old",
    symptoms: ["persistent fever > 5 days", "bilateral conjunctival injection", "cracked lips"],
    symptom_duration: "5 days",
    associated_symptoms: ["strawberry tongue", "polymorphous rash", "extremity edema", "cervical lymphadenopathy"],
    vitals: { temperature: 39.5, pulse: 140, spo2: 98 },
    risk_factors: ["age < 5", "Asian descent"],
  }, {
    gold_standard_diagnosis: "Kawasaki Disease",
    top_differential_diagnoses: ["Kawasaki Disease", "Measles", "Scarlet Fever", "JIA", "Adenovirus"],
    recommended_tests: ["Echocardiogram", "CBC", "CRP", "ESR", "LFTs", "Urinalysis"],
    recommended_medications: ["IVIG", "High-Dose Aspirin"],
    guideline_reference: "AHA Kawasaki Disease Guidelines 2017",
    danger_flag: true,
    organ_system: "cardiovascular",
  }, ["must_not_miss", "coronary_aneurysm_risk"]),

  makeCase("pediatrics", "common", "Measles", {
    chief_complaint: "High fever, rash, and cough in unvaccinated 4-year-old",
    symptoms: ["high fever", "maculopapular rash", "cough", "coryza"],
    symptom_duration: "4 days",
    associated_symptoms: ["conjunctivitis", "Koplik spots", "photophobia"],
    vitals: { temperature: 40.0, pulse: 130, spo2: 97 },
    risk_factors: ["unvaccinated"],
  }, {
    gold_standard_diagnosis: "Measles",
    top_differential_diagnoses: ["Measles", "Roseola", "Rubella", "Scarlet Fever"],
    recommended_tests: ["Measles IgM", "CBC", "Measles PCR"],
    recommended_medications: ["Vitamin A", "Paracetamol", "Supportive Care"],
    guideline_reference: "WHO Measles Guidelines",
    danger_flag: true,
    organ_system: "infectious",
  }),

  makeCase("pediatrics", "moderate", "Intussusception", {
    chief_complaint: "Colicky abdominal pain with 'currant jelly' stools in 8-month-old",
    symptoms: ["episodic colicky pain", "drawing up legs", "vomiting"],
    symptom_duration: "12 hours",
    associated_symptoms: ["currant jelly stool", "palpable sausage-shaped mass"],
    vitals: { pulse: 150, temperature: 37.5, bp_systolic: 85, bp_diastolic: 50 },
  }, {
    gold_standard_diagnosis: "Intussusception",
    top_differential_diagnoses: ["Intussusception", "Gastroenteritis", "Volvulus", "Meckel Diverticulum"],
    recommended_tests: ["Abdominal Ultrasound", "Abdominal X-ray"],
    recommended_medications: ["Air Enema Reduction", "Surgical Reduction"],
    guideline_reference: "APSA Intussusception Guidelines",
    danger_flag: true,
    organ_system: "gastrointestinal",
  }, ["surgical", "must_not_miss"]),

  makeCase("pediatrics", "common", "Hand Foot and Mouth Disease", {
    chief_complaint: "Oral ulcers and vesicular rash on hands and feet in 2-year-old",
    symptoms: ["oral ulcers", "vesicular rash on hands", "vesicular rash on feet"],
    symptom_duration: "3 days",
    associated_symptoms: ["fever", "drooling", "poor feeding"],
    vitals: { temperature: 38.0, pulse: 110 },
  }, {
    gold_standard_diagnosis: "Hand Foot and Mouth Disease",
    top_differential_diagnoses: ["HFMD", "Herpangina", "Herpes Stomatitis", "Varicella"],
    recommended_tests: ["Clinical Diagnosis"],
    recommended_medications: ["Paracetamol", "Oral Rehydration", "Topical Analgesics"],
    guideline_reference: "CDC HFMD Guidelines",
    danger_flag: false,
    organ_system: "infectious",
  }),

  makeCase("pediatrics", "complex", "Neonatal Sepsis", {
    chief_complaint: "Poor feeding, lethargy, and temperature instability in 5-day-old",
    symptoms: ["poor feeding", "lethargy", "temperature instability"],
    symptom_duration: "1 day",
    associated_symptoms: ["jaundice", "apneic episodes", "tachycardia"],
    vitals: { temperature: 35.5, pulse: 180, spo2: 90 },
    risk_factors: ["premature rupture of membranes", "maternal GBS"],
  }, {
    gold_standard_diagnosis: "Early-Onset Neonatal Sepsis",
    top_differential_diagnoses: ["Neonatal Sepsis", "Meningitis", "Congenital Heart Disease", "Metabolic Disorder"],
    recommended_tests: ["Blood Culture", "CBC", "CRP", "Lumbar Puncture", "Blood Glucose"],
    recommended_medications: ["Ampicillin", "Gentamicin"],
    guideline_reference: "AAP Neonatal Sepsis Guidelines 2018",
    danger_flag: true,
    organ_system: "infectious",
  }, ["emergency", "neonatal"]),

  makeCase("pediatrics", "common", "Acute Gastroenteritis — Pediatric", {
    chief_complaint: "Vomiting and watery diarrhea in 2-year-old for 2 days",
    symptoms: ["vomiting", "watery diarrhea", "irritability"],
    symptom_duration: "2 days",
    associated_symptoms: ["decreased urine output", "sunken eyes", "dry mucous membranes"],
    vitals: { temperature: 38.0, pulse: 130, bp_systolic: 85, bp_diastolic: 55 },
  }, {
    gold_standard_diagnosis: "Acute Viral Gastroenteritis",
    top_differential_diagnoses: ["Viral GE", "Bacterial GE", "Intussusception", "UTI"],
    recommended_tests: ["Clinical Assessment", "Electrolytes if dehydrated"],
    recommended_medications: ["ORS", "Zinc", "Ondansetron"],
    guideline_reference: "WHO Diarrhea Management Guidelines",
    danger_flag: false,
    organ_system: "gastrointestinal",
  }),

  makeCase("pediatrics", "moderate", "Acute Lymphoblastic Leukemia", {
    chief_complaint: "Persistent fever, bone pain, and easy bruising in 5-year-old",
    symptoms: ["persistent fever", "bone pain", "easy bruising", "pallor"],
    symptom_duration: "3 weeks",
    associated_symptoms: ["hepatosplenomegaly", "lymphadenopathy", "petechiae"],
    vitals: { temperature: 38.2, pulse: 110, spo2: 98 },
  }, {
    gold_standard_diagnosis: "Acute Lymphoblastic Leukemia",
    top_differential_diagnoses: ["ALL", "AML", "Neuroblastoma", "JIA", "ITP"],
    recommended_tests: ["CBC", "Peripheral Smear", "Bone Marrow Biopsy", "LDH", "Uric Acid"],
    recommended_medications: ["Chemotherapy Protocol"],
    guideline_reference: "COG ALL Treatment Guidelines",
    danger_flag: true,
    organ_system: "hematological",
  }),

  makeCase("pediatrics", "common", "Iron Deficiency Anemia — Pediatric", {
    chief_complaint: "Pallor and fatigue in 18-month-old with poor dietary iron",
    symptoms: ["pallor", "fatigue", "poor appetite"],
    symptom_duration: "2 months",
    associated_symptoms: ["pica", "irritability", "delayed growth"],
    vitals: { pulse: 120, spo2: 99 },
    risk_factors: ["excessive milk intake", "poor diet"],
  }, {
    gold_standard_diagnosis: "Iron Deficiency Anemia",
    top_differential_diagnoses: ["Iron Deficiency", "Thalassemia Trait", "Lead Poisoning", "Chronic Disease"],
    recommended_tests: ["CBC", "Ferritin", "Iron Studies", "Reticulocyte Count", "Lead Level"],
    recommended_medications: ["Oral Iron Supplement", "Dietary Counseling"],
    guideline_reference: "AAP Iron Deficiency Guidelines 2010",
    danger_flag: false,
    organ_system: "hematological",
  }),

  makeCase("pediatrics", "complex", "Meningococcal Meningitis — Pediatric", {
    chief_complaint: "Rapid onset fever, purpuric rash, and altered consciousness in child",
    symptoms: ["high fever", "purpuric rash", "neck stiffness", "altered consciousness"],
    symptom_duration: "8 hours",
    associated_symptoms: ["vomiting", "photophobia", "shock"],
    vitals: { temperature: 40.0, pulse: 160, bp_systolic: 70, bp_diastolic: 40, spo2: 90 },
  }, {
    gold_standard_diagnosis: "Meningococcal Meningitis",
    top_differential_diagnoses: ["Meningococcal Disease", "Pneumococcal Meningitis", "Viral Meningitis", "ITP"],
    recommended_tests: ["Blood Culture", "LP", "CBC", "CRP", "Coagulation Studies"],
    recommended_medications: ["Ceftriaxone", "Dexamethasone", "IV Fluids", "Vasopressors"],
    guideline_reference: "NICE Meningococcal Disease Guidelines 2015",
    danger_flag: true,
    organ_system: "infectious",
  }, ["emergency", "must_not_miss"]),
];

// ═══════════════════════════════════════════════════════
// PSYCHIATRY — 5 cases
// ═══════════════════════════════════════════════════════

const PSYCHIATRY: BenchmarkCaseV6[] = [
  makeCase("psychiatry", "common", "Major Depressive Disorder", {
    chief_complaint: "Persistent sadness, loss of interest, and insomnia for 3 months",
    symptoms: ["persistent sadness", "anhedonia", "insomnia", "fatigue"],
    symptom_duration: "3 months",
    associated_symptoms: ["poor concentration", "weight loss", "suicidal ideation"],
    vitals: { bp_systolic: 120, bp_diastolic: 75, pulse: 72 },
  }, {
    gold_standard_diagnosis: "Major Depressive Disorder",
    top_differential_diagnoses: ["MDD", "Bipolar Depression", "Hypothyroidism", "Chronic Fatigue Syndrome"],
    recommended_tests: ["PHQ-9", "TSH", "CBC", "Vitamin B12"],
    recommended_medications: ["Sertraline", "Escitalopram", "CBT"],
    guideline_reference: "APA Depression Guidelines 2023",
    danger_flag: false,
    organ_system: "neurological",
  }),

  makeCase("psychiatry", "moderate", "Acute Psychosis — First Episode", {
    chief_complaint: "Hearing voices, paranoia, and disorganized behavior for 2 weeks",
    symptoms: ["auditory hallucinations", "paranoid delusions", "disorganized speech"],
    symptom_duration: "2 weeks",
    associated_symptoms: ["social withdrawal", "sleep disturbance", "flat affect"],
    vitals: { bp_systolic: 125, bp_diastolic: 80, pulse: 85 },
    risk_factors: ["family history of schizophrenia", "young adult"],
  }, {
    gold_standard_diagnosis: "First-Episode Psychosis",
    top_differential_diagnoses: ["Schizophrenia", "Brief Psychotic Disorder", "Substance-Induced Psychosis", "Bipolar I"],
    recommended_tests: ["Urine Toxicology", "MRI Brain", "CBC", "TFTs", "Metabolic Panel"],
    recommended_medications: ["Risperidone", "Olanzapine", "Aripiprazole"],
    guideline_reference: "APA Schizophrenia Guidelines 2020",
    danger_flag: false,
    organ_system: "neurological",
  }),

  makeCase("psychiatry", "common", "Generalized Anxiety Disorder", {
    chief_complaint: "Excessive worry, restlessness, and muscle tension for 6 months",
    symptoms: ["excessive worry", "restlessness", "muscle tension", "difficulty sleeping"],
    symptom_duration: "6 months",
    associated_symptoms: ["difficulty concentrating", "irritability", "fatigue"],
    vitals: { bp_systolic: 130, bp_diastolic: 82, pulse: 88 },
  }, {
    gold_standard_diagnosis: "Generalized Anxiety Disorder",
    top_differential_diagnoses: ["GAD", "Hyperthyroidism", "Pheochromocytoma", "Caffeinism"],
    recommended_tests: ["GAD-7", "TSH", "CBC"],
    recommended_medications: ["Sertraline", "Venlafaxine", "Buspirone", "CBT"],
    guideline_reference: "APA Anxiety Guidelines 2023",
    danger_flag: false,
    organ_system: "neurological",
  }),

  makeCase("psychiatry", "complex", "Serotonin Syndrome", {
    chief_complaint: "Agitation, tremor, and hyperthermia after starting new antidepressant",
    symptoms: ["agitation", "tremor", "hyperthermia", "hyperreflexia"],
    symptom_duration: "6 hours",
    associated_symptoms: ["clonus", "diarrhea", "diaphoresis", "confusion"],
    vitals: { temperature: 39.5, pulse: 130, bp_systolic: 170, bp_diastolic: 100 },
    medications: ["Sertraline", "Tramadol"],
  }, {
    gold_standard_diagnosis: "Serotonin Syndrome",
    top_differential_diagnoses: ["Serotonin Syndrome", "NMS", "Anticholinergic Toxicity", "Malignant Hyperthermia"],
    recommended_tests: ["CK", "CBC", "BMP", "LFTs", "Coagulation"],
    recommended_medications: ["Stop Serotonergic Agents", "Cyproheptadine", "Benzodiazepines", "Cooling"],
    guideline_reference: "Hunter Criteria for Serotonin Toxicity",
    danger_flag: true,
    organ_system: "neurological",
  }, ["emergency", "drug_reaction"]),

  makeCase("psychiatry", "moderate", "Panic Disorder", {
    chief_complaint: "Recurrent episodes of chest pain, palpitations, and fear of dying",
    symptoms: ["chest pain", "palpitations", "fear of dying", "trembling"],
    symptom_duration: "recurrent over 2 months",
    associated_symptoms: ["derealization", "numbness", "sweating", "avoidance behavior"],
    vitals: { bp_systolic: 140, bp_diastolic: 88, pulse: 110 },
  }, {
    gold_standard_diagnosis: "Panic Disorder",
    top_differential_diagnoses: ["Panic Disorder", "ACS", "PE", "Hyperthyroidism", "Pheochromocytoma"],
    recommended_tests: ["ECG", "TSH", "CBC", "BMP"],
    recommended_medications: ["Sertraline", "Alprazolam", "CBT"],
    guideline_reference: "APA Panic Disorder Guidelines",
    danger_flag: false,
    organ_system: "neurological",
  }),
];

// ═══════════════════════════════════════════════════════
// RARE DISEASES — 5 cases
// ═══════════════════════════════════════════════════════

const RARE_DISEASES: BenchmarkCaseV6[] = [
  makeCase("rare_diseases", "rare", "Systemic Lupus Erythematosus", {
    chief_complaint: "Butterfly rash, joint pain, and fatigue in young woman",
    symptoms: ["malar rash", "arthralgia", "fatigue", "photosensitivity"],
    symptom_duration: "3 months",
    associated_symptoms: ["oral ulcers", "pleuritis", "proteinuria", "hair loss"],
    vitals: { bp_systolic: 130, bp_diastolic: 85, pulse: 80, temperature: 37.5 },
    risk_factors: ["young female"],
  }, {
    gold_standard_diagnosis: "Systemic Lupus Erythematosus",
    top_differential_diagnoses: ["SLE", "Rheumatoid Arthritis", "Dermatomyositis", "Mixed Connective Tissue Disease"],
    recommended_tests: ["ANA", "Anti-dsDNA", "C3/C4", "CBC", "Urinalysis", "Anti-Smith"],
    recommended_medications: ["Hydroxychloroquine", "Prednisolone", "Mycophenolate"],
    guideline_reference: "ACR/EULAR SLE Classification Criteria 2019",
    danger_flag: false,
    organ_system: "immunological",
  }),

  makeCase("rare_diseases", "rare", "Porphyria — Acute Intermittent", {
    chief_complaint: "Severe abdominal pain, dark urine, and psychiatric symptoms",
    symptoms: ["severe abdominal pain", "dark red urine", "confusion", "weakness"],
    symptom_duration: "3 days",
    associated_symptoms: ["tachycardia", "hypertension", "seizures", "peripheral neuropathy"],
    vitals: { pulse: 110, bp_systolic: 160, bp_diastolic: 100 },
    risk_factors: ["female", "premenstrual"],
  }, {
    gold_standard_diagnosis: "Acute Intermittent Porphyria",
    top_differential_diagnoses: ["AIP", "Lead Poisoning", "GBS", "Acute Abdomen"],
    recommended_tests: ["Urine PBG", "Urine ALA", "Genetic Testing"],
    recommended_medications: ["Hemin", "IV Glucose", "Avoid Triggers"],
    guideline_reference: "APF Porphyria Guidelines 2017",
    danger_flag: false,
    organ_system: "hematological",
  }),

  makeCase("rare_diseases", "rare", "Hemolytic Uremic Syndrome", {
    chief_complaint: "Bloody diarrhea followed by decreased urine and pallor in child",
    symptoms: ["bloody diarrhea", "oliguria", "pallor", "petechiae"],
    symptom_duration: "5 days",
    associated_symptoms: ["irritability", "edema", "jaundice"],
    vitals: { pulse: 130, bp_systolic: 130, bp_diastolic: 85 },
    risk_factors: ["recent undercooked beef consumption"],
  }, {
    gold_standard_diagnosis: "Hemolytic Uremic Syndrome",
    top_differential_diagnoses: ["HUS", "TTP", "DIC", "ITP"],
    recommended_tests: ["CBC", "Smear", "LDH", "Haptoglobin", "Creatinine", "Stool Culture for E. coli O157"],
    recommended_medications: ["Supportive Care", "Dialysis", "Blood Transfusion"],
    guideline_reference: "ASH TMA Guidelines 2020",
    danger_flag: true,
    organ_system: "hematological",
  }, ["pediatric", "renal"]),

  makeCase("rare_diseases", "rare", "Wilson Disease", {
    chief_complaint: "Jaundice, tremor, and behavioral changes in young adult",
    symptoms: ["jaundice", "tremor", "dysarthria", "personality changes"],
    symptom_duration: "2 months",
    associated_symptoms: ["Kayser-Fleischer rings", "hepatomegaly", "psychiatric symptoms"],
    vitals: { bp_systolic: 115, bp_diastolic: 70, pulse: 80 },
    risk_factors: ["young adult", "family history"],
  }, {
    gold_standard_diagnosis: "Wilson Disease",
    top_differential_diagnoses: ["Wilson Disease", "Autoimmune Hepatitis", "Viral Hepatitis", "Parkinson Disease"],
    recommended_tests: ["Ceruloplasmin", "24h Urine Copper", "Slit Lamp Exam", "Liver Biopsy"],
    recommended_medications: ["Penicillamine", "Trientine", "Zinc"],
    guideline_reference: "AASLD Wilson Disease Guidelines 2008",
    danger_flag: false,
    organ_system: "hepatic",
  }),

  makeCase("rare_diseases", "rare", "Addison Disease", {
    chief_complaint: "Chronic fatigue, weight loss, and skin darkening",
    symptoms: ["chronic fatigue", "weight loss", "hyperpigmentation", "dizziness"],
    symptom_duration: "3 months",
    associated_symptoms: ["salt craving", "orthostatic hypotension", "nausea"],
    vitals: { bp_systolic: 85, bp_diastolic: 55, pulse: 95 },
  }, {
    gold_standard_diagnosis: "Primary Adrenal Insufficiency (Addison Disease)",
    top_differential_diagnoses: ["Addison Disease", "Secondary AI", "Hypothyroidism", "Chronic Fatigue Syndrome"],
    recommended_tests: ["Morning Cortisol", "ACTH Stimulation Test", "ACTH Level", "Electrolytes"],
    recommended_medications: ["Hydrocortisone", "Fludrocortisone"],
    guideline_reference: "Endocrine Society Adrenal Insufficiency Guidelines 2016",
    danger_flag: false,
    organ_system: "endocrine",
  }),
];

// ═══════════════════════════════════════════════════════
// COMBINED DATASET
// ═══════════════════════════════════════════════════════

export const BENCHMARK_CASES_V6: BenchmarkCaseV6[] = [
  ...CARDIOLOGY,
  ...NEUROLOGY,
  ...PULMONOLOGY,
  ...GASTROENTEROLOGY,
  ...INFECTIOUS_DISEASE,
  ...EMERGENCY_MEDICINE,
  ...ENDOCRINOLOGY,
  ...NEPHROLOGY,
  ...DERMATOLOGY,
  ...PEDIATRICS,
  ...PSYCHIATRY,
  ...RARE_DISEASES,
];

// Verify distribution
export function getCaseDistribution(): Record<Specialty, number> {
  const dist: Record<string, number> = {};
  for (const c of BENCHMARK_CASES_V6) {
    dist[c.specialty] = (dist[c.specialty] || 0) + 1;
  }
  return dist as Record<Specialty, number>;
}

export function getDifficultyDistribution(): Record<CaseDifficulty, number> {
  const dist: Record<string, number> = {};
  for (const c of BENCHMARK_CASES_V6) {
    dist[c.difficulty] = (dist[c.difficulty] || 0) + 1;
  }
  return dist as Record<CaseDifficulty, number>;
}
