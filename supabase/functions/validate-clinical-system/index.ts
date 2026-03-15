import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── 50 Benchmark Scenarios ──
const BENCHMARK_SCENARIOS = [
  // ═══ EMERGENCY MEDICINE (10) ═══
  { id: "em_mi", name: "Acute MI", specialty: "emergency", chief_complaint: "severe crushing chest pain radiating to left arm",
    symptoms: ["chest pain", "left arm pain", "shortness of breath", "diaphoresis", "nausea"],
    vitals: { temperature: 37.0, pulse: 120, bp_systolic: 160, bp_diastolic: 95, spo2: 94 },
    history: ["hypertension", "diabetes", "smoking"], medications: ["metformin", "amlodipine"], allergies: [],
    expected_diagnoses: ["acute myocardial infarction", "myocardial infarction", "acute coronary syndrome"],
    expected_organ_system: "cardiovascular", danger_expected: true },
  { id: "em_pe", name: "Pulmonary Embolism", specialty: "emergency", chief_complaint: "sudden shortness of breath with pleuritic chest pain",
    symptoms: ["shortness of breath", "chest pain", "tachycardia", "hemoptysis", "leg swelling"],
    vitals: { temperature: 37.2, pulse: 125, bp_systolic: 100, bp_diastolic: 60, spo2: 88 },
    history: ["recent surgery", "obesity"], medications: [], allergies: [],
    expected_diagnoses: ["pulmonary embolism"], expected_organ_system: "respiratory", danger_expected: true },
  { id: "em_stroke", name: "Acute Ischemic Stroke", specialty: "emergency", chief_complaint: "sudden weakness on right side with speech difficulty",
    symptoms: ["weakness", "speech difficulty", "facial drooping", "confusion", "headache"],
    vitals: { temperature: 37.1, pulse: 88, bp_systolic: 180, bp_diastolic: 100, spo2: 96 },
    history: ["hypertension", "atrial fibrillation"], medications: ["warfarin", "lisinopril"], allergies: [],
    expected_diagnoses: ["acute ischemic stroke", "stroke", "transient ischemic attack"],
    expected_organ_system: "neurological", danger_expected: true },
  { id: "em_sah", name: "Subarachnoid Hemorrhage", specialty: "emergency", chief_complaint: "sudden thunderclap headache, worst headache of my life",
    symptoms: ["headache", "neck stiffness", "nausea", "vomiting", "photophobia", "confusion"],
    vitals: { temperature: 37.5, pulse: 100, bp_systolic: 190, bp_diastolic: 110, spo2: 97 },
    history: ["smoking"], medications: [], allergies: [],
    expected_diagnoses: ["subarachnoid hemorrhage"], expected_organ_system: "neurological", danger_expected: true },
  { id: "em_sepsis", name: "Sepsis", specialty: "emergency", chief_complaint: "high fever with confusion and low blood pressure",
    symptoms: ["fever", "confusion", "tachycardia", "hypotension", "fatigue", "chills"],
    vitals: { temperature: 39.8, pulse: 130, bp_systolic: 85, bp_diastolic: 50, spo2: 91, respiratory_rate: 28 },
    history: ["diabetes", "urinary tract infection"], medications: ["metformin"], allergies: [],
    expected_diagnoses: ["sepsis", "septic shock", "urosepsis"],
    expected_organ_system: "infectious", danger_expected: true },
  { id: "em_pneumothorax", name: "Tension Pneumothorax", specialty: "emergency", chief_complaint: "sudden severe chest pain with difficulty breathing after trauma",
    symptoms: ["chest pain", "shortness of breath", "tachycardia", "decreased breath sounds"],
    vitals: { temperature: 37.0, pulse: 135, bp_systolic: 80, bp_diastolic: 50, spo2: 84, respiratory_rate: 34 },
    history: ["trauma"], medications: [], allergies: [],
    expected_diagnoses: ["tension pneumothorax", "pneumothorax"],
    expected_organ_system: "respiratory", danger_expected: true },
  { id: "em_anaphylaxis", name: "Anaphylaxis", specialty: "emergency", chief_complaint: "sudden swelling of lips and tongue with difficulty breathing after eating peanuts",
    symptoms: ["shortness of breath", "wheezing", "rash", "swelling", "hypotension", "tachycardia"],
    vitals: { temperature: 37.0, pulse: 130, bp_systolic: 75, bp_diastolic: 40, spo2: 88 },
    history: ["peanut allergy"], medications: [], allergies: ["peanuts"],
    expected_diagnoses: ["anaphylaxis", "anaphylactic shock"],
    expected_organ_system: "immunological", danger_expected: true },
  { id: "em_dka", name: "Diabetic Ketoacidosis", specialty: "emergency", chief_complaint: "nausea vomiting abdominal pain and confusion in a diabetic patient",
    symptoms: ["nausea", "vomiting", "abdominal pain", "confusion", "dehydration", "fruity breath"],
    vitals: { temperature: 37.2, pulse: 115, bp_systolic: 95, bp_diastolic: 55, spo2: 96, respiratory_rate: 30 },
    history: ["type 1 diabetes"], medications: ["insulin"], allergies: [],
    expected_diagnoses: ["diabetic ketoacidosis", "DKA"],
    expected_organ_system: "endocrine", danger_expected: true },
  { id: "em_meningitis", name: "Bacterial Meningitis", specialty: "emergency", chief_complaint: "severe headache with neck stiffness and high fever",
    symptoms: ["headache", "neck stiffness", "fever", "photophobia", "nausea", "confusion"],
    vitals: { temperature: 39.5, pulse: 115, bp_systolic: 130, bp_diastolic: 85, spo2: 96 },
    history: [], medications: [], allergies: ["penicillin"],
    expected_diagnoses: ["meningitis", "bacterial meningitis"],
    expected_organ_system: "neurological", danger_expected: true },
  { id: "em_appendicitis", name: "Acute Appendicitis", specialty: "emergency", chief_complaint: "periumbilical pain migrating to right lower quadrant with fever",
    symptoms: ["abdominal pain", "nausea", "vomiting", "fever", "loss of appetite"],
    vitals: { temperature: 38.3, pulse: 100, bp_systolic: 130, bp_diastolic: 80, spo2: 98 },
    history: [], medications: [], allergies: [],
    expected_diagnoses: ["appendicitis", "acute appendicitis"],
    expected_organ_system: "gastrointestinal", danger_expected: true },

  // ═══ CARDIOLOGY (5) ═══
  { id: "card_angina", name: "Stable Angina", specialty: "cardiology", chief_complaint: "chest pain on exertion relieved by rest",
    symptoms: ["chest pain", "exertional dyspnea", "fatigue"],
    vitals: { temperature: 37.0, pulse: 78, bp_systolic: 145, bp_diastolic: 90, spo2: 97 },
    history: ["hypertension", "smoking"], medications: ["amlodipine"], allergies: [],
    expected_diagnoses: ["stable angina", "angina pectoris", "chronic coronary disease"],
    expected_organ_system: "cardiovascular", danger_expected: false },
  { id: "card_hf", name: "Congestive Heart Failure", specialty: "cardiology", chief_complaint: "progressive shortness of breath, leg swelling and fatigue over 2 weeks",
    symptoms: ["shortness of breath", "leg swelling", "fatigue", "orthopnea", "paroxysmal nocturnal dyspnea"],
    vitals: { temperature: 37.0, pulse: 95, bp_systolic: 155, bp_diastolic: 95, spo2: 92 },
    history: ["hypertension", "diabetes", "prior MI"], medications: ["lisinopril", "metformin"], allergies: [],
    expected_diagnoses: ["congestive heart failure", "heart failure", "CHF"],
    expected_organ_system: "cardiovascular", danger_expected: true },
  { id: "card_afib", name: "Atrial Fibrillation", specialty: "cardiology", chief_complaint: "palpitations and irregular heartbeat with dizziness",
    symptoms: ["palpitations", "dizziness", "fatigue", "shortness of breath", "chest discomfort"],
    vitals: { temperature: 37.0, pulse: 145, bp_systolic: 130, bp_diastolic: 80, spo2: 96 },
    history: ["hypertension"], medications: ["amlodipine"], allergies: [],
    expected_diagnoses: ["atrial fibrillation", "arrhythmia", "AF"],
    expected_organ_system: "cardiovascular", danger_expected: false },
  { id: "card_pericarditis", name: "Acute Pericarditis", specialty: "cardiology", chief_complaint: "sharp chest pain worse when lying down, improved by leaning forward",
    symptoms: ["chest pain", "fever", "pericardial friction rub", "dyspnea"],
    vitals: { temperature: 38.1, pulse: 92, bp_systolic: 125, bp_diastolic: 78, spo2: 97 },
    history: ["recent viral illness"], medications: [], allergies: [],
    expected_diagnoses: ["acute pericarditis", "pericarditis"],
    expected_organ_system: "cardiovascular", danger_expected: false },
  { id: "card_hyp_crisis", name: "Hypertensive Crisis", specialty: "cardiology", chief_complaint: "severe headache with blurred vision and very high blood pressure",
    symptoms: ["headache", "blurred vision", "nausea", "chest pain", "confusion"],
    vitals: { temperature: 37.0, pulse: 100, bp_systolic: 210, bp_diastolic: 130, spo2: 96 },
    history: ["hypertension", "non-compliance with medication"], medications: ["amlodipine"], allergies: [],
    expected_diagnoses: ["hypertensive crisis", "hypertensive emergency", "malignant hypertension"],
    expected_organ_system: "cardiovascular", danger_expected: true },

  // ═══ PULMONOLOGY (5) ═══
  { id: "pulm_pneumonia", name: "Community-Acquired Pneumonia", specialty: "pulmonology", chief_complaint: "productive cough with fever and chest pain for 5 days",
    symptoms: ["cough", "fever", "chest pain", "shortness of breath", "sputum production", "fatigue"],
    vitals: { temperature: 39.2, pulse: 110, bp_systolic: 125, bp_diastolic: 80, spo2: 92, respiratory_rate: 28 },
    history: ["smoking"], medications: [], allergies: [],
    expected_diagnoses: ["community-acquired pneumonia", "pneumonia", "bacterial pneumonia"],
    expected_organ_system: "respiratory", danger_expected: false },
  { id: "pulm_asthma", name: "Asthma Exacerbation", specialty: "pulmonology", chief_complaint: "wheezing and difficulty breathing for 2 hours",
    symptoms: ["wheezing", "shortness of breath", "cough", "chest tightness"],
    vitals: { temperature: 37.0, pulse: 105, bp_systolic: 120, bp_diastolic: 78, spo2: 91, respiratory_rate: 30 },
    history: ["asthma"], medications: ["salbutamol inhaler"], allergies: ["aspirin"],
    expected_diagnoses: ["asthma", "asthma exacerbation", "bronchospasm"],
    expected_organ_system: "respiratory", danger_expected: false },
  { id: "pulm_copd", name: "COPD Exacerbation", specialty: "pulmonology", chief_complaint: "worsening cough with increased sputum and breathlessness over 3 days",
    symptoms: ["cough", "sputum production", "shortness of breath", "wheezing", "fatigue"],
    vitals: { temperature: 37.8, pulse: 100, bp_systolic: 135, bp_diastolic: 85, spo2: 89, respiratory_rate: 26 },
    history: ["COPD", "smoking 30 pack-years"], medications: ["tiotropium", "salbutamol"], allergies: [],
    expected_diagnoses: ["COPD exacerbation", "COPD", "chronic obstructive pulmonary disease"],
    expected_organ_system: "respiratory", danger_expected: false },
  { id: "pulm_tb", name: "Pulmonary Tuberculosis", specialty: "pulmonology", chief_complaint: "chronic cough for 3 weeks with night sweats and weight loss",
    symptoms: ["cough", "night sweats", "weight loss", "fever", "hemoptysis", "fatigue"],
    vitals: { temperature: 38.0, pulse: 90, bp_systolic: 115, bp_diastolic: 70, spo2: 95 },
    history: ["contact with TB patient"], medications: [], allergies: [],
    expected_diagnoses: ["pulmonary tuberculosis", "tuberculosis", "TB"],
    expected_organ_system: "respiratory", danger_expected: true },
  { id: "pulm_effusion", name: "Pleural Effusion", specialty: "pulmonology", chief_complaint: "progressive breathlessness with dull chest pain",
    symptoms: ["shortness of breath", "chest pain", "cough", "decreased breath sounds"],
    vitals: { temperature: 37.5, pulse: 88, bp_systolic: 120, bp_diastolic: 75, spo2: 93 },
    history: ["congestive heart failure"], medications: ["furosemide"], allergies: [],
    expected_diagnoses: ["pleural effusion"],
    expected_organ_system: "respiratory", danger_expected: false },

  // ═══ GASTROENTEROLOGY (5) ═══
  { id: "gi_gerd", name: "GERD", specialty: "gastroenterology", chief_complaint: "burning chest pain after meals with acid taste in mouth",
    symptoms: ["heartburn", "acid reflux", "chest pain", "dysphagia", "nausea"],
    vitals: { temperature: 37.0, pulse: 72, bp_systolic: 120, bp_diastolic: 78, spo2: 99 },
    history: ["obesity"], medications: [], allergies: [],
    expected_diagnoses: ["GERD", "gastroesophageal reflux disease", "acid reflux"],
    expected_organ_system: "gastrointestinal", danger_expected: false },
  { id: "gi_pancreatitis", name: "Acute Pancreatitis", specialty: "gastroenterology", chief_complaint: "severe epigastric pain radiating to back with vomiting",
    symptoms: ["abdominal pain", "nausea", "vomiting", "epigastric pain", "fever"],
    vitals: { temperature: 38.5, pulse: 110, bp_systolic: 105, bp_diastolic: 65, spo2: 96 },
    history: ["alcohol use", "gallstones"], medications: [], allergies: [],
    expected_diagnoses: ["acute pancreatitis", "pancreatitis"],
    expected_organ_system: "gastrointestinal", danger_expected: true },
  { id: "gi_cholecystitis", name: "Acute Cholecystitis", specialty: "gastroenterology", chief_complaint: "right upper quadrant pain after fatty meal with fever",
    symptoms: ["abdominal pain", "nausea", "vomiting", "fever", "right upper quadrant pain"],
    vitals: { temperature: 38.2, pulse: 95, bp_systolic: 130, bp_diastolic: 82, spo2: 98 },
    history: ["gallstones"], medications: [], allergies: [],
    expected_diagnoses: ["acute cholecystitis", "cholecystitis", "gallbladder inflammation"],
    expected_organ_system: "gastrointestinal", danger_expected: false },
  { id: "gi_gastroenteritis", name: "Viral Gastroenteritis", specialty: "gastroenterology", chief_complaint: "watery diarrhea and vomiting for 2 days",
    symptoms: ["diarrhea", "vomiting", "abdominal pain", "nausea", "fever", "dehydration"],
    vitals: { temperature: 38.0, pulse: 100, bp_systolic: 105, bp_diastolic: 65, spo2: 98 },
    history: [], medications: [], allergies: [],
    expected_diagnoses: ["gastroenteritis", "viral gastroenteritis", "food poisoning"],
    expected_organ_system: "gastrointestinal", danger_expected: false },
  { id: "gi_obstruction", name: "Small Bowel Obstruction", specialty: "gastroenterology", chief_complaint: "colicky abdominal pain with vomiting and inability to pass stool",
    symptoms: ["abdominal pain", "vomiting", "constipation", "abdominal distension", "nausea"],
    vitals: { temperature: 37.8, pulse: 105, bp_systolic: 110, bp_diastolic: 70, spo2: 97 },
    history: ["previous abdominal surgery"], medications: [], allergies: [],
    expected_diagnoses: ["bowel obstruction", "small bowel obstruction", "intestinal obstruction"],
    expected_organ_system: "gastrointestinal", danger_expected: true },

  // ═══ NEUROLOGY (5) ═══
  { id: "neuro_migraine", name: "Migraine with Aura", specialty: "neurology", chief_complaint: "severe unilateral throbbing headache with visual disturbances",
    symptoms: ["headache", "nausea", "photophobia", "visual aura", "phonophobia"],
    vitals: { temperature: 37.0, pulse: 78, bp_systolic: 125, bp_diastolic: 80, spo2: 99 },
    history: ["migraine"], medications: ["sumatriptan"], allergies: [],
    expected_diagnoses: ["migraine", "migraine with aura"],
    expected_organ_system: "neurological", danger_expected: false },
  { id: "neuro_epilepsy", name: "Generalized Seizure", specialty: "neurology", chief_complaint: "witnessed convulsion with loss of consciousness lasting 3 minutes",
    symptoms: ["seizure", "loss of consciousness", "confusion", "tongue biting", "incontinence"],
    vitals: { temperature: 37.5, pulse: 100, bp_systolic: 140, bp_diastolic: 85, spo2: 94 },
    history: ["epilepsy"], medications: ["levetiracetam"], allergies: [],
    expected_diagnoses: ["epilepsy", "generalized seizure", "tonic-clonic seizure"],
    expected_organ_system: "neurological", danger_expected: true },
  { id: "neuro_gbs", name: "Guillain-Barré Syndrome", specialty: "neurology", chief_complaint: "ascending weakness in both legs over 3 days with tingling",
    symptoms: ["weakness", "tingling", "numbness", "difficulty walking", "areflexia"],
    vitals: { temperature: 37.0, pulse: 80, bp_systolic: 120, bp_diastolic: 75, spo2: 97 },
    history: ["recent respiratory infection"], medications: [], allergies: [],
    expected_diagnoses: ["Guillain-Barré syndrome", "GBS"],
    expected_organ_system: "neurological", danger_expected: true },
  { id: "neuro_parkinsons", name: "Parkinson's Disease", specialty: "neurology", chief_complaint: "progressive tremor in right hand with stiffness and slow movements",
    symptoms: ["tremor", "rigidity", "bradykinesia", "postural instability", "shuffling gait"],
    vitals: { temperature: 37.0, pulse: 68, bp_systolic: 130, bp_diastolic: 78, spo2: 98 },
    history: [], medications: [], allergies: [],
    expected_diagnoses: ["Parkinson's disease", "parkinsonism"],
    expected_organ_system: "neurological", danger_expected: false },
  { id: "neuro_ms", name: "Multiple Sclerosis Relapse", specialty: "neurology", chief_complaint: "blurred vision in one eye with weakness and numbness",
    symptoms: ["blurred vision", "weakness", "numbness", "fatigue", "optic neuritis"],
    vitals: { temperature: 37.0, pulse: 74, bp_systolic: 118, bp_diastolic: 72, spo2: 99 },
    history: ["multiple sclerosis"], medications: ["interferon beta"], allergies: [],
    expected_diagnoses: ["multiple sclerosis", "MS relapse", "demyelinating disease"],
    expected_organ_system: "neurological", danger_expected: false },

  // ═══ ENDOCRINOLOGY (5) ═══
  { id: "endo_hypothyroid", name: "Hypothyroidism", specialty: "endocrinology", chief_complaint: "fatigue weight gain and cold intolerance for 3 months",
    symptoms: ["fatigue", "weight gain", "cold intolerance", "constipation", "dry skin", "hair loss"],
    vitals: { temperature: 36.2, pulse: 58, bp_systolic: 115, bp_diastolic: 72, spo2: 99 },
    history: ["family history of thyroid disease"], medications: [], allergies: [],
    expected_diagnoses: ["hypothyroidism", "Hashimoto's thyroiditis", "underactive thyroid"],
    expected_organ_system: "endocrine", danger_expected: false },
  { id: "endo_hyperthyroid", name: "Hyperthyroidism / Graves", specialty: "endocrinology", chief_complaint: "weight loss with tremor and palpitations despite eating well",
    symptoms: ["weight loss", "palpitations", "tremor", "heat intolerance", "diarrhea", "anxiety"],
    vitals: { temperature: 37.5, pulse: 115, bp_systolic: 140, bp_diastolic: 70, spo2: 99 },
    history: ["family history of autoimmune disease"], medications: [], allergies: [],
    expected_diagnoses: ["hyperthyroidism", "Graves' disease", "thyrotoxicosis"],
    expected_organ_system: "endocrine", danger_expected: false },
  { id: "endo_dm2", name: "Type 2 Diabetes (New)", specialty: "endocrinology", chief_complaint: "increased thirst frequent urination and blurred vision for 2 months",
    symptoms: ["polyuria", "polydipsia", "blurred vision", "fatigue", "weight loss"],
    vitals: { temperature: 37.0, pulse: 80, bp_systolic: 135, bp_diastolic: 85, spo2: 99 },
    history: ["obesity", "family history of diabetes"], medications: [], allergies: [],
    expected_diagnoses: ["type 2 diabetes", "diabetes mellitus", "diabetes"],
    expected_organ_system: "endocrine", danger_expected: false },
  { id: "endo_addison", name: "Adrenal Insufficiency", specialty: "endocrinology", chief_complaint: "chronic fatigue with hyperpigmentation and dizziness on standing",
    symptoms: ["fatigue", "hyperpigmentation", "dizziness", "nausea", "weight loss", "hypotension"],
    vitals: { temperature: 37.0, pulse: 90, bp_systolic: 90, bp_diastolic: 55, spo2: 98 },
    history: ["autoimmune disease"], medications: [], allergies: [],
    expected_diagnoses: ["Addison's disease", "adrenal insufficiency", "primary adrenal insufficiency"],
    expected_organ_system: "endocrine", danger_expected: true },
  { id: "endo_cushing", name: "Cushing's Syndrome", specialty: "endocrinology", chief_complaint: "weight gain in face and trunk with easy bruising and stretch marks",
    symptoms: ["weight gain", "moon facies", "easy bruising", "striae", "hypertension", "fatigue"],
    vitals: { temperature: 37.0, pulse: 82, bp_systolic: 155, bp_diastolic: 95, spo2: 99 },
    history: ["long-term steroid use"], medications: ["prednisone"], allergies: [],
    expected_diagnoses: ["Cushing's syndrome", "hypercortisolism"],
    expected_organ_system: "endocrine", danger_expected: false },

  // ═══ INFECTIOUS DISEASES (5) ═══
  { id: "id_dengue", name: "Dengue Fever", specialty: "infectious", chief_complaint: "high fever with severe body aches and rash for 4 days",
    symptoms: ["fever", "body aches", "headache", "rash", "retro-orbital pain", "fatigue"],
    vitals: { temperature: 39.5, pulse: 105, bp_systolic: 100, bp_diastolic: 60, spo2: 97 },
    history: ["travel to endemic area"], medications: [], allergies: [],
    expected_diagnoses: ["dengue fever", "dengue"],
    expected_organ_system: "infectious", danger_expected: true },
  { id: "id_malaria", name: "Malaria", specialty: "infectious", chief_complaint: "cyclical fever with chills and rigors every 48 hours",
    symptoms: ["fever", "chills", "rigors", "headache", "fatigue", "nausea", "splenomegaly"],
    vitals: { temperature: 40.0, pulse: 110, bp_systolic: 105, bp_diastolic: 65, spo2: 96 },
    history: ["travel to malaria-endemic area"], medications: [], allergies: [],
    expected_diagnoses: ["malaria", "plasmodium infection"],
    expected_organ_system: "infectious", danger_expected: true },
  { id: "id_uti", name: "Urinary Tract Infection", specialty: "infectious", chief_complaint: "burning urination with frequency and lower abdominal pain",
    symptoms: ["dysuria", "urinary frequency", "abdominal pain", "urgency", "hematuria"],
    vitals: { temperature: 37.8, pulse: 82, bp_systolic: 120, bp_diastolic: 75, spo2: 99 },
    history: [], medications: [], allergies: [],
    expected_diagnoses: ["urinary tract infection", "UTI", "cystitis"],
    expected_organ_system: "genitourinary", danger_expected: false },
  { id: "id_cellulitis", name: "Cellulitis", specialty: "infectious", chief_complaint: "red hot swollen area on lower leg with fever",
    symptoms: ["skin redness", "swelling", "warmth", "fever", "pain", "tenderness"],
    vitals: { temperature: 38.5, pulse: 90, bp_systolic: 125, bp_diastolic: 78, spo2: 98 },
    history: ["diabetes"], medications: ["metformin"], allergies: [],
    expected_diagnoses: ["cellulitis", "skin infection"],
    expected_organ_system: "dermatological", danger_expected: false },
  { id: "id_viral_fever", name: "Viral Upper Respiratory Infection", specialty: "infectious", chief_complaint: "sore throat with runny nose and mild fever for 3 days",
    symptoms: ["sore throat", "rhinorrhea", "fever", "cough", "body aches", "fatigue"],
    vitals: { temperature: 38.0, pulse: 85, bp_systolic: 118, bp_diastolic: 72, spo2: 98 },
    history: [], medications: [], allergies: [],
    expected_diagnoses: ["viral infection", "upper respiratory infection", "common cold", "influenza"],
    expected_organ_system: "infectious", danger_expected: false },

  // ═══ PEDIATRICS (5) ═══
  { id: "peds_bronchiolitis", name: "Bronchiolitis (Infant)", specialty: "pediatrics", chief_complaint: "6-month-old with wheezing cough and poor feeding",
    symptoms: ["wheezing", "cough", "poor feeding", "tachypnea", "nasal congestion"],
    vitals: { temperature: 38.0, pulse: 160, bp_systolic: 80, bp_diastolic: 50, spo2: 92, respiratory_rate: 50 },
    history: ["premature birth"], medications: [], allergies: [],
    expected_diagnoses: ["bronchiolitis", "RSV infection", "viral bronchiolitis"],
    expected_organ_system: "respiratory", danger_expected: false },
  { id: "peds_otitis", name: "Acute Otitis Media", specialty: "pediatrics", chief_complaint: "3-year-old with ear pain fever and irritability",
    symptoms: ["ear pain", "fever", "irritability", "hearing loss", "ear discharge"],
    vitals: { temperature: 38.5, pulse: 120, bp_systolic: 90, bp_diastolic: 60, spo2: 99 },
    history: ["recurrent ear infections"], medications: [], allergies: [],
    expected_diagnoses: ["acute otitis media", "otitis media", "ear infection"],
    expected_organ_system: "ENT", danger_expected: false },
  { id: "peds_croup", name: "Croup", specialty: "pediatrics", chief_complaint: "2-year-old with barking cough and stridor at night",
    symptoms: ["barking cough", "stridor", "hoarseness", "fever", "respiratory distress"],
    vitals: { temperature: 38.2, pulse: 130, bp_systolic: 85, bp_diastolic: 55, spo2: 94, respiratory_rate: 40 },
    history: [], medications: [], allergies: [],
    expected_diagnoses: ["croup", "laryngotracheobronchitis", "viral croup"],
    expected_organ_system: "respiratory", danger_expected: false },
  { id: "peds_kawasaki", name: "Kawasaki Disease", specialty: "pediatrics", chief_complaint: "4-year-old with persistent high fever, rash, and red eyes for 5 days",
    symptoms: ["fever", "rash", "conjunctivitis", "swollen lymph nodes", "cracked lips", "swollen hands"],
    vitals: { temperature: 39.5, pulse: 140, bp_systolic: 90, bp_diastolic: 55, spo2: 98 },
    history: [], medications: [], allergies: [],
    expected_diagnoses: ["Kawasaki disease"],
    expected_organ_system: "cardiovascular", danger_expected: true },
  { id: "peds_febrile_seizure", name: "Febrile Seizure", specialty: "pediatrics", chief_complaint: "18-month-old with convulsion during high fever episode",
    symptoms: ["seizure", "fever", "loss of consciousness", "confusion"],
    vitals: { temperature: 39.8, pulse: 150, bp_systolic: 85, bp_diastolic: 55, spo2: 95 },
    history: ["prior febrile seizure"], medications: [], allergies: [],
    expected_diagnoses: ["febrile seizure"],
    expected_organ_system: "neurological", danger_expected: true },

  // ═══ NEPHROLOGY (3) ═══
  { id: "neph_aki", name: "Acute Kidney Injury", specialty: "nephrology", chief_complaint: "decreased urine output with swelling and confusion",
    symptoms: ["oliguria", "edema", "confusion", "nausea", "fatigue"],
    vitals: { temperature: 37.2, pulse: 95, bp_systolic: 155, bp_diastolic: 95, spo2: 96 },
    history: ["diabetes", "hypertension", "recent NSAID use"], medications: ["metformin", "ibuprofen"], allergies: [],
    expected_diagnoses: ["acute kidney injury", "AKI", "acute renal failure"],
    expected_organ_system: "renal", danger_expected: true },
  { id: "neph_ckd", name: "Chronic Kidney Disease", specialty: "nephrology", chief_complaint: "progressive fatigue with leg swelling and decreased urine",
    symptoms: ["fatigue", "edema", "nausea", "decreased appetite", "itching"],
    vitals: { temperature: 37.0, pulse: 82, bp_systolic: 160, bp_diastolic: 100, spo2: 97 },
    history: ["diabetes", "hypertension for 15 years"], medications: ["metformin", "lisinopril"], allergies: [],
    expected_diagnoses: ["chronic kidney disease", "CKD", "renal insufficiency"],
    expected_organ_system: "renal", danger_expected: false },
  { id: "neph_stones", name: "Nephrolithiasis", specialty: "nephrology", chief_complaint: "severe colicky flank pain radiating to groin with blood in urine",
    symptoms: ["flank pain", "hematuria", "nausea", "vomiting", "dysuria"],
    vitals: { temperature: 37.2, pulse: 100, bp_systolic: 145, bp_diastolic: 85, spo2: 99 },
    history: ["prior kidney stones"], medications: [], allergies: [],
    expected_diagnoses: ["nephrolithiasis", "kidney stones", "renal calculi"],
    expected_organ_system: "renal", danger_expected: false },

  // ═══ HEMATOLOGY (2) ═══
  { id: "heme_ida", name: "Iron Deficiency Anemia", specialty: "hematology", chief_complaint: "progressive fatigue with pallor and pica for 2 months",
    symptoms: ["fatigue", "pallor", "pica", "shortness of breath", "dizziness", "brittle nails"],
    vitals: { temperature: 37.0, pulse: 95, bp_systolic: 110, bp_diastolic: 68, spo2: 98 },
    history: ["heavy menstrual periods"], medications: [], allergies: [],
    expected_diagnoses: ["iron deficiency anemia", "anemia"],
    expected_organ_system: "hematological", danger_expected: false },
  { id: "heme_dvt", name: "Deep Vein Thrombosis", specialty: "hematology", chief_complaint: "swollen painful left calf after long flight",
    symptoms: ["leg swelling", "calf pain", "warmth", "redness", "tenderness"],
    vitals: { temperature: 37.2, pulse: 88, bp_systolic: 125, bp_diastolic: 78, spo2: 98 },
    history: ["oral contraceptive use", "recent long-haul flight"], medications: ["oral contraceptive"], allergies: [],
    expected_diagnoses: ["deep vein thrombosis", "DVT", "venous thromboembolism"],
    expected_organ_system: "hematological", danger_expected: true },
];

// ── Dangerous diagnosis triggers ──
const DANGEROUS_TRIGGERS: Record<string, string[]> = {
  "chest pain": ["myocardial infarction", "pulmonary embolism", "aortic dissection", "pneumothorax"],
  "headache": ["subarachnoid hemorrhage", "meningitis", "stroke"],
  "neck stiffness": ["meningitis", "subarachnoid hemorrhage"],
  "abdominal pain": ["appendicitis", "ectopic pregnancy", "bowel perforation", "pancreatitis"],
  "shortness of breath": ["pulmonary embolism", "pneumothorax", "acute heart failure", "anaphylaxis"],
  "weakness": ["stroke", "transient ischemic attack", "Guillain-Barré syndrome"],
  "speech difficulty": ["stroke"],
  "facial drooping": ["stroke"],
  "hemoptysis": ["pulmonary embolism", "tuberculosis"],
  "syncope": ["cardiac arrhythmia", "aortic dissection"],
  "confusion": ["meningitis", "stroke", "sepsis", "DKA"],
  "seizure": ["status epilepticus", "meningitis"],
  "fever": ["sepsis", "meningitis"],
  "hypotension": ["sepsis", "anaphylaxis"],
  "leg swelling": ["deep vein thrombosis", "heart failure"],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fuzzyMatch(actual: string[], expected: string[]): string[] {
  const normExpected = expected.map(normalize);
  return actual.filter((a) => {
    const na = normalize(a);
    return normExpected.some((e) => na.includes(e) || e.includes(na));
  });
}

// ════════════════════════════════════════════════════════════════════
// WORLD MODEL
// ════════════════════════════════════════════════════════════════════
interface WorldModelState {
  organ_systems: string[];
  organ_system_weights: Record<string, number>;
  physiological_states: Array<{ process: string; organ_system: string; confidence: number }>;
  hypotheses: Array<{ disease: string; confidence: number; organ_system: string; source: string }>;
  dangerous_conditions: string[];
  risk_level: string;
  state_confidence: number;
  reasoning_traces: Array<{ symptom: string; physiology: string; disease: string; chain: string }>;
  latency_ms: number;
}

function buildWorldModel(
  symptoms: string[], vitals: any,
  activationRules: Array<{ symptom: string; organ_system: string; activation_weight: number }>,
  physiologyMap: Array<{ symptom: string; physiology_process: string; organ_system: string }>,
  physiologyDiagMap: Array<{ physiology_process: string; disease_name: string; confidence_score: number }>,
  specificityMap: Record<string, number>,
): WorldModelState {
  const start = Date.now();
  const syms = symptoms.map(s => s.toLowerCase());

  const systemScores: Record<string, number> = {};
  for (const s of syms) {
    const rules = activationRules.filter(r => r.symptom.toLowerCase() === s);
    for (const r of rules) {
      systemScores[r.organ_system] = (systemScores[r.organ_system] || 0) + r.activation_weight;
    }
  }
  const sortedSystems = Object.entries(systemScores).sort(([, a], [, b]) => b - a);
  const activeOrganSystems = sortedSystems.filter(([, w]) => w >= 1.0).map(([s]) => s);

  const physiologicalStates: WorldModelState["physiological_states"] = [];
  const seenProcesses = new Set<string>();
  for (const s of syms) {
    const matches = physiologyMap.filter(p => p.symptom.toLowerCase() === s);
    for (const m of matches) {
      if (!seenProcesses.has(m.physiology_process)) {
        seenProcesses.add(m.physiology_process);
        const spec = specificityMap[s] || 0.35;
        physiologicalStates.push({ process: m.physiology_process, organ_system: m.organ_system, confidence: Math.round(Math.min(1.0, spec * 1.2) * 100) / 100 });
      }
    }
  }

  const hypotheses: WorldModelState["hypotheses"] = [];
  const seenDiseases = new Set<string>();
  for (const ps of physiologicalStates) {
    const matches = physiologyDiagMap.filter(pd => pd.physiology_process.toLowerCase() === ps.process.toLowerCase());
    for (const m of matches) {
      const key = m.disease_name.toLowerCase();
      if (!seenDiseases.has(key)) {
        seenDiseases.add(key);
        hypotheses.push({ disease: m.disease_name, confidence: Math.round(ps.confidence * (m.confidence_score || 0.5) * 100) / 100, organ_system: ps.organ_system, source: "physiology" });
      }
    }
  }

  const dangerousConditions: string[] = [];
  for (const s of syms) {
    const dangers = DANGEROUS_TRIGGERS[s];
    if (dangers) {
      for (const d of dangers) {
        const key = d.toLowerCase();
        if (!seenDiseases.has(key)) {
          seenDiseases.add(key);
          dangerousConditions.push(d);
          hypotheses.push({ disease: d, confidence: 0.05, organ_system: activeOrganSystems[0] || "general", source: "dangerous" });
        } else if (!dangerousConditions.includes(d)) {
          dangerousConditions.push(d);
        }
      }
    }
  }

  const traces: WorldModelState["reasoning_traces"] = [];
  for (const ps of physiologicalStates) {
    const matchedDiseases = physiologyDiagMap.filter(pd => pd.physiology_process.toLowerCase() === ps.process.toLowerCase());
    const originSymptom = physiologyMap.find(p => p.physiology_process === ps.process)?.symptom || "unknown";
    for (const md of matchedDiseases.slice(0, 2)) {
      traces.push({ symptom: originSymptom, physiology: ps.process, disease: md.disease_name, chain: `${originSymptom} → ${ps.process} → ${md.disease_name}` });
    }
  }

  let riskLevel = "low";
  if (dangerousConditions.length > 0) riskLevel = "high";
  if (dangerousConditions.length >= 3) riskLevel = "critical";
  else if (hypotheses.length >= 3 && riskLevel === "low") riskLevel = "moderate";

  if (vitals) {
    if ((vitals.spo2 && vitals.spo2 < 92) || (vitals.bp_systolic && vitals.bp_systolic >= 180) || (vitals.bp_systolic && vitals.bp_systolic < 90)) {
      if (riskLevel !== "critical") riskLevel = "high";
    }
  }

  const avgSpec = syms.length > 0 ? syms.reduce((a, s) => a + (specificityMap[s] || 0.35), 0) / syms.length : 0.3;
  const stateConfidence = Math.round(Math.min(0.95, avgSpec + (activeOrganSystems.length > 0 ? 0.15 : 0) + (physiologicalStates.length > 0 ? 0.1 : 0)) * 100) / 100;

  hypotheses.sort((a, b) => b.confidence - a.confidence);

  return { organ_systems: activeOrganSystems, organ_system_weights: systemScores, physiological_states: physiologicalStates, hypotheses, dangerous_conditions: dangerousConditions, risk_level: riskLevel, state_confidence: stateConfidence, reasoning_traces: traces, latency_ms: Date.now() - start };
}

// ── Wave 1: Graph Retrieval (with localisation-aware candidate expansion) ──
async function queryGraph(supabase: any, symptoms: string[], worldModel: WorldModelState, localisation: LocalisationResult, systemTags: any[]) {
  const start = Date.now();
  try {
    const { data: symptomRows } = await supabase.from("symptoms").select("id, symptom_name").or(symptoms.map(s => `symptom_name.ilike.%${s}%`).join(","));
    const symptomIds = (symptomRows || []).map((s: any) => s.id);
    const matchedSymptoms = (symptomRows || []).map((s: any) => s.symptom_name);
    if (symptomIds.length === 0) return { diagnoses: [], suggested_labs: [], suggested_drugs: [], physiology_states: [], matched_symptoms: matchedSymptoms, guidelines: [], latency_ms: Date.now() - start };

    const [lkRes, sdmRes] = await Promise.all([
      supabase.from("symptom_likelihoods").select("diagnosis_id, symptom_id, likelihood_value").in("symptom_id", symptomIds),
      supabase.from("symptom_diagnosis_map").select("diagnosis_id").in("symptom_id", symptomIds),
    ]);
    const diagnosisIdSet = new Set<string>();
    const scoreMap: Record<string, number> = {};
    for (const lk of (lkRes.data || [])) { diagnosisIdSet.add(lk.diagnosis_id); scoreMap[lk.diagnosis_id] = (scoreMap[lk.diagnosis_id] || 0) + (lk.likelihood_value || 0.5); }
    for (const sdm of (sdmRes.data || [])) { diagnosisIdSet.add(sdm.diagnosis_id); if (!scoreMap[sdm.diagnosis_id]) scoreMap[sdm.diagnosis_id] = 0.3; }

    // ── LOCALISATION-AWARE CANDIDATE EXPANSION ──
    // If we have dominant systems with high confidence, inject diagnoses tagged with those systems
    // that might not have been found via symptom-likelihood edges alone
    if (localisation.dominant_systems.length > 0 && localisation.localisation_confidence > 0.4) {
      for (const sys of localisation.dominant_systems) {
        const sysProbability = localisation.system_distribution[sys] || 0;
        // Only expand for systems with significant probability
        if (sysProbability < 0.3) continue;
        
        const taggedDiagnoses = systemTags.filter((t: any) => t.system_tag === sys);
        for (const tag of taggedDiagnoses) {
          if (!diagnosisIdSet.has(tag.diagnosis_id)) {
            diagnosisIdSet.add(tag.diagnosis_id);
            // Score proportional to system probability × tag confidence, but lower than symptom-matched
            scoreMap[tag.diagnosis_id] = sysProbability * (tag.confidence || 0.5) * 0.3;
          }
        }
      }
    }

    const diagnosisIds = [...diagnosisIdSet];

    let diagnoses: any[] = [];
    if (diagnosisIds.length > 0) {
      const { data: dxRows } = await supabase.from("diagnoses").select("id, diagnosis_name, icd10_code, category").in("id", diagnosisIds.slice(0, 50)).eq("is_active", true);
      const dominantSystem = worldModel.organ_systems[0] || "";
      
      // Build a set of system-boosted diagnosis IDs for localisation boost
      const locBoostSet = new Set<string>();
      if (localisation.dominant_systems.length > 0) {
        for (const tag of systemTags) {
          if (localisation.dominant_systems.includes(tag.system_tag)) {
            locBoostSet.add(tag.diagnosis_id);
          }
        }
      }

      diagnoses = (dxRows || []).map((d: any) => {
        let score = scoreMap[d.id] || 0.1;
        if (dominantSystem && d.category?.toLowerCase().includes(dominantSystem.toLowerCase())) score *= 1.3;
        // Localisation boost: diagnoses matching dominant anatomical systems
        if (locBoostSet.has(d.id)) {
          const boostFactor = 1.0 + (localisation.localisation_confidence * 0.5);
          score *= boostFactor;
        }
        const wmH = worldModel.hypotheses.find(h => normalize(h.disease) === normalize(d.diagnosis_name));
        if (wmH) score *= (1.0 + wmH.confidence);
        return { ...d, score };
      }).sort((a: any, b: any) => b.score - a.score);
    }

    const topDxIds = diagnoses.slice(0, 5).map((d: any) => d.id);
    const topDxNames = diagnoses.slice(0, 5).map((d: any) => d.diagnosis_name);

    const [labResult, drugResult, physResult, guidelineResult] = await Promise.all([
      topDxIds.length > 0
        ? supabase.from("diagnosis_lab_map").select("lab_test_id, priority").in("diagnosis_id", topDxIds)
            .then(async (r: any) => { const labIds = [...new Set((r.data || []).map((x: any) => x.lab_test_id))]; if (labIds.length === 0) return []; const { data } = await supabase.from("lab_tests").select("id, test_name, category").in("id", labIds.slice(0, 10)); return data || []; })
        : Promise.resolve([]),
      topDxIds.length > 0
        ? supabase.from("diagnosis_drug_map").select("generic_name, line_of_treatment").in("diagnosis_id", topDxIds).then((r: any) => (r.data || []).map((x: any) => ({ generic_name: x.generic_name, line: x.line_of_treatment })))
        : Promise.resolve([]),
      symptomIds.length > 0
        ? supabase.from("symptom_physiology_map").select("physiology_process, organ_system").in("symptom_id", symptomIds).then((r: any) => r.data || [])
        : Promise.resolve([]),
      topDxIds.length > 0
        ? (async () => {
            const [grRes, cgRes] = await Promise.all([
              supabase.from("guideline_registry").select("id, organization, title, condition, recommendation_text, applicable_drugs, applicable_tests").or(topDxNames.map((n: string) => `condition.ilike.%${n}%`).join(",")).limit(5),
              supabase.from("clinical_guidelines").select("id, source_organization, title, condition, recommendation_text").or(topDxNames.map((n: string) => `condition.ilike.%${n}%`).join(",")).limit(5),
            ]);
            return [...(grRes.data || []), ...(cgRes.data || [])];
          })()
        : Promise.resolve([]),
    ]);

    return { diagnoses, suggested_labs: labResult, suggested_drugs: drugResult, physiology_states: physResult, matched_symptoms: matchedSymptoms, guidelines: guidelineResult, latency_ms: Date.now() - start };
  } catch (e) {
    console.error("[Graph] Error:", e);
    return { diagnoses: [], suggested_labs: [], suggested_drugs: [], physiology_states: [], matched_symptoms: [], guidelines: [], latency_ms: Date.now() - start, error: String(e) };
  }
}

// ── Wave 2: DDX Engine ──
async function runDDX(supabase: any, graphResult: any, scenario: any, worldModel: WorldModelState) {
  const start = Date.now();
  try {
    const diagnoses = (graphResult.diagnoses || []).slice(0, 10);
    if (diagnoses.length === 0) return { differential_diagnoses: [], suggested_medications: [], recommended_labs: [], dominant_organ_system: "", latency_ms: Date.now() - start };
    const dominantSystem = worldModel.organ_systems[0] || "";
    const dxIds = diagnoses.map((d: any) => d.id);
    const { data: dangerousRows } = await supabase.from("dangerous_diagnoses").select("diagnosis_id, severity_level, must_not_miss").in("diagnosis_id", dxIds);
    const dangerousSet = new Set((dangerousRows || []).map((d: any) => d.diagnosis_id));
    const wmDangerousNames = new Set(worldModel.dangerous_conditions.map(normalize));

    const ranked = diagnoses.map((d: any, idx: number) => {
      let prob = Math.max(5, 95 - idx * 12) * (d.score || 0.5);
      if (dominantSystem && d.category?.toLowerCase().includes(dominantSystem)) prob *= 1.3;
      const isDangerous = dangerousSet.has(d.id) || wmDangerousNames.has(normalize(d.diagnosis_name));
      if (isDangerous) prob = Math.max(prob, 15);
      return { diagnosis_id: d.id, diagnosis_name: d.diagnosis_name, icd10_code: d.icd10_code || "", probability: Math.min(95, Math.round(prob)), category: d.category || "", is_dangerous: isDangerous };
    }).sort((a: any, b: any) => b.probability - a.probability);

    return { differential_diagnoses: ranked, suggested_medications: graphResult.suggested_drugs || [], recommended_labs: graphResult.suggested_labs || [], dominant_organ_system: dominantSystem, latency_ms: Date.now() - start };
  } catch (e) {
    console.error("[DDX] Error:", e);
    return { differential_diagnoses: [], suggested_medications: [], recommended_labs: [], latency_ms: Date.now() - start, error: String(e) };
  }
}

// ── Duration & Onset classifiers ──
function classifyDuration(text: string | null): string | null {
  if (!text) return null;
  const d = text.toLowerCase();
  if (["acute", "subacute", "chronic"].includes(d)) return d;
  const hourMatch = d.match(/(\d+)\s*h(our)?s?/);
  const dayMatch = d.match(/(\d+)\s*d(ay)?s?/);
  const weekMatch = d.match(/(\d+)\s*w(eek)?s?/);
  const monthMatch = d.match(/(\d+)\s*m(onth)?s?/);
  const yearMatch = d.match(/(\d+)\s*y(ear)?s?/);
  let totalDays = 0;
  if (hourMatch) totalDays = parseInt(hourMatch[1]) / 24;
  else if (dayMatch) totalDays = parseInt(dayMatch[1]);
  else if (weekMatch) totalDays = parseInt(weekMatch[1]) * 7;
  else if (monthMatch) totalDays = parseInt(monthMatch[1]) * 30;
  else if (yearMatch) totalDays = parseInt(yearMatch[1]) * 365;
  if (d.includes("sudden") || d.includes("minutes") || d.includes("hour")) return "acute";
  if (d.includes("today") || d.includes("yesterday") || d.includes("since morning")) return "acute";
  if (d.includes("few days") || d.includes("couple of days")) return "acute";
  if (d.includes("weeks") || d.includes("fortnight")) return "subacute";
  if (d.includes("months") || d.includes("years") || d.includes("long time") || d.includes("chronic")) return "chronic";
  if (totalDays > 0) { if (totalDays <= 7) return "acute"; if (totalDays <= 30) return "subacute"; return "chronic"; }
  return null;
}

function classifyOnset(text: string | null): string | null {
  if (!text) return null;
  const o = text.toLowerCase();
  if (["sudden", "gradual", "progressive", "intermittent", "episodic"].includes(o)) return o;
  if (o.includes("sudden") || o.includes("abrupt") || o.includes("all at once") || o.includes("acute")) return "sudden";
  if (o.includes("gradual") || o.includes("slowly") || o.includes("over time") || o.includes("insidious")) return "gradual";
  if (o.includes("progressive") || o.includes("getting worse") || o.includes("worsening")) return "progressive";
  if (o.includes("comes and goes") || o.includes("intermittent") || o.includes("on and off")) return "intermittent";
  if (o.includes("episodic") || o.includes("attacks") || o.includes("episodes") || o.includes("cyclical")) return "episodic";
  return null;
}

function getVitalValue(vitals: Record<string, any>, parameter: string): number | null {
  const val = vitals[parameter];
  if (val === null || val === undefined) return null;
  const num = Number(val);
  if (isNaN(num)) return null;
  if (parameter === "temperature") return num > 50 ? (num - 32) * 5 / 9 : num;
  return num;
}

// ── Pre-loaded signal data interface ──
interface PreloadedSignals {
  allPriors: any[];
  allRiskMods: any[];
  allHistoryMods: any[];
  allDurationMods: any[];
  allOnsetMods: any[];
  allVitalMods: any[];
  allClusterMods: any[];
  allLocalisationEdges: any[];
  allSystemTags: any[];
  allSyndromeSymptomEdges: any[];
  allSyndromeDiseaseEdges: any[];
  allSyndromeNodes: any[];
}

// ── Syndrome Cluster Detection Engine ──
interface SyndromeClusterResult {
  activated_clusters: Array<{
    cluster_id: string;
    cluster_name: string;
    score: number;
    matched_symptoms: number;
    total_symptoms: number;
    associated_diseases: Array<{ disease_id: string; strength: number }>;
  }>;
  boosted_disease_ids: Set<string>;
  cluster_confidence: number;
}

function detectSyndromeClusters(
  matchedSymptomIds: string[],
  syndromeNodes: any[],
  syndromeSymptomEdges: any[],
  syndromeDiseaseEdges: any[],
): SyndromeClusterResult {
  const symIdSet = new Set(matchedSymptomIds);
  const activatedClusters: SyndromeClusterResult["activated_clusters"] = [];
  const boostedDiseaseIds = new Set<string>();

  for (const node of syndromeNodes) {
    const clusterEdges = syndromeSymptomEdges.filter((e: any) => e.cluster_id === node.cluster_id);
    if (clusterEdges.length === 0) continue;

    let weightedScore = 0;
    let matchedCount = 0;
    for (const edge of clusterEdges) {
      if (symIdSet.has(edge.symptom_id)) {
        weightedScore += parseFloat(edge.likelihood_weight) || 0.5;
        matchedCount++;
      }
    }

    // Normalize: score = weighted matches / total possible weight
    const maxWeight = clusterEdges.reduce((s: number, e: any) => s + (parseFloat(e.likelihood_weight) || 0.5), 0);
    const normalizedScore = maxWeight > 0 ? weightedScore / maxWeight : 0;
    const minActivation = parseFloat(node.min_activation_score) || 0.5;

    if (normalizedScore >= minActivation && matchedCount >= 2) {
      const diseaseEdges = syndromeDiseaseEdges.filter((e: any) => e.cluster_id === node.cluster_id);
      const associatedDiseases = diseaseEdges.map((e: any) => ({
        disease_id: e.disease_id,
        strength: parseFloat(e.association_strength) || 0.5,
      }));

      for (const d of associatedDiseases) {
        boostedDiseaseIds.add(d.disease_id);
      }

      activatedClusters.push({
        cluster_id: node.cluster_id,
        cluster_name: node.cluster_name,
        score: Math.round(normalizedScore * 100) / 100,
        matched_symptoms: matchedCount,
        total_symptoms: clusterEdges.length,
        associated_diseases: associatedDiseases,
      });
    }
  }

  // Sort by score descending
  activatedClusters.sort((a, b) => b.score - a.score);

  // Confidence: how strongly the top cluster activates
  const clusterConfidence = activatedClusters.length > 0
    ? Math.round(Math.min(0.95, activatedClusters[0].score + (activatedClusters.length > 1 ? 0.05 : 0)) * 100) / 100
    : 0;

  return { activated_clusters: activatedClusters, boosted_disease_ids: boostedDiseaseIds, cluster_confidence: clusterConfidence };
}

// ── Category-to-system mapping for matching diagnosis categories to anatomical systems ──
const CATEGORY_SYSTEM_MAP: Record<string, string[]> = {
  cardiovascular: ["cardiovascular"],
  respiratory: ["respiratory"],
  neurological: ["neurological"],
  gastrointestinal: ["gastrointestinal"],
  renal: ["renal"],
  endocrine: ["endocrine"],
  dermatological: ["dermatologic"],
  musculoskeletal: ["musculoskeletal"],
  hematological: ["hematologic"],
  infectious: ["infectious"],
  immunological: ["immune"],
  ophthalmological: ["ophthalmologic"],
  pediatric: ["respiratory", "neurological", "infectious", "gastrointestinal"], // pediatric maps to multiple
  psychiatric: ["neurological"],
};

// ── Anatomical Localisation Engine ──
interface LocalisationResult {
  system_distribution: Record<string, number>;
  dominant_systems: string[];
  localisation_confidence: number;
}

function computeLocalisation(
  symptomNames: string[],
  matchedSymptomIds: string[],
  locEdges: any[],
): LocalisationResult {
  const systemScores: Record<string, number> = {};
  let totalWeight = 0;

  // Map symptom IDs to their localisation edges
  const idSet = new Set(matchedSymptomIds);
  for (const edge of locEdges) {
    if (idSet.has(edge.symptom_id)) {
      const w = parseFloat(edge.localisation_weight) || 0.5;
      systemScores[edge.anatomical_system] = (systemScores[edge.anatomical_system] || 0) + w;
      totalWeight += w;
    }
  }

  // Normalize to probability distribution
  const distribution: Record<string, number> = {};
  if (totalWeight > 0) {
    for (const [sys, score] of Object.entries(systemScores)) {
      distribution[sys] = Math.round((score / totalWeight) * 1000) / 1000;
    }
  }

  // Sort by weight descending
  const sorted = Object.entries(distribution).sort(([, a], [, b]) => b - a);

  // Dominant systems: top systems that together account for ≥70% of distribution
  const dominantSystems: string[] = [];
  let cumulative = 0;
  for (const [sys, prob] of sorted) {
    dominantSystems.push(sys);
    cumulative += prob;
    if (cumulative >= 0.70) break;
  }

  // Localisation confidence: how concentrated the distribution is (higher = more focused)
  const maxProb = sorted.length > 0 ? sorted[0][1] : 0;
  const confidence = Math.round(Math.min(0.95, maxProb + (dominantSystems.length <= 2 ? 0.1 : 0)) * 100) / 100;

  return { system_distribution: distribution, dominant_systems: dominantSystems, localisation_confidence: confidence };
}

function diagnosisCategoryMatchesSystems(category: string, systems: string[]): boolean {
  const cat = category?.toLowerCase() || "";
  for (const sys of systems) {
    // Direct match
    if (cat.includes(sys)) return true;
    // Check mapped systems
    for (const [catKey, mappedSystems] of Object.entries(CATEGORY_SYSTEM_MAP)) {
      if (cat.includes(catKey) && mappedSystems.includes(sys)) return true;
    }
  }
  return false;
}

// ── Wave 3: Bayesian Engine (Full Signal Integration) ──
async function runBayesian(supabase: any, ddxResult: any, scenario: any, specificityMap: Record<string, number>, worldModel: WorldModelState, preloaded: PreloadedSignals, localisation: LocalisationResult) {
  const start = Date.now();
  try {
    const candidates = (ddxResult.differential_diagnoses || []).slice(0, 10);
    if (candidates.length === 0) return { diagnoses: [], signal_strength: 0, latency_ms: Date.now() - start };
    const dxIds = new Set(candidates.map((c: any) => c.diagnosis_id).filter(Boolean));
    const dxIdsArr = [...dxIds];
    const symptomNames = (scenario.symptoms || []).map((s: string) => s.toLowerCase().trim());
    const historyItems = (scenario.history || []).map((h: string) => h.toLowerCase().trim());
    const vitals = scenario.vitals || {};

    // Classify duration & onset from chief complaint
    const durationCategory = classifyDuration(scenario.chief_complaint);
    const onsetCategory = classifyOnset(scenario.chief_complaint);

    // ── Only symptom resolution + likelihoods need per-scenario queries ──
    const symptomRes = await supabase.from("symptoms").select("id, symptom_name").or(symptomNames.map((s: string) => `symptom_name.ilike.%${s}%`).join(","));

    // ── Build lookup maps from pre-loaded data (in-memory filter) ──
    const priorMap: Record<string, any> = {};
    for (const p of preloaded.allPriors) { if (dxIds.has(p.diagnosis_id)) priorMap[p.diagnosis_id] = p; }

    const symptomIds = (symptomRes.data || []).map((s: any) => s.id);
    const symptomNameById: Record<string, string> = {};
    for (const s of (symptomRes.data || [])) symptomNameById[s.id] = s.symptom_name;
    const matchedSymptomNames = (symptomRes.data || []).map((s: any) => s.symptom_name.toLowerCase());

    // Symptom likelihoods (only query that must be per-scenario due to symptom specificity)
    let likelihoodMap: Record<string, Record<string, { lk: number; spec: number }>> = {};
    if (symptomIds.length > 0 && dxIdsArr.length > 0) {
      const { data: lkRows } = await supabase.from("symptom_likelihoods").select("diagnosis_id, symptom_id, likelihood_value, symptom_specificity").in("diagnosis_id", dxIdsArr).in("symptom_id", symptomIds);
      for (const lk of (lkRows || [])) {
        if (!likelihoodMap[lk.diagnosis_id]) likelihoodMap[lk.diagnosis_id] = {};
        likelihoodMap[lk.diagnosis_id][lk.symptom_id] = { lk: lk.likelihood_value, spec: lk.symptom_specificity ?? 0.5 };
      }
    }

    // Risk factor modifiers (in-memory filter)
    const riskModMap: Record<string, number[]> = {};
    for (const rm of preloaded.allRiskMods) {
      if (dxIds.has(rm.diagnosis_id) && historyItems.includes(rm.risk_factor)) {
        if (!riskModMap[rm.diagnosis_id]) riskModMap[rm.diagnosis_id] = [];
        riskModMap[rm.diagnosis_id].push(rm.modifier_weight);
      }
    }

    // Medical history modifiers (in-memory filter)
    const historyMultMap: Record<string, number> = {};
    for (const hm of preloaded.allHistoryMods) {
      if (dxIds.has(hm.diagnosis_id) && historyItems.includes(hm.history_condition)) {
        const current = historyMultMap[hm.diagnosis_id] || 1.0;
        historyMultMap[hm.diagnosis_id] = Math.max(current, hm.prior_multiplier * hm.confidence);
      }
    }

    // Duration modifiers (in-memory filter)
    const durationModMap: Record<string, number> = {};
    if (durationCategory) {
      for (const dm of preloaded.allDurationMods) {
        if (dxIds.has(dm.diagnosis_id) && dm.duration_category === durationCategory) durationModMap[dm.diagnosis_id] = dm.modifier_weight;
      }
    }

    // Onset modifiers (in-memory filter)
    const onsetModMap: Record<string, number> = {};
    if (onsetCategory) {
      for (const om of preloaded.allOnsetMods) {
        if (dxIds.has(om.diagnosis_id) && om.onset_pattern === onsetCategory) onsetModMap[om.diagnosis_id] = om.modifier_weight;
      }
    }

    // Vital sign modifiers (in-memory filter)
    const vitalModMap: Record<string, number[]> = {};
    for (const vm of preloaded.allVitalMods) {
      if (!dxIds.has(vm.diagnosis_id)) continue;
      const vitalValue = getVitalValue(vitals, vm.vital_parameter);
      if (vitalValue === null) continue;
      const applies = vm.condition === "above" ? vitalValue > vm.threshold_value : vitalValue < vm.threshold_value;
      if (applies) {
        if (!vitalModMap[vm.diagnosis_id]) vitalModMap[vm.diagnosis_id] = [];
        vitalModMap[vm.diagnosis_id].push(vm.modifier_weight);
      }
    }

    // Symptom cluster modifiers (in-memory filter)
    const clusterModMap: Record<string, number> = {};
    for (const cm of preloaded.allClusterMods) {
      if (!dxIds.has(cm.diagnosis_id)) continue;
      const matchCount = (cm.required_symptoms as string[]).filter((rs: string) =>
        matchedSymptomNames.some((ns: string) => ns === rs || ns.includes(rs) || rs.includes(ns))
      ).length;
      if (matchCount >= cm.min_match_count) {
        const current = clusterModMap[cm.diagnosis_id] || 1.0;
        clusterModMap[cm.diagnosis_id] = Math.max(current, cm.modifier_weight);
      }
    }

    // ── Compute posteriors ──
    const totalSymptoms = symptomIds.length;
    let totalSignalStrength = 0;

    const posteriors = candidates.map((c: any) => {
      const pd = priorMap[c.diagnosis_id];
      let prior = pd?.base_prevalence || 0.01;

      // Demographic modifiers on prior
      if (pd) {
        const sexKey = "male"; // Default for benchmark
        const sexMod = pd.sex_modifier?.[sexKey] ?? 1.0;
        const regMod = pd.region_modifier?.["south_asia"] ?? 1.0;
        prior *= sexMod * regMod;
      }

      // Medical history → prior multiplier
      const histMult = historyMultMap[c.diagnosis_id] || 1.0;
      const adjustedPrior = Math.min(prior * histMult, 0.95);

      let logPosterior = Math.log(Math.max(adjustedPrior, 1e-8));

      // Specificity-weighted symptom log-likelihoods
      const symLiks = likelihoodMap[c.diagnosis_id] || {};
      const symEntries = Object.entries(symLiks);
      let symptomSignal = 0;
      let coverageRatio = 0;

      if (symEntries.length > 0) {
        for (const [, sl] of symEntries) {
          const lik = Math.max(0.01, Math.min(0.99, sl.lk));
          const w = Math.max(0.1, sl.spec);
          logPosterior += w * Math.log(lik);
          symptomSignal += sl.spec;
        }
        coverageRatio = totalSymptoms > 0 ? symEntries.length / totalSymptoms : 0;
        const coverageBonus = Math.pow(coverageRatio, 1.5);
        logPosterior += Math.log(Math.max(coverageBonus, 1e-4));
      } else if (totalSymptoms > 0) {
        logPosterior += Math.min(totalSymptoms, 3) * Math.log(0.15);
      }

      // Duration modifier
      const durMod = durationModMap[c.diagnosis_id] || 1.0;
      if (durMod !== 1.0) logPosterior += Math.log(durMod);

      // Onset modifier
      const onMod = onsetModMap[c.diagnosis_id] || 1.0;
      if (onMod !== 1.0) logPosterior += Math.log(onMod);

      // Vital sign modifier (use strongest)
      const vMods = vitalModMap[c.diagnosis_id] || [];
      let vitalMod = 1.0;
      if (vMods.length > 0) {
        vitalMod = Math.max(...vMods);
        logPosterior += Math.log(vitalMod);
      }

      // Symptom cluster modifier
      const clusterMod = clusterModMap[c.diagnosis_id] || 1.0;
      if (clusterMod > 1.0) logPosterior += Math.log(clusterMod);

      // Risk factor modifiers
      const rMods = riskModMap[c.diagnosis_id] || [];
      let riskMod = 1.0;
      for (const w of rMods) {
        riskMod *= w;
        logPosterior += Math.log(Math.max(w, 1e-4));
      }

      // Anatomical localisation modifier (replaces simple world model boost)
      let localisationMod = 1.0;
      const category = (c.category || "").toLowerCase();
      if (localisation.dominant_systems.length > 0 && localisation.localisation_confidence > 0.3) {
        const matchesDominant = diagnosisCategoryMatchesSystems(category, localisation.dominant_systems);
        if (matchesDominant) {
          // Boost: proportional to how concentrated the distribution is on this system
          const systemProb = localisation.dominant_systems.reduce((max, sys) => {
            if (diagnosisCategoryMatchesSystems(category, [sys])) {
              return Math.max(max, localisation.system_distribution[sys] || 0);
            }
            return max;
          }, 0);
          localisationMod = 1.0 + (systemProb * localisation.localisation_confidence * 1.5);
          logPosterior += Math.log(localisationMod);
        } else if (localisation.localisation_confidence > 0.5) {
          // Mild penalty for off-system diagnoses (not too aggressive)
          localisationMod = 0.7;
          logPosterior += Math.log(localisationMod);
        }
      }

      // World model organ system boost (mild, complementary to localisation)
      const dominantSystem = worldModel.organ_systems[0] || "";
      if (dominantSystem && category.includes(dominantSystem.toLowerCase()) && localisationMod === 1.0) {
        const systemWeight = Math.min(1.3, 1.0 + ((worldModel.organ_system_weights[dominantSystem] || 1.0) - 1.0) * 0.15);
        logPosterior += Math.log(systemWeight);
      }

      totalSignalStrength += symptomSignal;

      return {
        diagnosis_id: c.diagnosis_id,
        diagnosis_name: c.diagnosis_name,
        prior: adjustedPrior,
        history_multiplier: histMult,
        risk_modifier: riskMod,
        duration_modifier: durMod,
        onset_modifier: onMod,
        vital_modifier: vitalMod,
        cluster_modifier: clusterMod,
        localisation_modifier: localisationMod,
        coverage_ratio: coverageRatio,
        log_score: logPosterior,
        posterior: Math.exp(logPosterior),
        posterior_probability: 0,
        is_dangerous: c.is_dangerous || false,
      };
    });

    // Softmax normalization
    const maxLog = Math.max(...posteriors.map(p => p.log_score));
    const expScores = posteriors.map(p => Math.exp(p.log_score - maxLog));
    const sumExp = expScores.reduce((s, e) => s + e, 0) || 1;
    for (let i = 0; i < posteriors.length; i++) {
      posteriors[i].posterior_probability = parseFloat((expScores[i] / sumExp * 100).toFixed(2));
    }

    // Must-not-miss floor
    for (const p of posteriors) {
      if (p.is_dangerous && p.posterior_probability < 3) p.posterior_probability = 3;
    }
    const newTotal = posteriors.reduce((s, p) => s + p.posterior_probability, 0) || 1;
    for (const p of posteriors) {
      p.posterior_probability = parseFloat((p.posterior_probability / newTotal * 100).toFixed(2));
    }

    posteriors.sort((a, b) => b.posterior_probability - a.posterior_probability);

    const avgSignal = symptomIds.length > 0 ? totalSignalStrength / (symptomIds.length * candidates.length) : 0;
    return {
      diagnoses: posteriors,
      signal_strength: Math.round(avgSignal * 100) / 100,
      signals_applied: {
        risk_factors: Object.keys(riskModMap).length,
        history_modifiers: Object.keys(historyMultMap).length,
        duration: durationCategory,
        onset: onsetCategory,
        vital_modifiers: Object.keys(vitalModMap).length,
        cluster_modifiers: Object.keys(clusterModMap).length,
        localisation: { dominant_systems: localisation.dominant_systems, confidence: localisation.localisation_confidence },
      },
      latency_ms: Date.now() - start,
    };
  } catch (e) {
    console.error("[Bayesian] Error:", e);
    return { diagnoses: [], signal_strength: 0, latency_ms: Date.now() - start, error: String(e) };
  }
}

// ── Wave 4: Safety Engine ──
async function runSafety(supabase: any, scenario: any, ddxResult: any, worldModel: WorldModelState) {
  const start = Date.now();
  try {
    const allMeds = [...new Set([...scenario.medications, ...(ddxResult.suggested_medications || []).map((m: any) => m.generic_name).filter(Boolean)])];
    let interactionFlags: any[] = [];
    if (allMeds.length >= 2) {
      const { data: interactions } = await supabase.from("drug_interactions").select("drug_a, drug_b, severity, interaction_description, recommended_action").or(allMeds.map(m => `drug_a.ilike.%${m}%,drug_b.ilike.%${m}%`).join(","));
      interactionFlags = (interactions || []).map((i: any) => ({ drugs: [i.drug_a, i.drug_b], severity: i.severity, description: i.interaction_description, action: i.recommended_action }));
    }
    let allergyFlags: any[] = [];
    if (scenario.allergies.length > 0 && allMeds.length > 0) {
      for (const allergy of scenario.allergies) {
        for (const med of allMeds) { if (normalize(allergy) === normalize(med)) allergyFlags.push({ drug: med, allergy, severity: "critical", description: `Allergic to ${allergy}` }); }
      }
    }
    const vitalsDangers: any[] = [];
    const v = scenario.vitals;
    if (v.spo2 && v.spo2 < 92) vitalsDangers.push({ parameter: "SpO2", value: v.spo2, threshold: 92, severity: "critical", message: "Hypoxemia" });
    if (v.temperature && v.temperature >= 39.5) vitalsDangers.push({ parameter: "Temperature", value: v.temperature, threshold: 39.5, severity: "warning", message: "High fever" });
    if (v.pulse && v.pulse >= 120) vitalsDangers.push({ parameter: "HR", value: v.pulse, threshold: 120, severity: "warning", message: "Tachycardia" });
    if (v.bp_systolic && v.bp_systolic >= 180) vitalsDangers.push({ parameter: "SBP", value: v.bp_systolic, threshold: 180, severity: "critical", message: "Hypertensive crisis" });
    if (v.bp_systolic && v.bp_systolic < 90) vitalsDangers.push({ parameter: "SBP", value: v.bp_systolic, threshold: 90, severity: "critical", message: "Hypotension" });
    if (v.respiratory_rate && v.respiratory_rate >= 28) vitalsDangers.push({ parameter: "RR", value: v.respiratory_rate, threshold: 28, severity: "warning", message: "Tachypnea" });

    const emergencyPatterns: any[] = [];
    for (const dc of worldModel.dangerous_conditions) { emergencyPatterns.push({ diagnosis: dc, probability: 0, message: `Must-not-miss: ${dc}`, source: "world_model" }); }
    for (const dd of (ddxResult.differential_diagnoses || []).filter((d: any) => d.is_dangerous)) {
      if (!emergencyPatterns.find(e => normalize(e.diagnosis) === normalize(dd.diagnosis_name))) emergencyPatterns.push({ diagnosis: dd.diagnosis_name, probability: dd.probability, message: `Must-not-miss: ${dd.diagnosis_name}` });
    }

    return { interaction_flags: interactionFlags, allergy_flags: allergyFlags, vitals_dangers: vitalsDangers, emergency_patterns: emergencyPatterns,
      safety_score: Math.max(0, 100 - interactionFlags.length * 15 - allergyFlags.length * 25 - vitalsDangers.length * 10 - emergencyPatterns.length * 5),
      world_model_risk_level: worldModel.risk_level, latency_ms: Date.now() - start };
  } catch (e) {
    console.error("[Safety] Error:", e);
    return { interaction_flags: [], allergy_flags: [], vitals_dangers: [], emergency_patterns: [], safety_score: 50, world_model_risk_level: "unknown", latency_ms: Date.now() - start, error: String(e) };
  }
}

// ── Wave 5: SOAP Builder ──
function buildSOAP(scenario: any, ddxResult: any, bayesianResult: any, safetyResult: any, worldModel: WorldModelState) {
  const start = Date.now();
  const subjParts = [`Chief complaint: ${scenario.chief_complaint}.`];
  if (scenario.symptoms.length > 0) subjParts.push(`Symptoms: ${scenario.symptoms.join(", ")}.`);
  if (scenario.history.length > 0) subjParts.push(`PMH: ${scenario.history.join(", ")}.`);
  if (scenario.medications.length > 0) subjParts.push(`Medications: ${scenario.medications.join(", ")}.`);
  if (scenario.allergies.length > 0) subjParts.push(`Allergies: ${scenario.allergies.join(", ")}.`);

  const objParts: string[] = [];
  const v = scenario.vitals;
  const vs: string[] = [];
  if (v.bp_systolic && v.bp_diastolic) vs.push(`BP: ${v.bp_systolic}/${v.bp_diastolic}`);
  if (v.pulse) vs.push(`HR: ${v.pulse}`);
  if (v.temperature) vs.push(`T: ${v.temperature}°C`);
  if (v.spo2) vs.push(`SpO2: ${v.spo2}%`);
  if (v.respiratory_rate) vs.push(`RR: ${v.respiratory_rate}`);
  if (vs.length > 0) objParts.push(`Vitals: ${vs.join(", ")}.`);
  if (worldModel.physiological_states.length > 0) objParts.push(`Physiology: ${worldModel.physiological_states.map(p => `${p.process} (${Math.round(p.confidence * 100)}%)`).join(", ")}.`);

  const assessParts: string[] = [];
  if (worldModel.organ_systems.length > 0) assessParts.push(`Active systems: ${worldModel.organ_systems.join(", ")}.`);
  const topDx = (ddxResult.differential_diagnoses || []).slice(0, 5);
  if (topDx.length > 0) assessParts.push(`DDX:\n${topDx.map((d: any, i: number) => `${i + 1}. ${d.diagnosis_name} (${d.probability}%)`).join("\n")}`);
  const bayesTop = (bayesianResult.diagnoses || [])[0];
  if (bayesTop) assessParts.push(`Bayesian: ${bayesTop.diagnosis_name} (${bayesTop.posterior_probability}%).`);
  if ((safetyResult.emergency_patterns || []).length > 0) assessParts.push(`⚠️ ${safetyResult.emergency_patterns.map((e: any) => e.message).join("; ")}`);
  assessParts.push(`Risk: ${worldModel.risk_level.toUpperCase()}.`);

  const planParts: string[] = [];
  const recLabs = (ddxResult.recommended_labs || []).slice(0, 5);
  if (recLabs.length > 0) planParts.push(`Tests: ${recLabs.map((l: any) => l.test_name).join(", ")}.`);
  const recMeds = (ddxResult.suggested_medications || []).slice(0, 5);
  if (recMeds.length > 0) planParts.push(`Medications: ${recMeds.map((m: any) => m.generic_name).join(", ")}.`);

  return { sections: { subjective: subjParts.join(" "), objective: objParts.join(" ") || "No objective data.", assessment: assessParts.join("\n") || "Insufficient data.", plan: planParts.join("\n") || "Further evaluation." }, soap_valid: true, latency_ms: Date.now() - start };
}

// ════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const totalStart = Date.now();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const validationRunId = crypto.randomUUID();

    // Load lookup tables + ALL signal modifier tables in parallel (once)
    const [specRes, organRes, activationRes, physMapRes, physDiagRes,
           priorsRes, riskModsRes, histModsRes, durModsRes, onsetModsRes, vitalModsRes, clusterModsRes, locEdgesRes, systemTagsRes] = await Promise.all([
      supabase.from("symptom_specificity").select("symptom_name, specificity_score, organ_system"),
      supabase.from("symptom_organ_system_map").select("symptom, organ_system, weight"),
      supabase.from("organ_system_activation_rules").select("symptom, organ_system, activation_weight"),
      supabase.from("symptom_physiology_map").select("symptoms!inner(symptom_name), physiological_states!inner(state_name, anatomical_systems:system_id(system_name)), confidence_score"),
      supabase.from("physiology_diagnosis_map").select("physiological_states!inner(state_name), diagnoses!inner(diagnosis_name), relevance_score"),
      // Signal modifier tables (pre-loaded once, filtered in-memory per scenario)
      supabase.from("disease_priors").select("diagnosis_id, base_prevalence, age_modifier, sex_modifier, region_modifier"),
      supabase.from("risk_factor_modifiers").select("diagnosis_id, risk_factor, modifier_weight"),
      supabase.from("medical_history_modifiers").select("diagnosis_id, history_condition, prior_multiplier, confidence"),
      supabase.from("duration_modifiers").select("diagnosis_id, duration_category, modifier_weight"),
      supabase.from("onset_modifiers").select("diagnosis_id, onset_pattern, modifier_weight"),
      supabase.from("vital_sign_modifiers").select("diagnosis_id, vital_parameter, condition, threshold_value, modifier_weight"),
      supabase.from("symptom_cluster_modifiers").select("diagnosis_id, cluster_name, required_symptoms, min_match_count, modifier_weight"),
      supabase.from("symptom_localisation_edges").select("symptom_id, anatomical_system, localisation_weight"),
      supabase.from("disease_system_tags").select("diagnosis_id, system_tag, confidence"),
    ]);

    const preloadedSignals: PreloadedSignals = {
      allPriors: priorsRes.data || [],
      allRiskMods: riskModsRes.data || [],
      allHistoryMods: histModsRes.data || [],
      allDurationMods: durModsRes.data || [],
      allOnsetMods: onsetModsRes.data || [],
      allVitalMods: vitalModsRes.data || [],
      allClusterMods: clusterModsRes.data || [],
      allLocalisationEdges: locEdgesRes.data || [],
      allSystemTags: systemTagsRes.data || [],
    };

    const specificityMap: Record<string, number> = {};
    for (const s of (specRes.data || [])) specificityMap[s.symptom_name.toLowerCase()] = parseFloat(s.specificity_score);

    const activationRules = (activationRes.data || []).map((r: any) => ({ symptom: r.symptom, organ_system: r.organ_system, activation_weight: parseFloat(r.activation_weight) }));
    const physiologyMap = (physMapRes.data || []).map((r: any) => ({ symptom: r.symptoms?.symptom_name || "", physiology_process: r.physiological_states?.state_name || "", organ_system: r.physiological_states?.anatomical_systems?.system_name || "" })).filter((r: any) => r.symptom && r.physiology_process);
    const physiologyDiagMap = (physDiagRes.data || []).map((r: any) => ({ physiology_process: r.physiological_states?.state_name || "", disease_name: r.diagnoses?.diagnosis_name || "", confidence_score: r.relevance_score || 0.5 })).filter((r: any) => r.physiology_process && r.disease_name);

    // ═══ STEP 1: Graph Integrity ═══
    const step1Start = Date.now();
    const tableNames = ["diagnoses", "symptoms", "symptom_diagnosis_map", "disease_priors", "symptom_likelihoods", "disease_tests", "disease_treatments", "physiological_states", "symptom_physiology_map", "physiology_diagnosis_map", "drug_master", "clinical_guidelines", "dangerous_diagnoses", "diagnosis_drug_map", "diagnosis_lab_map", "guideline_registry", "symptom_specificity", "symptom_organ_system_map", "organ_system_activation_rules"];
    const countResults = await Promise.all(tableNames.map(name => supabase.from(name).select("id", { count: "exact", head: true })));
    const tableCounts: Record<string, number> = {};
    tableNames.forEach((name, i) => { tableCounts[name] = countResults[i].count ?? 0; });

    const graphGaps: string[] = [];
    if (tableCounts.symptom_likelihoods < 2000) graphGaps.push(`symptom_likelihoods: ${tableCounts.symptom_likelihoods}/10000`);
    if (tableCounts.disease_priors < 200) graphGaps.push(`disease_priors: ${tableCounts.disease_priors}/500`);
    if (tableCounts.physiological_states < 100) graphGaps.push(`physiological_states: ${tableCounts.physiological_states}/200`);
    if (tableCounts.clinical_guidelines < 50) graphGaps.push(`clinical_guidelines: ${tableCounts.clinical_guidelines}/50`);

    // ═══ STEP 2: Run 50 Scenarios ═══
    const scenarioResults: any[] = [];
    const engineLogs: any[] = [];
    const specialtyStats: Record<string, { total: number; passed: number; danger_expected: number; danger_detected: number; latency_sum: number }> = {};

    for (const scenario of BENCHMARK_SCENARIOS) {
      const scenarioStart = Date.now();
      const waveLatency: Record<string, number> = {};

      // Wave 0: PCIE
      const w0Start = Date.now();
      const context = {
        chief_complaint: scenario.chief_complaint, symptoms: scenario.symptoms, vitals: scenario.vitals,
        medical_history: scenario.history, current_medications: scenario.medications, allergies: scenario.allergies,
        patient_age: 45, patient_sex: "male",
      };
      waveLatency.wave0_pcie_ms = Date.now() - w0Start;

      // Wave 0.5: World Model
      const worldModel = buildWorldModel(scenario.symptoms, scenario.vitals, activationRules, physiologyMap, physiologyDiagMap, specificityMap);
      waveLatency.wave05_world_model_ms = worldModel.latency_ms;

      // Wave 0.75: Anatomical Localisation (BEFORE candidate generation)
      const w075Start = Date.now();
      const locSymptomRes = await supabase.from("symptoms").select("id").or(
        scenario.symptoms.map((s: string) => `symptom_name.ilike.%${s}%`).join(",")
      );
      const locSymptomIds = (locSymptomRes.data || []).map((s: any) => s.id);
      const localisation = computeLocalisation(
        scenario.symptoms.map((s: string) => s.toLowerCase()),
        locSymptomIds,
        preloadedSignals.allLocalisationEdges,
      );
      waveLatency.wave075_localisation_ms = Date.now() - w075Start;

      // Wave 1: Graph (with localisation-aware candidate expansion)
      const graphResult = await queryGraph(supabase, scenario.symptoms, worldModel, localisation, preloadedSignals.allSystemTags);
      waveLatency.wave1_graph_ms = graphResult.latency_ms;

      // Wave 2: DDX
      const ddxResult = await runDDX(supabase, graphResult, scenario, worldModel);
      waveLatency.wave2_ddx_ms = ddxResult.latency_ms;

      // Wave 3: Bayesian (with localisation)
      const bayesianResult = await runBayesian(supabase, ddxResult, scenario, specificityMap, worldModel, preloadedSignals, localisation);
      waveLatency.wave3_bayesian_ms = bayesianResult.latency_ms;

      // Wave 4: Safety
      const safetyResult = await runSafety(supabase, scenario, ddxResult, worldModel);
      waveLatency.wave4_safety_ms = safetyResult.latency_ms;

      // Wave 5: SOAP
      const soapResult = buildSOAP(scenario, ddxResult, bayesianResult, safetyResult, worldModel);
      waveLatency.wave5_soap_ms = soapResult.latency_ms;

      const totalMs = Date.now() - scenarioStart;

      // Evaluate — Use Bayesian-ranked results as authoritative ranking source
      const bayesianDiagnoses = (bayesianResult.diagnoses || []).map((d: any) => d.diagnosis_name);
      const ddxDiagnoses = (ddxResult.differential_diagnoses || []).map((d: any) => d.diagnosis_name);
      // Primary ranking: Bayesian posteriors. Fallback: DDX if Bayesian is empty.
      const rankedDiagnoses = bayesianDiagnoses.length > 0 ? bayesianDiagnoses : ddxDiagnoses;
      const matchedDx = fuzzyMatch(rankedDiagnoses, scenario.expected_diagnoses);
      const dxMatchRate = scenario.expected_diagnoses.length > 0 ? matchedDx.length / scenario.expected_diagnoses.length : 0;

      // Top-N accuracy (Bayesian-authoritative)
      const top1Match = rankedDiagnoses.length > 0 && fuzzyMatch([rankedDiagnoses[0]], scenario.expected_diagnoses).length > 0;
      const top3Dx = rankedDiagnoses.slice(0, 3);
      const top3Match = fuzzyMatch(top3Dx, scenario.expected_diagnoses).length > 0;
      const top5Dx = rankedDiagnoses.slice(0, 5);
      const top5Match = fuzzyMatch(top5Dx, scenario.expected_diagnoses).length > 0;

      // Danger detection
      const dangerDetected = safetyResult.emergency_patterns.length > 0 || worldModel.dangerous_conditions.length > 0;

      const passed = dxMatchRate >= 0.5 || matchedDx.length >= 1;

      // Specialty tracking
      const spec = scenario.specialty;
      if (!specialtyStats[spec]) specialtyStats[spec] = { total: 0, passed: 0, danger_expected: 0, danger_detected: 0, latency_sum: 0 };
      specialtyStats[spec].total++;
      if (passed) specialtyStats[spec].passed++;
      if (scenario.danger_expected) specialtyStats[spec].danger_expected++;
      if (scenario.danger_expected && dangerDetected) specialtyStats[spec].danger_detected++;
      specialtyStats[spec].latency_sum += totalMs;

      engineLogs.push({ engine_name: "benchmark_50", validation_run_id: validationRunId, execution_time_ms: totalMs, status: passed ? "success" : "failed",
        output_summary: { scenario: scenario.id, diagnoses: rankedDiagnoses.length, matched: matchedDx.length, danger: dangerDetected, ranking_source: bayesianDiagnoses.length > 0 ? "bayesian" : "ddx" } });

      scenarioResults.push({
        id: scenario.id, name: scenario.name, specialty: scenario.specialty,
        danger_expected: scenario.danger_expected,
        passed, top1_match: top1Match, top3_match: top3Match, top5_match: top5Match,
        diagnosis_match_rate: Math.round(dxMatchRate * 100),
        matched_diagnoses: matchedDx,
        actual_top5: rankedDiagnoses.slice(0, 5),
        bayesian_top: bayesianResult.diagnoses[0]?.diagnosis_name || null,
        bayesian_top_prob: bayesianResult.diagnoses[0]?.posterior_probability || 0,
        bayesian_signals: bayesianResult.signals_applied || {},
        ranking_source: bayesianDiagnoses.length > 0 ? "bayesian" : "ddx_fallback",
        danger_detected: dangerDetected,
        danger_conditions: worldModel.dangerous_conditions,
        safety_alerts: safetyResult.emergency_patterns.length + safetyResult.vitals_dangers.length,
        graph_matched_symptoms: graphResult.matched_symptoms.length,
        graph_diagnoses_found: graphResult.diagnoses.length,
        suggested_labs: (ddxResult.recommended_labs || []).map((l: any) => l.test_name).slice(0, 5),
        suggested_drugs: (ddxResult.suggested_medications || []).map((m: any) => m.generic_name).slice(0, 5),
        world_model: { organ_systems: worldModel.organ_systems, risk_level: worldModel.risk_level, hypotheses: worldModel.hypotheses.length, physiology: worldModel.physiological_states.length, traces: worldModel.reasoning_traces.length },
        localisation: { dominant_systems: localisation.dominant_systems, confidence: localisation.localisation_confidence, distribution: localisation.system_distribution },
        wave_latency: waveLatency,
        total_latency_ms: totalMs,
        soap_valid: soapResult.soap_valid,
        failure_reasons: !passed ? [
          graphResult.diagnoses.length === 0 ? "graph_miss" : null,
          matchedDx.length === 0 ? "no_diagnosis_match" : null,
          graphResult.matched_symptoms.length < scenario.symptoms.length * 0.5 ? "symptom_coverage_gap" : null,
        ].filter(Boolean) : [],
      });
    }

    // Write engine logs
    await supabase.from("clinical_engine_logs").insert(engineLogs);

    // ═══ AGGREGATE METRICS ═══
    const total = scenarioResults.length;
    const passedCount = scenarioResults.filter(s => s.passed).length;
    const top1Count = scenarioResults.filter(s => s.top1_match).length;
    const top3Count = scenarioResults.filter(s => s.top3_match).length;
    const top5Count = scenarioResults.filter(s => s.top5_match).length;

    const dangerExpected = scenarioResults.filter(s => s.danger_expected);
    const dangerDetectedCorrectly = dangerExpected.filter(s => s.danger_detected).length;
    const dangerDetectionRate = dangerExpected.length > 0 ? Math.round((dangerDetectedCorrectly / dangerExpected.length) * 100) : 0;

    const avgLatency = Math.round(scenarioResults.reduce((a, s) => a + s.total_latency_ms, 0) / total);
    const latencies = scenarioResults.map(s => s.total_latency_ms).sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

    const waveKeys = ["wave0_pcie_ms", "wave05_world_model_ms", "wave075_localisation_ms", "wave1_graph_ms", "wave2_ddx_ms", "wave3_bayesian_ms", "wave4_safety_ms", "wave5_soap_ms"];
    const avgWaveLatency: Record<string, number> = {};
    for (const key of waveKeys) avgWaveLatency[key] = Math.round(scenarioResults.reduce((a, s) => a + (s.wave_latency[key] || 0), 0) / total);

    // Failure analysis
    const failedScenarios = scenarioResults.filter(s => !s.passed);
    const failureReasonCounts: Record<string, number> = {};
    for (const f of failedScenarios) {
      for (const r of f.failure_reasons) {
        failureReasonCounts[r] = (failureReasonCounts[r] || 0) + 1;
      }
    }

    // Graph coverage gaps from failures
    const graphMisses = failedScenarios.filter(s => s.failure_reasons.includes("graph_miss"));
    const symptomGaps = failedScenarios.filter(s => s.failure_reasons.includes("symptom_coverage_gap"));

    const report = {
      validation_id: validationRunId,
      timestamp: new Date().toISOString(),
      total_duration_ms: Date.now() - totalStart,

      graph_integrity: {
        table_counts: tableCounts,
        gaps: graphGaps,
        status: graphGaps.length === 0 ? "healthy" : graphGaps.length <= 2 ? "partial" : "degraded",
      },

      benchmark: {
        total_scenarios: total,
        passed: passedCount,
        failed: total - passedCount,
        pass_rate: Math.round((passedCount / total) * 100),

        accuracy: {
          top1: Math.round((top1Count / total) * 100),
          top3: Math.round((top3Count / total) * 100),
          top5: Math.round((top5Count / total) * 100),
          avg_diagnosis_match: Math.round(scenarioResults.reduce((a, s) => a + s.diagnosis_match_rate, 0) / total),
        },

        safety: {
          danger_scenarios: dangerExpected.length,
          danger_detected: dangerDetectedCorrectly,
          detection_rate: dangerDetectionRate,
          missed_dangers: dangerExpected.filter(s => !s.danger_detected).map(s => ({ id: s.id, name: s.name })),
        },

        latency: {
          avg_ms: avgLatency,
          p50_ms: p50,
          p95_ms: p95,
          p99_ms: p99,
          avg_wave_latency: avgWaveLatency,
          meets_5s_target: avgLatency < 5000,
        },

        by_specialty: Object.entries(specialtyStats).map(([spec, stats]) => ({
          specialty: spec,
          total: stats.total,
          passed: stats.passed,
          pass_rate: Math.round((stats.passed / stats.total) * 100),
          danger_detection_rate: stats.danger_expected > 0 ? Math.round((stats.danger_detected / stats.danger_expected) * 100) : null,
          avg_latency_ms: Math.round(stats.latency_sum / stats.total),
        })),

        scenarios: scenarioResults,
      },

      failure_analysis: {
        total_failures: failedScenarios.length,
        by_reason: failureReasonCounts,
        graph_misses: graphMisses.map(s => ({ id: s.id, name: s.name, specialty: s.specialty })),
        symptom_gaps: symptomGaps.map(s => ({ id: s.id, name: s.name, matched: s.graph_matched_symptoms })),
        by_specialty: Object.entries(specialtyStats).filter(([, s]) => s.total > s.passed).map(([spec, s]) => ({ specialty: spec, failed: s.total - s.passed })),
      },

      coverage_analysis: {
        graph_size: { diagnoses: tableCounts.diagnoses, symptoms: tableCounts.symptoms, likelihoods: tableCounts.symptom_likelihoods, physiology_states: tableCounts.physiological_states, dangerous: tableCounts.dangerous_diagnoses, guidelines: tableCounts.clinical_guidelines },
        expansion_needed: graphGaps,
      },

      recommendations: [
        ...(tableCounts.symptom_likelihoods < 5000 ? ["Expand symptom_likelihoods to 10,000+ for better Bayesian signal"] : []),
        ...(tableCounts.disease_priors < 300 ? ["Add disease priors for 500+ diseases"] : []),
        ...(failedScenarios.length > 10 ? [`${failedScenarios.length} scenarios failed — review graph coverage`] : []),
        ...(dangerDetectionRate < 90 ? [`Danger detection at ${dangerDetectionRate}% — expand dangerous_diagnoses triggers`] : []),
        ...(avgLatency > 2000 ? ["Average latency high — optimize graph queries"] : []),
      ],
    };

    return new Response(JSON.stringify(report), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("validate-clinical-system error:", err);
    return new Response(JSON.stringify({ error: err.message || "Validation failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
