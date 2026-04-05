/**
 * V3 Benchmark Suite — 50 Structured Clinical Cases
 * 15 Strong Systemic | 20 Pure Local | 15 Ambiguous/Overlap
 */
import type { V3BenchCase } from "./types";

// ═══════════════════════════════════════════════════════
// STRONG SYSTEMIC (15 cases)
// ═══════════════════════════════════════════════════════
const SYSTEMIC: V3BenchCase[] = [
  {
    id: "s01", name: "Sepsis — Full with lactate", category: "strong_systemic", expected_top1: "sepsis", hero: true,
    input: { symptoms: ["fever","chills","confusion","shortness of breath","reduced urine output"], vitals: { temperature: 39.2, heartRate: 120, blood_pressure_systolic: 90, respiratoryRate: 26, spo2: 92 }, medical_history: ["diabetes","recent urinary tract infection"], age: 58, sex: "male", duration: "2 days" },
  },
  {
    id: "s02", name: "Sepsis — No lactate, vitals only", category: "strong_systemic", expected_top1: "sepsis", hero: true,
    input: { symptoms: ["fever","chills","confusion","shortness of breath","reduced urine output"], vitals: { temperature: 39.5, heartRate: 125, blood_pressure_systolic: 85, respiratoryRate: 28, spo2: 90 }, medical_history: ["diabetes"], age: 62, sex: "male", duration: "1 day" },
  },
  {
    id: "s03", name: "Septic Shock — Extreme vitals", category: "strong_systemic", expected_top1: "sepsis",
    input: { symptoms: ["fever","confusion","cold extremities","reduced urine output","shortness of breath"], vitals: { temperature: 39.8, heartRate: 135, blood_pressure_systolic: 70, respiratoryRate: 32, spo2: 86 }, medical_history: ["diabetes","chronic kidney disease"], age: 70, sex: "male", duration: "12 hours" },
  },
  {
    id: "s04", name: "Sepsis — UTI source, elderly", category: "strong_systemic", expected_top1: "sepsis",
    input: { symptoms: ["fever","confusion","dysuria","reduced urine output","chills"], vitals: { temperature: 38.8, heartRate: 110, blood_pressure_systolic: 88, respiratoryRate: 24, spo2: 93 }, medical_history: ["recurrent UTIs","diabetes"], age: 78, sex: "female", duration: "1 day" },
  },
  {
    id: "s05", name: "Sepsis — Wound source", category: "strong_systemic", expected_top1: "sepsis",
    input: { symptoms: ["fever","wound infection","chills","confusion","shortness of breath"], vitals: { temperature: 39.0, heartRate: 118, blood_pressure_systolic: 92, respiratoryRate: 25, spo2: 93 }, medical_history: ["diabetes","peripheral vascular disease"], age: 65, sex: "male", duration: "2 days" },
  },
  {
    id: "s06", name: "Sepsis — Hypothermic elderly", category: "strong_systemic", expected_top1: "sepsis",
    input: { symptoms: ["confusion","chills","reduced urine output","weakness"], vitals: { temperature: 35.2, heartRate: 115, blood_pressure_systolic: 82, respiratoryRate: 26, spo2: 91 }, medical_history: ["diabetes","immunosuppression"], age: 80, sex: "female", duration: "1 day" },
  },
  {
    id: "s07", name: "Sepsis — Respiratory source", category: "strong_systemic", expected_top1: "sepsis",
    input: { symptoms: ["fever","cough","confusion","shortness of breath","reduced urine output","chills"], vitals: { temperature: 39.3, heartRate: 122, blood_pressure_systolic: 88, respiratoryRate: 28, spo2: 89 }, medical_history: ["COPD","diabetes"], age: 68, sex: "male", duration: "2 days" },
  },
  {
    id: "s08", name: "Multi-organ dysfunction", category: "strong_systemic", expected_top1: "sepsis",
    input: { symptoms: ["fever","confusion","reduced urine output","shortness of breath","jaundice"], vitals: { temperature: 39.5, heartRate: 130, blood_pressure_systolic: 75, respiratoryRate: 30, spo2: 87 }, medical_history: ["diabetes","chronic liver disease"], age: 60, sex: "male", duration: "1 day" },
  },
  {
    id: "s09", name: "qSOFA 3/3", category: "strong_systemic", expected_top1: "sepsis",
    input: { symptoms: ["fever","confusion","shortness of breath"], vitals: { temperature: 38.5, heartRate: 108, blood_pressure_systolic: 95, respiratoryRate: 24, spo2: 94 }, medical_history: [], age: 55, sex: "male", duration: "1 day" },
  },
  {
    id: "s10", name: "Sepsis — Abdominal source", category: "strong_systemic", expected_top1: "sepsis",
    input: { symptoms: ["fever","abdominal pain","confusion","vomiting","chills"], vitals: { temperature: 39.2, heartRate: 120, blood_pressure_systolic: 85, respiratoryRate: 26, spo2: 92 }, medical_history: ["recent abdominal surgery"], age: 55, sex: "male", duration: "1 day" },
  },
  {
    id: "s11", name: "UTI → Sepsis progression", category: "strong_systemic", expected_top1: "sepsis",
    input: { symptoms: ["fever","dysuria","confusion","chills","reduced urine output","flank pain"], vitals: { temperature: 39.4, heartRate: 118, blood_pressure_systolic: 84, respiratoryRate: 26, spo2: 91 }, medical_history: ["recurrent UTIs","diabetes","catheter"], age: 75, sex: "male", duration: "2 days" },
  },
  {
    id: "s12", name: "Pneumonia → Sepsis", category: "strong_systemic", expected_top1: "sepsis",
    input: { symptoms: ["cough","fever","shortness of breath","confusion","reduced urine output","chills"], vitals: { temperature: 39.6, heartRate: 128, blood_pressure_systolic: 80, respiratoryRate: 30, spo2: 88 }, medical_history: ["COPD","heart failure"], age: 72, sex: "male", duration: "3 days" },
  },
  {
    id: "s13", name: "Early sepsis — Subtle vitals (young)", category: "strong_systemic", expected_top1: "sepsis",
    input: { symptoms: ["fever","chills","fatigue","mild confusion","reduced urine output"], vitals: { temperature: 38.9, heartRate: 112, blood_pressure_systolic: 92, respiratoryRate: 24, spo2: 93 }, medical_history: ["diabetes"], age: 42, sex: "male", duration: "1 day" },
  },
  {
    id: "s14", name: "Neonatal-like sepsis (elderly analog)", category: "strong_systemic", expected_top1: "sepsis",
    input: { symptoms: ["lethargy","confusion","reduced urine output","weakness","chills"], vitals: { temperature: 35.8, heartRate: 120, blood_pressure_systolic: 78, respiratoryRate: 28, spo2: 90 }, medical_history: ["diabetes","immunosuppression","chronic kidney disease"], age: 85, sex: "female", duration: "12 hours" },
  },
  {
    id: "s15", name: "Cholangitis → Sepsis", category: "strong_systemic", expected_top1: "sepsis",
    input: { symptoms: ["fever","jaundice","right upper quadrant pain","confusion","chills"], vitals: { temperature: 39.6, heartRate: 124, blood_pressure_systolic: 82, respiratoryRate: 26, spo2: 92 }, medical_history: ["gallstones","previous cholecystectomy"], age: 68, sex: "female", duration: "1 day" },
  },
];

// ═══════════════════════════════════════════════════════
// PURE LOCAL (20 cases)
// ═══════════════════════════════════════════════════════
const LOCAL: V3BenchCase[] = [
  {
    id: "l01", name: "CAP — Clear respiratory", category: "pure_local", expected_top1: "pneumonia", hero: true,
    input: { symptoms: ["cough","fever","dyspnea","chest pain","sputum production"], vitals: { temperature: 38.5, heartRate: 96, blood_pressure_systolic: 130, respiratoryRate: 22, spo2: 94 }, medical_history: ["COPD"], age: 45, sex: "male", duration: "5 days" },
  },
  {
    id: "l02", name: "Appendicitis — Classic RLQ", category: "pure_local", expected_top1: "appendicitis",
    input: { symptoms: ["abdominal pain","right lower quadrant pain","nausea","vomiting","fever"], vitals: { temperature: 38.2, heartRate: 92, blood_pressure_systolic: 125, respiratoryRate: 18, spo2: 98 }, medical_history: [], age: 25, sex: "male", duration: "12 hours" },
  },
  {
    id: "l03", name: "Appendicitis — Atypical peri-umbilical", category: "pure_local", expected_top1: "appendicitis",
    input: { symptoms: ["periumbilical pain","nausea","loss of appetite","low grade fever","right lower quadrant pain"], vitals: { temperature: 37.8, heartRate: 88, blood_pressure_systolic: 122, respiratoryRate: 16, spo2: 99 }, medical_history: [], age: 18, sex: "female", duration: "18 hours" },
  },
  {
    id: "l04", name: "Renal colic — Flank pain", category: "pure_local", expected_top1: "renal colic",
    input: { symptoms: ["flank pain","groin pain","nausea","vomiting","hematuria"], vitals: { temperature: 37.0, heartRate: 100, blood_pressure_systolic: 145, respiratoryRate: 20, spo2: 99 }, medical_history: ["previous kidney stones"], age: 38, sex: "male", duration: "4 hours" },
  },
  {
    id: "l05", name: "Pyelonephritis — Localized UTI", category: "pure_local", expected_top1: "pyelonephritis",
    input: { symptoms: ["fever","flank pain","dysuria","frequency","nausea"], vitals: { temperature: 39.0, heartRate: 98, blood_pressure_systolic: 120, respiratoryRate: 18, spo2: 98 }, medical_history: ["recurrent UTIs"], age: 30, sex: "female", duration: "2 days" },
  },
  {
    id: "l06", name: "Cholecystitis — RUQ pain", category: "pure_local", expected_top1: "cholecystitis",
    input: { symptoms: ["right upper quadrant pain","nausea","vomiting","fever"], vitals: { temperature: 38.5, heartRate: 96, blood_pressure_systolic: 130, respiratoryRate: 18, spo2: 98 }, medical_history: ["gallstones"], age: 42, sex: "female", duration: "12 hours" },
  },
  {
    id: "l07", name: "Gastroenteritis — Acute", category: "pure_local", expected_top1: "gastroenteritis",
    input: { symptoms: ["diarrhea","vomiting","abdominal pain","nausea"], vitals: { temperature: 38.0, heartRate: 92, blood_pressure_systolic: 115, respiratoryRate: 16, spo2: 99 }, medical_history: [], age: 28, sex: "female", duration: "1 day" },
  },
  {
    id: "l08", name: "Migraine — Typical with aura", category: "pure_local", expected_top1: "migraine",
    input: { symptoms: ["headache","nausea","photophobia","throbbing pain","aura"], vitals: { temperature: 36.8, heartRate: 78, blood_pressure_systolic: 120, respiratoryRate: 16, spo2: 99 }, medical_history: ["migraine history"], age: 32, sex: "female", duration: "6 hours" },
  },
  {
    id: "l09", name: "Gout — First MTP", category: "pure_local", expected_top1: "gout",
    input: { symptoms: ["joint pain","swelling","redness","warmth"], vitals: { temperature: 37.2, heartRate: 80, blood_pressure_systolic: 140, respiratoryRate: 16, spo2: 99 }, medical_history: ["hypertension","high uric acid"], age: 55, sex: "male", duration: "12 hours" },
  },
  {
    id: "l10", name: "Cellulitis — Localized", category: "pure_local", expected_top1: "cellulitis",
    input: { symptoms: ["rash","swelling","warmth","pain","fever"], vitals: { temperature: 38.3, heartRate: 88, blood_pressure_systolic: 130, respiratoryRate: 16, spo2: 99 }, medical_history: ["diabetes"], age: 55, sex: "male", duration: "3 days" },
  },
  {
    id: "l11", name: "Viral URTI — No systemic", category: "pure_local", expected_top1: "upper respiratory infection",
    input: { symptoms: ["cough","sore throat","runny nose","sneezing"], vitals: { temperature: 37.5, heartRate: 78, blood_pressure_systolic: 120, respiratoryRate: 16, spo2: 99 }, medical_history: [], age: 30, sex: "male", duration: "3 days" },
  },
  {
    id: "l12", name: "Otitis Media — Ear pain", category: "pure_local", expected_top1: "otitis media",
    input: { symptoms: ["ear pain","fever","hearing loss","irritability"], vitals: { temperature: 38.2, heartRate: 90, blood_pressure_systolic: 120, respiratoryRate: 16, spo2: 99 }, medical_history: [], age: 6, sex: "male", duration: "2 days" },
  },
  {
    id: "l13", name: "Acute Bronchitis", category: "pure_local", expected_top1: "bronchitis",
    input: { symptoms: ["cough","sputum production","chest discomfort","low grade fever","fatigue"], vitals: { temperature: 37.8, heartRate: 82, blood_pressure_systolic: 125, respiratoryRate: 18, spo2: 97 }, medical_history: ["smoking"], age: 40, sex: "male", duration: "5 days" },
  },
  {
    id: "l14", name: "Tension Headache", category: "pure_local", expected_top1: "tension headache",
    input: { symptoms: ["headache","neck tension","bilateral pressure","fatigue"], vitals: { temperature: 36.6, heartRate: 72, blood_pressure_systolic: 118, respiratoryRate: 14, spo2: 99 }, medical_history: ["stress","desk job"], age: 35, sex: "female", duration: "3 days" },
  },
  {
    id: "l15", name: "Sinusitis — Acute", category: "pure_local", expected_top1: "sinusitis",
    input: { symptoms: ["facial pain","nasal congestion","purulent nasal discharge","headache","fever"], vitals: { temperature: 38.0, heartRate: 80, blood_pressure_systolic: 120, respiratoryRate: 16, spo2: 99 }, medical_history: ["allergic rhinitis"], age: 35, sex: "female", duration: "7 days" },
  },
  {
    id: "l16", name: "Peptic Ulcer — Epigastric", category: "pure_local", expected_top1: "peptic ulcer",
    input: { symptoms: ["epigastric pain","burning sensation","nausea","bloating"], vitals: { temperature: 36.8, heartRate: 78, blood_pressure_systolic: 125, respiratoryRate: 16, spo2: 99 }, medical_history: ["NSAID use","smoking"], age: 48, sex: "male", duration: "2 weeks" },
  },
  {
    id: "l17", name: "Sciatica — Radicular", category: "pure_local", expected_top1: "sciatica",
    input: { symptoms: ["low back pain","leg pain","numbness","tingling","pain on sitting"], vitals: { temperature: 36.6, heartRate: 75, blood_pressure_systolic: 130, respiratoryRate: 14, spo2: 99 }, medical_history: ["heavy lifting"], age: 45, sex: "male", duration: "1 week" },
  },
  {
    id: "l18", name: "Conjunctivitis — Viral", category: "pure_local", expected_top1: "conjunctivitis",
    input: { symptoms: ["eye redness","watery discharge","itching","foreign body sensation"], vitals: { temperature: 36.8, heartRate: 72, blood_pressure_systolic: 118, respiratoryRate: 14, spo2: 99 }, medical_history: [], age: 28, sex: "female", duration: "2 days" },
  },
  {
    id: "l19", name: "Acute Pharyngitis — Strep", category: "pure_local", expected_top1: "pharyngitis",
    input: { symptoms: ["sore throat","fever","difficulty swallowing","swollen lymph nodes"], vitals: { temperature: 38.5, heartRate: 88, blood_pressure_systolic: 120, respiratoryRate: 16, spo2: 99 }, medical_history: [], age: 15, sex: "male", duration: "2 days" },
  },
  {
    id: "l20", name: "Urticaria — Acute allergic", category: "pure_local", expected_top1: "urticaria",
    input: { symptoms: ["hives","itching","swelling","skin rash"], vitals: { temperature: 36.8, heartRate: 82, blood_pressure_systolic: 118, respiratoryRate: 16, spo2: 99 }, medical_history: ["shellfish allergy"], age: 30, sex: "female", duration: "4 hours" },
  },
];

// ═══════════════════════════════════════════════════════
// AMBIGUOUS / OVERLAP (15 cases)
// ═══════════════════════════════════════════════════════
const AMBIGUOUS: V3BenchCase[] = [
  {
    id: "a01", name: "CAP vs Sepsis", category: "ambiguous_overlap", expected_top1: "sepsis", top3_sufficient: true, hero: true,
    input: { symptoms: ["cough","fever","confusion","shortness of breath","chills"], vitals: { temperature: 38.8, heartRate: 110, blood_pressure_systolic: 95, respiratoryRate: 24, spo2: 92 }, medical_history: ["COPD"], age: 65, sex: "male", duration: "3 days" },
  },
  {
    id: "a02", name: "UTI vs Sepsis — Elderly female", category: "ambiguous_overlap", expected_top1: "urinary tract infection", top3_sufficient: true,
    input: { symptoms: ["fever","dysuria","frequency","mild confusion"], vitals: { temperature: 38.5, heartRate: 95, blood_pressure_systolic: 110, respiratoryRate: 18, spo2: 97 }, medical_history: ["diabetes"], age: 72, sex: "female", duration: "2 days" },
  },
  {
    id: "a03", name: "Viral vs Bacterial infection", category: "ambiguous_overlap", expected_top1: "viral infection", top3_sufficient: true,
    input: { symptoms: ["fever","fatigue","body aches","headache"], vitals: { temperature: 38.5, heartRate: 90, blood_pressure_systolic: 120, respiratoryRate: 18, spo2: 98 }, medical_history: [], age: 35, sex: "male", duration: "3 days" },
  },
  {
    id: "a04", name: "ACS vs PE", category: "ambiguous_overlap", expected_top1: "acute coronary syndrome", top3_sufficient: true,
    input: { symptoms: ["chest pain","shortness of breath","sweating","tachycardia"], vitals: { temperature: 37.0, heartRate: 108, blood_pressure_systolic: 140, respiratoryRate: 22, spo2: 94 }, medical_history: ["hypertension","smoking"], age: 58, sex: "male", duration: "2 hours" },
  },
  {
    id: "a05", name: "Pancreatitis vs Cholecystitis", category: "ambiguous_overlap", expected_top1: "acute pancreatitis", top3_sufficient: true,
    input: { symptoms: ["epigastric pain","vomiting","nausea","back pain"], vitals: { temperature: 37.8, heartRate: 100, blood_pressure_systolic: 115, respiratoryRate: 20, spo2: 98 }, medical_history: ["alcohol use","gallstones"], age: 48, sex: "male", duration: "8 hours" },
  },
  {
    id: "a06", name: "DKA vs Gastroenteritis", category: "ambiguous_overlap", expected_top1: "diabetic ketoacidosis", top3_sufficient: true,
    input: { symptoms: ["nausea","vomiting","abdominal pain","deep breathing","fatigue"], vitals: { temperature: 37.2, heartRate: 112, blood_pressure_systolic: 105, respiratoryRate: 30, spo2: 99 }, medical_history: ["type 1 diabetes"], age: 22, sex: "male", duration: "1 day" },
  },
  {
    id: "a07", name: "CHF vs Pneumonia", category: "ambiguous_overlap", expected_top1: "heart failure", top3_sufficient: true,
    input: { symptoms: ["dyspnea","cough","leg swelling","fatigue","orthopnea"], vitals: { temperature: 37.0, heartRate: 98, blood_pressure_systolic: 155, respiratoryRate: 24, spo2: 91 }, medical_history: ["heart failure","hypertension"], age: 72, sex: "male", duration: "5 days" },
  },
  {
    id: "a08", name: "Meningitis vs Migraine", category: "ambiguous_overlap", expected_top1: "meningitis", top3_sufficient: true,
    input: { symptoms: ["headache","neck stiffness","photophobia","nausea","fever"], vitals: { temperature: 39.0, heartRate: 100, blood_pressure_systolic: 125, respiratoryRate: 20, spo2: 98 }, medical_history: [], age: 22, sex: "male", duration: "12 hours" },
  },
  {
    id: "a09", name: "Pneumonia vs PE", category: "ambiguous_overlap", expected_top1: "pneumonia", top3_sufficient: true,
    input: { symptoms: ["dyspnea","chest pain","cough","fever","tachycardia"], vitals: { temperature: 38.2, heartRate: 108, blood_pressure_systolic: 118, respiratoryRate: 24, spo2: 92 }, medical_history: ["recent long-haul flight"], age: 42, sex: "female", duration: "2 days" },
  },
  {
    id: "a10", name: "Diverticulitis vs Appendicitis (elderly)", category: "ambiguous_overlap", expected_top1: "diverticulitis", top3_sufficient: true,
    input: { symptoms: ["left lower quadrant pain","fever","nausea","change in bowel habits"], vitals: { temperature: 38.4, heartRate: 92, blood_pressure_systolic: 130, respiratoryRate: 18, spo2: 98 }, medical_history: ["previous diverticulosis"], age: 65, sex: "male", duration: "2 days" },
  },
  {
    id: "a11", name: "Asthma exacerbation vs PE", category: "ambiguous_overlap", expected_top1: "asthma exacerbation", top3_sufficient: true,
    input: { symptoms: ["wheezing","shortness of breath","chest tightness","cough"], vitals: { temperature: 37.0, heartRate: 105, blood_pressure_systolic: 130, respiratoryRate: 26, spo2: 92 }, medical_history: ["asthma","oral contraceptives"], age: 28, sex: "female", duration: "6 hours" },
  },
  {
    id: "a12", name: "Hepatitis vs Cholecystitis", category: "ambiguous_overlap", expected_top1: "hepatitis", top3_sufficient: true,
    input: { symptoms: ["jaundice","right upper quadrant pain","nausea","fatigue","dark urine"], vitals: { temperature: 37.8, heartRate: 85, blood_pressure_systolic: 120, respiratoryRate: 16, spo2: 99 }, medical_history: ["travel to endemic area"], age: 32, sex: "male", duration: "5 days" },
  },
  {
    id: "a13", name: "Thyroid storm vs Sepsis", category: "ambiguous_overlap", expected_top1: "thyroid storm", top3_sufficient: true,
    input: { symptoms: ["fever","tachycardia","confusion","tremor","agitation"], vitals: { temperature: 39.2, heartRate: 140, blood_pressure_systolic: 160, respiratoryRate: 24, spo2: 96 }, medical_history: ["Graves disease","stopped medication"], age: 38, sex: "female", duration: "1 day" },
  },
  {
    id: "a14", name: "Ectopic pregnancy vs Appendicitis", category: "ambiguous_overlap", expected_top1: "ectopic pregnancy", top3_sufficient: true,
    input: { symptoms: ["lower abdominal pain","vaginal bleeding","nausea","dizziness"], vitals: { temperature: 37.2, heartRate: 105, blood_pressure_systolic: 100, respiratoryRate: 18, spo2: 99 }, medical_history: ["previous ectopic","IUD"], age: 28, sex: "female", duration: "6 hours" },
  },
  {
    id: "a15", name: "Early sepsis — Partial vitals", category: "ambiguous_overlap", expected_top1: "sepsis", top3_sufficient: true,
    input: { symptoms: ["fever","chills","fatigue","mild confusion"], vitals: { temperature: 38.3, heartRate: 100, blood_pressure_systolic: 105, respiratoryRate: 20, spo2: 96 }, medical_history: ["diabetes"], age: 60, sex: "male", duration: "1 day" },
  },
];

export const V3_BENCH_CASES: V3BenchCase[] = [...SYSTEMIC, ...LOCAL, ...AMBIGUOUS];
