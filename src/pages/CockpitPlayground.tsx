import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { HypothesisEntry, PipelineEvidence, PipelineCompliance } from "@/components/clinical/ClinicalCopilot";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { ClinicalCard } from "@/components/ui/clinical-card";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import ClinicalCopilot from "@/components/clinical/ClinicalCopilot";
import AiDisclosureBadge from "@/components/AiDisclosureBadge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, FileText, AlertTriangle, CheckCircle,
  HeartPulse, User, Sparkles, RotateCcw, ClipboardCheck, Brain,
  Zap, Activity, Stethoscope, Eye, Search,
  Heart, Wind, Droplets, Shield, ChevronDown, ChevronUp,
  Beaker, GitCompare, Layers, Thermometer, X,
  TreePine, Edit3, FlaskConical, Pill, Scale, Send, MessageSquare
} from "lucide-react";
import type { SoapSections } from "@/layers/ai-agents/api";
import { EMPTY_SOAP } from "@/layers/ai-agents/api";
import type { SafetyResults } from "@/layers/safety/api";
import { AI_DRAFT_LABEL } from "@/layers/safety/api";
import { type ClinicalContext, EMPTY_CLINICAL_CONTEXT, buildClinicalContext, buildFullClinicalContext } from "@/lib/clinical-context";

// ── Presets ──
const COMMON_SYMPTOMS = ["Fever", "Cough", "Headache", "Body ache", "Vomiting", "Diarrhea", "Cold", "Sore throat", "Fatigue", "Chest pain", "Breathlessness", "Abdominal pain", "Dizziness", "Back pain", "Dysuria", "Rash", "Joint pain", "Palpitations", "Neck stiffness", "Syncope", "Sweating", "Nausea", "Photophobia"];
const DURATION_PRESETS = ["Today", "2 days", "3 days", "5 days", "1 week", "2 weeks", "1 month"];
const ONSET_PRESETS = ["Sudden", "Gradual", "Intermittent", "Progressive", "Episodic"];
const SEVERITY_PRESETS = ["Mild", "Moderate", "Severe", "Worsening", "Improving"];
const BODY_LOCATION_PRESETS = ["Head", "Neck", "Chest", "Upper abdomen", "Lower abdomen", "Back", "Limbs", "Generalized", "Left side", "Right side", "Right lower quadrant"];
const RISK_FACTOR_PRESETS = ["Smoking", "Alcohol", "Diabetes", "Hypertension", "Obesity", "Pregnancy", "Immunocompromised", "Recent surgery", "Recent travel", "Occupational exposure"];
const MEDICAL_HISTORY_PRESETS = ["Asthma", "COPD", "Heart failure", "Diabetes mellitus", "Hypertension", "Previous stroke", "Gallstones", "Thyroid disorder", "Chronic kidney disease", "Cancer history"];
const FAMILY_HISTORY_PRESETS = ["Heart disease", "Diabetes", "Cancer", "Stroke", "Autoimmune disease", "Hypertension", "Asthma"];
const EXAM_FINDINGS_PRESETS = ["Neck stiffness", "Wheezing", "Crepitations", "Rebound tenderness", "Guarding", "Focal neurological deficit", "Pallor", "Jaundice", "Lymphadenopathy", "Pedal edema", "Kernig sign"];

const SYMPTOM_EXPANSIONS: Record<string, { label: string; chips: string[] }> = {
  "Fever": { label: "Fever Type", chips: ["Low-grade", "High", "Intermittent", "Continuous"] },
  "Cough": { label: "Cough Type", chips: ["Dry", "Productive", "With blood", "Nocturnal"] },
  "Chest pain": { label: "Character", chips: ["Sharp", "Dull", "Crushing", "Burning", "Radiating"] },
  "Headache": { label: "Pattern", chips: ["Throbbing", "Constant", "One-sided", "Both sides", "With aura"] },
  "Abdominal pain": { label: "Location", chips: ["Upper", "Lower", "Right", "Left", "Diffuse", "Periumbilical"] },
};

// ═══ MANAGEMENT ENGINE — Maps diagnoses to recommended tests & treatments ═══
const MANAGEMENT_MAP: Record<string, { tests: string[]; medications: Array<{ drug: string; dose: string; route: string; freq: string; dur: string; line: "first" | "alternative" | "emergency" }>; monitoring?: string[]; instructions?: string[] }> = {
  "migraine": {
    tests: ["CT Brain (if red flags)", "MRI Brain (if atypical)"],
    medications: [
      { drug: "Paracetamol", dose: "500mg", route: "PO", freq: "QID", dur: "3 days", line: "first" },
      { drug: "Ibuprofen", dose: "400mg", route: "PO", freq: "TID", dur: "3 days", line: "first" },
      { drug: "Sumatriptan", dose: "50mg", route: "PO", freq: "PRN", dur: "As needed", line: "alternative" },
    ],
    monitoring: ["Headache frequency diary", "Response to acute treatment", "Follow up in 1 week if symptoms persist"],
    instructions: ["Avoid bright lights and loud noises during episodes", "Stay hydrated — drink at least 2L water/day", "Maintain regular sleep schedule", "Seek emergency care if: worst headache of life, sudden onset, neck stiffness, confusion", "Follow up in 1 week if symptoms persist"],
  },
  "tension headache": {
    tests: [],
    medications: [
      { drug: "Paracetamol", dose: "500mg", route: "PO", freq: "TID", dur: "5 days", line: "first" },
      { drug: "Ibuprofen", dose: "400mg", route: "PO", freq: "TID", dur: "3 days", line: "alternative" },
    ],
    monitoring: ["Headache diary — frequency and triggers", "Follow up if symptoms persist >2 weeks"],
    instructions: ["Apply warm compress to neck/shoulders", "Practice stress management techniques", "Ensure adequate sleep (7-8 hours)", "Follow up if symptoms worsen or persist >2 weeks"],
  },
  "subarachnoid hemorrhage": {
    tests: ["CT Brain (urgent)", "CT Angiography", "Lumbar puncture (if CT negative)", "CBC", "Coagulation profile"],
    medications: [
      { drug: "Nimodipine", dose: "60mg", route: "PO", freq: "Q4H", dur: "21 days", line: "first" },
      { drug: "IV Fluids", dose: "NS 1L", route: "IV", freq: "Q8H", dur: "Ongoing", line: "first" },
    ],
    monitoring: ["GCS every 1 hour", "Neuro checks Q1H", "BP monitoring — target SBP <160", "ICU admission required"],
    instructions: ["EMERGENCY: Immediate neurosurgical consultation required", "Strict bed rest", "Keep head of bed elevated 30°"],
  },
  "acute coronary syndrome": {
    tests: ["ECG (12-lead)", "Troponin I/T", "CBC", "BMP", "Lipid profile", "Chest X-ray", "Echocardiogram"],
    medications: [
      { drug: "Aspirin", dose: "325mg", route: "PO", freq: "STAT", dur: "Single dose", line: "emergency" },
      { drug: "Clopidogrel", dose: "300mg", route: "PO", freq: "STAT", dur: "Loading dose", line: "emergency" },
      { drug: "Atorvastatin", dose: "80mg", route: "PO", freq: "OD", dur: "Ongoing", line: "first" },
      { drug: "Nitroglycerin", dose: "0.4mg SL", route: "SL", freq: "PRN", dur: "As needed", line: "emergency" },
    ],
    monitoring: ["Serial Troponin at 0, 3, 6 hours", "Continuous ECG monitoring", "Repeat ECG if symptoms change", "Cardiology consult within 48 hours"],
    instructions: ["EMERGENCY: Call ambulance if chest pain returns", "Take aspirin immediately if chest pain recurs", "Do NOT exert yourself — complete rest", "Follow up with cardiologist within 48 hours"],
  },
  "myocardial infarction": {
    tests: ["ECG (12-lead)", "Troponin I/T", "CBC", "BMP", "Chest X-ray"],
    medications: [
      { drug: "Aspirin", dose: "325mg", route: "PO", freq: "STAT", dur: "Single dose", line: "emergency" },
      { drug: "Clopidogrel", dose: "300mg", route: "PO", freq: "STAT", dur: "Loading dose", line: "emergency" },
      { drug: "Morphine", dose: "2-4mg", route: "IV", freq: "PRN", dur: "As needed", line: "emergency" },
    ],
    monitoring: ["Serial Troponin at 0, 3, 6 hours", "Continuous cardiac monitoring", "BP and HR Q15min", "Door-to-balloon time tracking"],
    instructions: ["EMERGENCY: Immediate cardiology consultation", "Strict bed rest", "Continuous cardiac monitoring"],
  },
  "appendicitis": {
    tests: ["CBC", "CRP", "Ultrasound abdomen", "CT abdomen (if diagnosis unclear)", "Urinalysis"],
    medications: [
      { drug: "IV Fluids", dose: "NS 1L", route: "IV", freq: "Q8H", dur: "Pre-op", line: "first" },
      { drug: "Ceftriaxone", dose: "1g", route: "IV", freq: "BD", dur: "Perioperative", line: "first" },
      { drug: "Metronidazole", dose: "500mg", route: "IV", freq: "TID", dur: "Perioperative", line: "first" },
      { drug: "Paracetamol", dose: "1g", route: "IV", freq: "QID", dur: "As needed", line: "first" },
    ],
    monitoring: ["Pain score Q4H", "Temperature Q6H", "Surgical review within 4 hours", "Post-op wound inspection"],
    instructions: ["Nil by mouth (NBM) — no food or drink", "Surgical consultation required", "Return immediately if pain worsens, fever increases, or vomiting becomes severe"],
  },
  "gastroenteritis": {
    tests: ["CBC", "CRP", "Stool culture", "Electrolytes", "Renal function"],
    medications: [
      { drug: "ORS", dose: "200ml", route: "PO", freq: "After each stool", dur: "Until resolved", line: "first" },
      { drug: "Ondansetron", dose: "4mg", route: "PO", freq: "TID", dur: "3 days", line: "first" },
      { drug: "Zinc", dose: "20mg", route: "PO", freq: "OD", dur: "10 days", line: "first" },
    ],
    monitoring: ["Hydration status — skin turgor, mucous membranes", "Urine output — target >0.5 ml/kg/hr", "Electrolytes if severe dehydration", "Return if symptoms persist >48 hours"],
    instructions: ["Drink plenty of fluids — ORS, coconut water, clear soups", "Eat light diet — rice, bananas, toast, yogurt", "Avoid dairy, spicy, and fried foods", "Wash hands frequently to prevent spread", "Seek emergency care if: bloody stools, inability to keep fluids down, high fever >103°F, signs of dehydration"],
  },
  "food poisoning": {
    tests: ["Stool culture", "CBC", "Electrolytes"],
    medications: [
      { drug: "ORS", dose: "200ml", route: "PO", freq: "After each stool", dur: "Until resolved", line: "first" },
      { drug: "Ondansetron", dose: "4mg", route: "PO", freq: "TID", dur: "2 days", line: "first" },
    ],
    monitoring: ["Hydration status", "Return if symptoms persist >3 days"],
    instructions: ["Stay hydrated — small frequent sips of ORS", "Bland diet for 24-48 hours", "Return if symptoms persist beyond 3 days"],
  },
  "pulmonary embolism": {
    tests: ["CT Pulmonary Angiography", "D-dimer", "ECG", "ABG", "Echocardiogram", "CBC", "Troponin"],
    medications: [
      { drug: "Heparin", dose: "80 units/kg", route: "IV", freq: "STAT", dur: "Loading dose", line: "emergency" },
      { drug: "Enoxaparin", dose: "1mg/kg", route: "SC", freq: "BD", dur: "5 days", line: "first" },
      { drug: "Warfarin", dose: "5mg", route: "PO", freq: "OD", dur: "3-6 months", line: "first" },
    ],
    monitoring: ["APTT monitoring if on heparin", "INR monitoring — target 2-3 if on warfarin", "SpO₂ continuous monitoring", "Repeat CTPA if clinical deterioration"],
    instructions: ["EMERGENCY: Anticoagulation must not be delayed", "Avoid prolonged immobility", "Regular INR monitoring if on warfarin"],
  },
  "pneumonia": {
    tests: ["Chest X-ray", "CBC", "CRP", "Blood culture", "Sputum culture", "Procalcitonin"],
    medications: [
      { drug: "Amoxicillin", dose: "500mg", route: "PO", freq: "TID", dur: "7 days", line: "first" },
      { drug: "Azithromycin", dose: "500mg", route: "PO", freq: "OD", dur: "3 days", line: "alternative" },
      { drug: "Paracetamol", dose: "500mg", route: "PO", freq: "QID", dur: "As needed", line: "first" },
    ],
    monitoring: ["Temperature Q6H — fever curve", "SpO₂ monitoring", "Repeat CRP at 48-72 hours", "Follow up chest X-ray in 6 weeks"],
    instructions: ["Complete the full course of antibiotics", "Rest and stay hydrated", "Use steam inhalation for congestion", "Return if: breathing difficulty worsens, fever >103°F, coughing blood", "Follow up chest X-ray in 6 weeks"],
  },
  "community-acquired pneumonia": {
    tests: ["Chest X-ray", "CBC", "CRP", "Blood culture", "Sputum culture"],
    medications: [
      { drug: "Amoxicillin-Clavulanate", dose: "625mg", route: "PO", freq: "TID", dur: "7 days", line: "first" },
      { drug: "Azithromycin", dose: "500mg", route: "PO", freq: "OD", dur: "3 days", line: "alternative" },
      { drug: "Paracetamol", dose: "500mg", route: "PO", freq: "QID", dur: "As needed", line: "first" },
    ],
    monitoring: ["Temperature Q6H", "CURB-65 score assessment", "Repeat CRP at 48-72 hours", "Follow up in 48-72 hours if no improvement"],
    instructions: ["Complete full antibiotic course", "Increase fluid intake", "Follow up in 48-72 hours if no improvement"],
  },
  "copd exacerbation": {
    tests: ["Chest X-ray", "ABG", "CBC", "Sputum culture"],
    medications: [
      { drug: "Salbutamol nebulization", dose: "2.5mg", route: "NEB", freq: "QID", dur: "5 days", line: "first" },
      { drug: "Prednisolone", dose: "40mg", route: "PO", freq: "OD", dur: "5 days", line: "first" },
      { drug: "Amoxicillin-Clavulanate", dose: "625mg", route: "PO", freq: "TID", dur: "7 days", line: "first" },
    ],
    monitoring: ["SpO₂ monitoring — target 88-92%", "Peak flow measurement BD", "ABG if SpO₂ <90%", "Follow up in 1 week"],
    instructions: ["Use inhalers as prescribed", "Avoid smoke and dust exposure", "Seek care if breathing worsens despite treatment"],
  },
  "urinary tract infection": {
    tests: ["Urinalysis", "Urine culture", "CBC"],
    medications: [
      { drug: "Nitrofurantoin", dose: "100mg", route: "PO", freq: "BD", dur: "5 days", line: "first" },
      { drug: "Paracetamol", dose: "500mg", route: "PO", freq: "TID", dur: "As needed", line: "first" },
    ],
    monitoring: ["Urine culture sensitivity after 48 hours", "Follow up if symptoms persist after completing antibiotics"],
    instructions: ["Drink at least 2-3 litres of water daily", "Complete the full antibiotic course", "Urinate frequently — do not hold urine", "Return if: fever, back pain, blood in urine"],
  },
  "meningitis": {
    tests: ["CT Brain", "Lumbar puncture", "CSF analysis", "Blood culture", "CBC", "CRP", "Procalcitonin"],
    medications: [
      { drug: "Ceftriaxone", dose: "2g", route: "IV", freq: "BD", dur: "10-14 days", line: "emergency" },
      { drug: "Dexamethasone", dose: "0.15mg/kg", route: "IV", freq: "QID", dur: "4 days", line: "first" },
    ],
    monitoring: ["GCS Q1H", "Neuro checks Q1H", "Temperature Q4H", "Repeat LP if no improvement in 48 hours"],
    instructions: ["EMERGENCY: Antibiotics must be given within 1 hour", "ICU monitoring may be required", "Close contacts may need prophylaxis"],
  },
  "diabetic ketoacidosis": {
    tests: ["Blood glucose", "ABG", "Electrolytes", "Serum ketones", "CBC", "Renal function"],
    medications: [
      { drug: "Insulin (Regular)", dose: "0.1 units/kg/hr", route: "IV", freq: "Infusion", dur: "Until resolved", line: "emergency" },
      { drug: "IV Fluids (NS)", dose: "1L", route: "IV", freq: "Q1H initially", dur: "Until rehydrated", line: "emergency" },
      { drug: "Potassium chloride", dose: "20-40 mEq/L", route: "IV", freq: "Per IV fluid", dur: "Per protocol", line: "first" },
    ],
    monitoring: ["Blood glucose Q1H", "Electrolytes Q2H", "ABG Q2-4H", "Potassium before and during insulin", "Urine output Q1H", "Anion gap until closed"],
    instructions: ["EMERGENCY: Continuous IV insulin and fluid resuscitation", "Monitor blood glucose hourly", "Check electrolytes every 2 hours"],
  },
  "hypertensive crisis": {
    tests: ["ECG", "BMP", "Renal function", "Urinalysis", "Chest X-ray", "Fundoscopy"],
    medications: [
      { drug: "Labetalol", dose: "20mg", route: "IV", freq: "Q10min PRN", dur: "Until controlled", line: "emergency" },
      { drug: "Amlodipine", dose: "5mg", route: "PO", freq: "OD", dur: "Ongoing", line: "first" },
    ],
    monitoring: ["BP Q5min during IV therapy", "Reduce MAP by ≤25% in first hour", "Target BP <160/100 over 2-6 hours", "End-organ damage assessment"],
    instructions: ["EMERGENCY: Blood pressure must be reduced gradually", "Do NOT reduce BP by more than 25% in first hour", "Follow up with cardiologist within 1 week"],
  },
  "costochondritis": {
    tests: ["ECG (to rule out cardiac)", "Chest X-ray (if atypical)"],
    medications: [
      { drug: "Ibuprofen", dose: "400mg", route: "PO", freq: "TID", dur: "7 days", line: "first" },
      { drug: "Paracetamol", dose: "500mg", route: "PO", freq: "QID", dur: "5 days", line: "alternative" },
    ],
    monitoring: ["Pain response to NSAIDs at 1 week", "Follow up if not improving in 2 weeks"],
    instructions: ["Apply warm compress to affected area", "Avoid activities that worsen pain", "This is a benign condition — pain usually resolves in weeks", "Return if: breathlessness, radiating pain, fever"],
  },
  "musculoskeletal chest pain": {
    tests: ["ECG", "Chest X-ray"],
    medications: [
      { drug: "Ibuprofen", dose: "400mg", route: "PO", freq: "TID", dur: "5 days", line: "first" },
      { drug: "Paracetamol", dose: "500mg", route: "PO", freq: "QID", dur: "As needed", line: "alternative" },
    ],
    monitoring: ["Follow up if pain persists >2 weeks"],
    instructions: ["Rest the affected area", "Apply ice or heat as needed", "Follow up if pain persists >2 weeks or worsens"],
  },
  "gastritis": {
    tests: ["CBC", "H. pylori test", "Upper GI endoscopy (if persistent)"],
    medications: [
      { drug: "Pantoprazole", dose: "40mg", route: "PO", freq: "OD", dur: "4 weeks", line: "first" },
      { drug: "Domperidone", dose: "10mg", route: "PO", freq: "TID", dur: "1 week", line: "first" },
    ],
    monitoring: ["Symptom reassessment at 4 weeks", "H. pylori eradication confirmation if positive"],
    instructions: ["Avoid spicy, acidic, and fried foods", "Eat small frequent meals", "Avoid NSAIDs and alcohol", "Follow up in 4 weeks if symptoms persist"],
  },
  "peptic ulcer disease": {
    tests: ["CBC", "H. pylori test", "Upper GI endoscopy"],
    medications: [
      { drug: "Pantoprazole", dose: "40mg", route: "PO", freq: "BD", dur: "8 weeks", line: "first" },
      { drug: "Amoxicillin", dose: "1g", route: "PO", freq: "BD", dur: "14 days", line: "first" },
      { drug: "Clarithromycin", dose: "500mg", route: "PO", freq: "BD", dur: "14 days", line: "first" },
    ],
    monitoring: ["H. pylori breath test at 4 weeks post-treatment", "Follow up endoscopy at 8 weeks", "Monitor for GI bleeding signs"],
    instructions: ["Complete full H. pylori eradication course", "Avoid NSAIDs", "Follow up endoscopy in 8 weeks"],
  },
  "acute bronchitis": {
    tests: ["Chest X-ray (if pneumonia suspected)", "CBC"],
    medications: [
      { drug: "Paracetamol", dose: "500mg", route: "PO", freq: "QID", dur: "5 days", line: "first" },
      { drug: "Dextromethorphan", dose: "30mg", route: "PO", freq: "TID", dur: "5 days", line: "first" },
    ],
    monitoring: ["Symptom duration — expect 2-3 weeks", "Return if cough persists >3 weeks"],
    instructions: ["Stay hydrated", "Use honey for cough relief", "Most cases are viral — antibiotics usually not needed", "Return if: breathing difficulty, high fever, coughing blood"],
  },
  "upper respiratory tract infection": {
    tests: [],
    medications: [
      { drug: "Paracetamol", dose: "500mg", route: "PO", freq: "TID", dur: "3 days", line: "first" },
      { drug: "Cetirizine", dose: "10mg", route: "PO", freq: "OD", dur: "5 days", line: "first" },
    ],
    monitoring: ["Self-limiting — expect 5-7 days", "Return if symptoms worsen or persist >10 days"],
    instructions: ["Rest and stay hydrated", "Steam inhalation for congestion", "Usually self-limiting (5-7 days)", "Seek care if symptoms worsen or persist >10 days"],
  },
  "viral fever": {
    tests: ["CBC", "Dengue NS1/IgM (if endemic area)"],
    medications: [
      { drug: "Paracetamol", dose: "500mg", route: "PO", freq: "QID", dur: "3 days", line: "first" },
    ],
    monitoring: ["Temperature monitoring BD", "Platelet count if dengue suspected", "Follow up if fever persists >5 days"],
    instructions: ["Drink plenty of fluids", "Rest", "Monitor for warning signs: persistent vomiting, bleeding, severe abdominal pain", "Follow up if fever persists >5 days"],
  },
  "stable angina": {
    tests: ["ECG", "Troponin", "Lipid profile", "Stress test", "Echocardiogram"],
    medications: [
      { drug: "Aspirin", dose: "75mg", route: "PO", freq: "OD", dur: "Ongoing", line: "first" },
      { drug: "Atorvastatin", dose: "40mg", route: "PO", freq: "OD", dur: "Ongoing", line: "first" },
      { drug: "Nitroglycerin", dose: "0.4mg SL", route: "SL", freq: "PRN", dur: "As needed", line: "first" },
      { drug: "Metoprolol", dose: "25mg", route: "PO", freq: "BD", dur: "Ongoing", line: "first" },
    ],
    monitoring: ["Exercise tolerance assessment", "Lipid profile at 6 weeks", "Cardiology follow-up in 2 weeks", "BP and HR monitoring"],
    instructions: ["Take aspirin daily", "Use sublingual nitroglycerin for acute episodes", "Follow up with cardiologist", "Lifestyle: exercise, diet modification, smoking cessation"],
  },
  "gerd": {
    tests: ["Upper GI endoscopy (if alarm features)"],
    medications: [
      { drug: "Pantoprazole", dose: "40mg", route: "PO", freq: "OD", dur: "8 weeks", line: "first" },
      { drug: "Domperidone", dose: "10mg", route: "PO", freq: "TID", dur: "2 weeks", line: "first" },
    ],
    monitoring: ["Symptom response at 4 weeks", "Consider step-down to H2 blocker after 8 weeks"],
    instructions: ["Elevate head of bed", "Avoid eating 3 hours before bedtime", "Avoid spicy, fatty, citrus foods and caffeine", "Lose weight if overweight"],
  },
  "asthma exacerbation": {
    tests: ["Peak flow measurement", "Chest X-ray", "ABG (if severe)"],
    medications: [
      { drug: "Salbutamol nebulization", dose: "2.5mg", route: "NEB", freq: "Q20min x3", dur: "Acute", line: "emergency" },
      { drug: "Prednisolone", dose: "40mg", route: "PO", freq: "OD", dur: "5 days", line: "first" },
      { drug: "Ipratropium nebulization", dose: "0.5mg", route: "NEB", freq: "Q4H", dur: "As needed", line: "alternative" },
    ],
    monitoring: ["Peak flow BD — target >80% predicted", "SpO₂ monitoring", "Reassess after 3 nebulizations", "Step-down plan after acute phase"],
    instructions: ["Use rescue inhaler as prescribed", "Complete steroid course", "Identify and avoid triggers", "Seek emergency care if no improvement with nebulization"],
  },
};

function resolveManagement(diagnosisName: string): { tests: string[]; medications: Array<{ drug: string; dose: string; route: string; freq: string; dur: string; line: "first" | "alternative" | "emergency" }>; instructions: string[]; monitoring: string[] } {
  const key = diagnosisName.toLowerCase().trim();
  if (MANAGEMENT_MAP[key]) return { ...MANAGEMENT_MAP[key], instructions: MANAGEMENT_MAP[key].instructions || [], monitoring: MANAGEMENT_MAP[key].monitoring || [] };
  for (const [mapKey, val] of Object.entries(MANAGEMENT_MAP)) {
    if (key.includes(mapKey) || mapKey.includes(key)) return { ...val, instructions: val.instructions || [], monitoring: val.monitoring || [] };
  }
  return { tests: [], medications: [], instructions: [], monitoring: [] };
}

// ── Scenarios ──
interface Scenario {
  name: string;
  description: string;
  patient: { name: string; age: number; gender: string; location?: string; occupation?: string; diet?: string; allergies?: string[]; pregnancyStatus?: string };
  symptoms: string[];
  duration: string;
  onset: string;
  severity: string;
  bodyLocation: string;
  riskFactors: string[];
  medicalHistory: string[];
  familyHistory: string[];
  examFindings: string[];
  vitals: Record<string, number | null>;
  chiefComplaint: string;
}

const SCENARIOS: Scenario[] = [
  {
    name: "Migraine",
    description: "Classic migraine with aura",
    patient: { name: "Priya Sharma", age: 32, gender: "Female", location: "Mumbai", occupation: "Software Engineer", diet: "Vegetarian", allergies: [] },
    symptoms: ["Headache", "Nausea", "Photophobia"],
    duration: "2 days", onset: "Gradual", severity: "Moderate", bodyLocation: "Left side",
    riskFactors: [], medicalHistory: [], familyHistory: ["Hypertension"],
    examFindings: [], vitals: { bp_systolic: 120, bp_diastolic: 80, pulse: 76, spo2: 99, temperature: 98.4, respiratory_rate: 16, weight_kg: 62, blood_sugar: null },
    chiefComplaint: "Headache",
  },
  {
    name: "Subarachnoid Hemorrhage",
    description: "Thunderclap headache — must-not-miss",
    patient: { name: "Ramesh Kumar", age: 55, gender: "Male", location: "Delhi", occupation: "Business Owner", diet: "Non-vegetarian", allergies: ["Sulfa drugs"] },
    symptoms: ["Headache", "Vomiting", "Neck stiffness"],
    duration: "Today", onset: "Sudden", severity: "Severe", bodyLocation: "Head",
    riskFactors: ["Smoking", "Hypertension"], medicalHistory: ["Hypertension"], familyHistory: ["Stroke"],
    examFindings: ["Neck stiffness", "Kernig sign"], vitals: { bp_systolic: 180, bp_diastolic: 100, pulse: 95, spo2: 97, temperature: 99.0, respiratory_rate: 20, weight_kg: 85, blood_sugar: null },
    chiefComplaint: "Headache",
  },
  {
    name: "Acute Coronary Syndrome",
    description: "Classic ACS presentation with risk factors",
    patient: { name: "Vijay Patel", age: 58, gender: "Male", location: "Ahmedabad", occupation: "Factory Manager", diet: "Non-vegetarian", allergies: [] },
    symptoms: ["Chest pain", "Sweating", "Palpitations", "Breathlessness"],
    duration: "Today", onset: "Sudden", severity: "Severe", bodyLocation: "Chest",
    riskFactors: ["Smoking", "Diabetes", "Hypertension"], medicalHistory: ["Diabetes mellitus", "Hypertension"], familyHistory: ["Heart disease"],
    examFindings: [], vitals: { bp_systolic: 150, bp_diastolic: 95, pulse: 110, spo2: 94, temperature: 98.6, respiratory_rate: 22, weight_kg: 90, blood_sugar: 180 },
    chiefComplaint: "Chest pain",
  },
  {
    name: "Musculoskeletal Chest Pain",
    description: "Benign chest wall pain",
    patient: { name: "Anita Desai", age: 28, gender: "Female", location: "Pune", occupation: "Teacher", diet: "Vegetarian", allergies: [] },
    symptoms: ["Chest pain"],
    duration: "3 days", onset: "Gradual", severity: "Mild", bodyLocation: "Chest",
    riskFactors: [], medicalHistory: [], familyHistory: [],
    examFindings: [], vitals: { bp_systolic: 110, bp_diastolic: 70, pulse: 72, spo2: 99, temperature: 98.2, respiratory_rate: 14, weight_kg: 55, blood_sugar: null },
    chiefComplaint: "Chest pain",
  },
  {
    name: "Appendicitis",
    description: "Acute appendicitis with classic RLQ pain",
    patient: { name: "Arjun Mehta", age: 22, gender: "Male", location: "Bangalore", occupation: "Student", diet: "Non-vegetarian", allergies: [] },
    symptoms: ["Abdominal pain", "Nausea", "Fever"],
    duration: "Today", onset: "Progressive", severity: "Severe", bodyLocation: "Right lower quadrant",
    riskFactors: [], medicalHistory: [], familyHistory: [],
    examFindings: ["Rebound tenderness", "Guarding"], vitals: { bp_systolic: 130, bp_diastolic: 80, pulse: 100, spo2: 99, temperature: 101.2, respiratory_rate: 18, weight_kg: 70, blood_sugar: null },
    chiefComplaint: "Abdominal pain",
  },
  {
    name: "Gastroenteritis",
    description: "Acute viral gastroenteritis",
    patient: { name: "Meera Nair", age: 30, gender: "Female", location: "Chennai", occupation: "Nurse", diet: "Vegetarian", allergies: [] },
    symptoms: ["Abdominal pain", "Vomiting", "Diarrhea"],
    duration: "2 days", onset: "Gradual", severity: "Moderate", bodyLocation: "Generalized",
    riskFactors: [], medicalHistory: [], familyHistory: [],
    examFindings: [], vitals: { bp_systolic: 100, bp_diastolic: 65, pulse: 90, spo2: 99, temperature: 100.4, respiratory_rate: 16, weight_kg: 58, blood_sugar: null },
    chiefComplaint: "Abdominal pain",
  },
  {
    name: "Pulmonary Embolism",
    description: "PE with acute dyspnea and tachycardia",
    patient: { name: "Sunita Reddy", age: 45, gender: "Female", location: "Hyderabad", occupation: "Accountant", diet: "Vegetarian", allergies: ["Penicillin"] },
    symptoms: ["Chest pain", "Breathlessness", "Palpitations"],
    duration: "Today", onset: "Sudden", severity: "Severe", bodyLocation: "Chest",
    riskFactors: ["Recent surgery", "Obesity"], medicalHistory: [], familyHistory: [],
    examFindings: [], vitals: { bp_systolic: 100, bp_diastolic: 60, pulse: 120, spo2: 91, temperature: 99.0, respiratory_rate: 28, weight_kg: 95, blood_sugar: null },
    chiefComplaint: "Breathlessness",
  },
  {
    name: "Community Pneumonia",
    description: "Community-acquired pneumonia",
    patient: { name: "Suresh Iyer", age: 65, gender: "Male", location: "Kolkata", occupation: "Retired", diet: "Vegetarian", allergies: [] },
    symptoms: ["Fever", "Cough", "Breathlessness", "Chest pain"],
    duration: "5 days", onset: "Progressive", severity: "Moderate", bodyLocation: "Chest",
    riskFactors: ["Smoking"], medicalHistory: ["COPD"], familyHistory: [],
    examFindings: ["Crepitations"], vitals: { bp_systolic: 130, bp_diastolic: 80, pulse: 95, spo2: 93, temperature: 102.0, respiratory_rate: 24, weight_kg: 72, blood_sugar: null },
    chiefComplaint: "Cough",
  },
];

// ── Vital ranges ──
const VITAL_RANGES: Record<string, { min?: number; max?: number; critMin?: number; critMax?: number }> = {
  bp_systolic: { min: 90, max: 140, critMin: 80, critMax: 180 },
  bp_diastolic: { min: 60, max: 90, critMin: 50, critMax: 120 },
  pulse: { min: 60, max: 100, critMin: 40, critMax: 150 },
  spo2: { min: 95, critMin: 90 },
  respiratory_rate: { min: 12, max: 20, critMax: 30 },
  temperature: { max: 99.4, critMax: 103.0 },
  blood_sugar: { min: 70, max: 140, critMin: 50, critMax: 300 },
};

type VitalStatus = "normal" | "abnormal" | "critical";
const getVitalStatus = (field: string, value: number | null | undefined): VitalStatus => {
  if (value == null) return "normal";
  const r = VITAL_RANGES[field];
  if (!r) return "normal";
  if ((r.critMin != null && value < r.critMin) || (r.critMax != null && value > r.critMax)) return "critical";
  if ((r.min != null && value < r.min) || (r.max != null && value > r.max)) return "abnormal";
  return "normal";
};

const vitalStatusColor = (s: VitalStatus) => {
  if (s === "critical") return "text-destructive bg-destructive/10 border-destructive/30 ring-1 ring-destructive/20";
  if (s === "abnormal") return "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30";
  return "text-foreground bg-muted/30 border-border";
};

// ── Comparison type ──
interface PipelineSnapshot {
  label: string;
  hypotheses: HypothesisEntry[];
  bayesian: any;
  soap: SoapSections;
  timestamp: number;
}

// ── Context Tree Node types ──
type ContextCategory = "chief_complaint" | "symptoms" | "modifiers" | "risk_factors" | "medical_history" | "family_history" | "exam_findings";

export default function CockpitPlayground() {
  const { toast } = useToast();

  // Patient demographics
  const [mockPatient, setMockPatient] = useState<Scenario["patient"] | null>(null);

  // Cockpit state
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedDuration, setSelectedDuration] = useState("");
  const [selectedOnset, setSelectedOnset] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("");
  const [selectedBodyLocation, setSelectedBodyLocation] = useState("");
  const [selectedRiskFactors, setSelectedRiskFactors] = useState<string[]>([]);
  const [selectedMedicalHistory, setSelectedMedicalHistory] = useState<string[]>([]);
  const [selectedFamilyHistory, setSelectedFamilyHistory] = useState<string[]>([]);
  const [selectedExamFindings, setSelectedExamFindings] = useState<string[]>([]);
  const [expansionSelections, setExpansionSelections] = useState<Record<string, string[]>>({});
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [patientVitals, setPatientVitals] = useState<any>(null);
  const [symptomSearch, setSymptomSearch] = useState("");

  // SOAP
  const [soapSections, setSoapSections] = useState<SoapSections>(EMPTY_SOAP);
  const [soapManualEdits, setSoapManualEdits] = useState<Record<string, boolean>>({});

  // Pipeline state
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);
  const [stageLatencies, setStageLatencies] = useState<Record<string, number>>({});

  // Copilot state
  const [pipelineHypotheses, setPipelineHypotheses] = useState<HypothesisEntry[]>([]);
  const [pipelineEvidence, setPipelineEvidence] = useState<PipelineEvidence | null>(null);
  const [pipelineCompliance, setPipelineCompliance] = useState<PipelineCompliance | null>(null);
  const [pipelinePhysiology, setPipelinePhysiology] = useState<any>(null);
  const [pipelineBayesian, setPipelineBayesian] = useState<any>(null);
  const [pipelineDDX, setPipelineDDX] = useState<any>(null);
  const [safetyResults, setSafetyResults] = useState<SafetyResults | null>(null);

  // ── RENDER SOURCE LOCK — single deterministic render path ──
  const [renderSource, setRenderSource] = useState<"none" | "bayesian">("none");
  const renderSourceRef = useRef<"none" | "bayesian">("none");

  // Copilot selections — bidirectional with Plan
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [selectedInstructions, setSelectedInstructions] = useState<string[]>([]);
  const [selectedMonitoring, setSelectedMonitoring] = useState<string[]>([]);
  const [pendingRx, setPendingRx] = useState<{ drug_name: string; dose: string; frequency: string; duration: string }[]>([]);

  // Scenario & comparison
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [reasoningLevel, setReasoningLevel] = useState<"doctor" | "explanation" | "debug">("doctor");
  const [snapshots, setSnapshots] = useState<PipelineSnapshot[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  // ── Sepsis Validation Tool state ──
  const [sepsisRunCount, setSepsisRunCount] = useState(0);
  const sepsisLastResultRef = useRef<Array<{ name: string; pct: number }> | null>(null);

  const [editingCategory, setEditingCategory] = useState<ContextCategory | null>(null);
  const [expandedDx, setExpandedDx] = useState<Set<string>>(new Set());
  const [showMoreDx, setShowMoreDx] = useState(false);

  // Command bar
  const [commandInput, setCommandInput] = useState("");

  // Pipeline run ref for debouncing
  const pipelineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pipelineRunIdRef = useRef(0);

  // ── Scenario loader ──
  const loadScenario = useCallback((scenarioName: string) => {
    const scenario = SCENARIOS.find(s => s.name === scenarioName);
    if (!scenario) return;
    setMockPatient(scenario.patient);
    setSelectedSymptoms(scenario.symptoms);
    setSelectedDuration(scenario.duration);
    setSelectedOnset(scenario.onset);
    setSelectedSeverity(scenario.severity);
    setSelectedBodyLocation(scenario.bodyLocation);
    setSelectedRiskFactors(scenario.riskFactors);
    setSelectedMedicalHistory(scenario.medicalHistory);
    setSelectedFamilyHistory(scenario.familyHistory);
    setSelectedExamFindings(scenario.examFindings);
    setPatientVitals(scenario.vitals);
    setChiefComplaint(scenario.chiefComplaint);
    setExpansionSelections({});
    setPipelineComplete(false);
     setPipelineHypotheses([]);
     setPipelineBayesian(null);
     setPipelineDDX(null);
     setRenderSource("none");
     setSoapSections(EMPTY_SOAP);
    setSoapManualEdits({});
    setSelectedDiagnoses([]);
    setSelectedTests([]);
    setSelectedInstructions([]);
    setSelectedMonitoring([]);
    setPendingRx([]);
    setSelectedScenario(scenarioName);
    setEditingCategory(null);
    toast({ title: `Loaded: ${scenarioName}`, description: scenario.description });
  }, [toast]);

  // ── Reset ──
  const resetCase = () => {
    setMockPatient(null);
    setSelectedSymptoms([]); setSelectedDuration(""); setSelectedOnset(""); setSelectedSeverity("");
    setSelectedBodyLocation(""); setSelectedRiskFactors([]); setSelectedMedicalHistory([]);
    setSelectedFamilyHistory([]); setSelectedExamFindings([]); setExpansionSelections({});
    setChiefComplaint(""); setPatientVitals(null); setSymptomSearch("");
    setSoapSections(EMPTY_SOAP); setSoapManualEdits({});
    setPipelineComplete(false); setPipelineRunning(false);
    setPipelineHypotheses([]); setPipelineEvidence(null); setPipelineCompliance(null);
    setPipelinePhysiology(null); setPipelineBayesian(null); setPipelineDDX(null); setSafetyResults(null);
    setRenderSource("none");
    setSelectedDiagnoses([]); setSelectedTests([]); setSelectedInstructions([]);
    setSelectedMonitoring([]); setPendingRx([]); setSelectedScenario(""); setSnapshots([]); setShowComparison(false);
    setPipelineStage(null); setStageLatencies({}); setEditingCategory(null);
    setCommandInput("");
  };

  // ── Generate SOAP Subjective from all selections ──
  const generatedSubjective = useMemo(() => {
    if (!mockPatient) return "";
    const parts: string[] = [];
    const age = mockPatient.age;
    const gender = mockPatient.gender?.toLowerCase();
    const genderLabel = gender === "male" ? "male" : gender === "female" ? "female" : gender || "patient";
    parts.push(`${age}-year-old ${genderLabel}`);
    if (chiefComplaint) parts.push(`presents with ${chiefComplaint.toLowerCase()}`);
    if (selectedDuration) parts.push(`since ${selectedDuration.toLowerCase()}`);
    if (selectedOnset) parts.push(`The onset is ${selectedOnset.toLowerCase()}`);
    if (selectedSeverity) parts.push(`${selectedSeverity.toLowerCase()} in intensity`);
    if (selectedBodyLocation) parts.push(`localized to ${selectedBodyLocation.toLowerCase()}`);
    const assocSymptoms = selectedSymptoms.filter(s => s.toLowerCase() !== chiefComplaint.toLowerCase());
    if (assocSymptoms.length > 0) parts.push(`Associated symptoms include ${assocSymptoms.join(", ").toLowerCase()}`);
    if (selectedRiskFactors.length > 0) parts.push(`Risk factors: ${selectedRiskFactors.join(", ").toLowerCase()}`);
    if (selectedMedicalHistory.length > 0) parts.push(`Past medical history: ${selectedMedicalHistory.join(", ")}`);
    if (selectedFamilyHistory.length > 0) parts.push(`Family history: ${selectedFamilyHistory.join(", ").toLowerCase()}`);
    if (mockPatient.allergies && mockPatient.allergies.length > 0) parts.push(`Known allergies: ${mockPatient.allergies.join(", ")}`);
    return parts.join(". ").replace(/\.\./g, ".") + ".";
  }, [mockPatient, chiefComplaint, selectedDuration, selectedOnset, selectedSeverity, selectedBodyLocation, selectedSymptoms, selectedRiskFactors, selectedMedicalHistory, selectedFamilyHistory]);

  // ── Generate SOAP Objective from vitals + exam ──
  const generatedObjective = useMemo(() => {
    const parts: string[] = [];
    if (patientVitals?.temperature) parts.push(`Temp: ${patientVitals.temperature}°F`);
    if (patientVitals?.bp_systolic) parts.push(`BP: ${patientVitals.bp_systolic}/${patientVitals.bp_diastolic} mmHg`);
    if (patientVitals?.pulse) parts.push(`HR: ${patientVitals.pulse} bpm`);
    if (patientVitals?.spo2) parts.push(`SpO₂: ${patientVitals.spo2}%`);
    if (patientVitals?.respiratory_rate) parts.push(`RR: ${patientVitals.respiratory_rate}/min`);
    if (patientVitals?.blood_sugar) parts.push(`Blood Sugar: ${patientVitals.blood_sugar} mg/dL`);
    if (selectedExamFindings.length > 0) parts.push(`\nExam findings: ${selectedExamFindings.join(", ")}`);
    return parts.join(" | ");
  }, [patientVitals, selectedExamFindings]);

  // ── Run pipeline ──
  const runPipeline = useCallback(async () => {
    if (selectedSymptoms.length === 0) return;
    const runId = ++pipelineRunIdRef.current;

    // Snapshot previous
    if (pipelineComplete && pipelineHypotheses.length > 0) {
      setSnapshots(prev => [...prev.slice(-2), {
        label: selectedScenario || "Custom",
        hypotheses: [...pipelineHypotheses],
        bayesian: pipelineBayesian ? JSON.parse(JSON.stringify(pipelineBayesian)) : null,
        soap: { ...soapSections },
        timestamp: Date.now(),
      }]);
    }

    setPipelineRunning(true);
    setPipelineComplete(false);
    setPipelineStage("context");
    setStageLatencies({});
    setRenderSource("none");
    renderSourceRef.current = "none";
    setPipelineBayesian(null);

    try {
      const { runUnifiedClinicalPipeline } = await import("@/services/clinical_pipeline/orchestrator");

      const baseContext = buildClinicalContext(
        { age: mockPatient?.age ?? 30, gender: mockPatient?.gender ?? "Unknown", medical_history: selectedMedicalHistory, allergies: mockPatient?.allergies || [], current_medications: [] },
        patientVitals, null,
      );

      // Apply UI overrides via typed builder — NO monkey-patching
      const pipelineContext = buildFullClinicalContext(baseContext, {
        chiefComplaint: chiefComplaint || undefined,
        symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : undefined,
        duration: selectedDuration || undefined,
        onset_pattern: selectedOnset || undefined,
        severity: selectedSeverity || undefined,
        body_location: selectedBodyLocation || undefined,
        risk_factors: selectedRiskFactors.length > 0 ? selectedRiskFactors : undefined,
        family_history: selectedFamilyHistory.length > 0 ? selectedFamilyHistory : undefined,
        exam_findings: selectedExamFindings.length > 0 ? selectedExamFindings : undefined,
        medical_history: selectedMedicalHistory.length > 0 ? selectedMedicalHistory : undefined,
        blood_sugar: patientVitals?.blood_sugar ?? undefined,
      });

      const result = await runUnifiedClinicalPipeline(
        {
          clinical_context: pipelineContext,
          visit_id: null, consultation_id: null, clinic_id: null,
          intake_approved: false,
          skip_cache: true, // FIX 4: Force deterministic execution — no cache path divergence
        },
        (stage, data) => {
          if (runId !== pipelineRunIdRef.current) return;
          setPipelineStage(stage);
          if (data.physiological_context) setPipelinePhysiology(data.physiological_context);
          // FIX 3: Block DDX overwrite after Bayesian lock
          if (data.ddx) {
            setPipelineDDX(prev => {
              if (renderSourceRef.current === "bayesian") {
                console.log("[LOCK] blocked late DDX overwrite");
                return prev;
              }
              return data.ddx;
            });
          }
          if (data.bayesian) {
            console.log("[BAYESIAN WRITE]", data.bayesian?.diagnoses?.length);
            setPipelineBayesian(prev => {
              if (prev && prev._locked) {
                console.log("[LOCK] blocked late bayesian overwrite");
                return prev;
              }
              // FIX 2: Snapshot DDX name map at Bayesian lock time
              const locked = { ...data.bayesian, _locked: true };
              setRenderSource("bayesian");
              renderSourceRef.current = "bayesian";
              console.log("[LOCK] bayesian + DDX names locked");
              return locked;
            });
          }
          if (data.hypotheses?.hypotheses) {
            setPipelineHypotheses(data.hypotheses.hypotheses.map((h: any) => ({
              diagnosis: h.hypothesis || h.diagnosis || h.diagnosis_name || "",
              confidence: h.probability || h.confidence || 0,
              supporting_factors: h.supporting_evidence || h.supporting_factors || [],
              contradicting_factors: h.contradicting_factors || [],
              recommended_tests: h.recommended_tests || [],
            })));
          }
          if (data.evidence) {
            setPipelineEvidence({
              citations: data.evidence.items?.map((i: any) => ({ title: i.title, source: i.source, year: i.year })) || [],
              sources_queried: [], retrieval_confidence: "moderate",
            });
          }
          if (data.guideline_alignment) {
            setPipelineCompliance({
              results: [], guidelines_matched: 0,
              guidelines_sources: data.guideline_alignment.guideline_sources_used || [],
              guideline_sources_used: data.guideline_alignment.guideline_sources_used || [],
              guideline_compliance_score: data.guideline_alignment.guideline_compliance_score || 0,
              conflicts_detected: (data.guideline_alignment.conflicts_detected || []).map((c: any) => ({
                recommendation: c.recommendation || c.prescribed_drug || "",
                conflicting_guideline: c.conflicting_guideline || c.guideline_recommends || "",
                organization: c.organization || c.source || "",
                severity: c.severity || "moderate", explanation: c.explanation || "",
              })),
            });
          }
          if (data.oversight) {
            setSafetyResults({
              normalized_drugs: [], interaction_flags: [], allergy_flags: [],
              dose_warnings: [], vitals_dangers: [], emergency_patterns: [],
              context_completeness: { issues: [], context_complete: true, ai_suggestions_blocked: false },
              confidence_level: "moderate", requires_manual_review: data.oversight.requires_review || false,
              ai_suggestions_blocked: false,
              output_policy: { label: AI_DRAFT_LABEL, conservative_language: true, evidence_required: true },
              timestamp: new Date().toISOString(),
            });
          }
          if (data.stage_latencies) setStageLatencies(prev => ({ ...prev, ...data.stage_latencies }));
        },
      );

      if (runId !== pipelineRunIdRef.current) return;

      if (result.enabled && result.hybrid_reasoning) {
        const soap = (result.hybrid_reasoning as any).soap;
        if (soap) {
          setSoapSections(prev => ({
            ...prev,
            ...(soapManualEdits["Visit Summary"] ? {} : { "Visit Summary": soap.subjective || "" }),
            ...(soapManualEdits["Findings"] ? {} : { "Findings": soap.objective || "" }),
            "Provisional Diagnosis": soap.assessment || "",
            "Safety Warnings": "",
            "Treatment Plan": soap.plan || "",
            "Advice": "", "Follow-up": "",
          }));
        }
        setStageLatencies(result.stage_latencies);
      }
      setPipelineStage("complete");
      setPipelineComplete(true);
    } catch (err: any) {
      if (runId !== pipelineRunIdRef.current) return;
      toast({ title: "Pipeline failed", description: err.message, variant: "destructive" });
    } finally {
      if (runId === pipelineRunIdRef.current) {
        setPipelineRunning(false);
        setTimeout(() => setPipelineStage(null), 2000);
      }
    }
  }, [selectedSymptoms, selectedDuration, selectedOnset, selectedSeverity, selectedBodyLocation, selectedRiskFactors, selectedMedicalHistory, selectedFamilyHistory, selectedExamFindings, chiefComplaint, mockPatient, patientVitals, pipelineComplete, pipelineHypotheses, pipelineBayesian, soapSections, selectedScenario, soapManualEdits]);

  // ── Auto-trigger pipeline on any context change ──
  const contextFingerprint = useMemo(() => JSON.stringify({
    symptoms: selectedSymptoms, duration: selectedDuration, onset: selectedOnset,
    severity: selectedSeverity, location: selectedBodyLocation, risks: selectedRiskFactors,
    history: selectedMedicalHistory, family: selectedFamilyHistory, exam: selectedExamFindings,
    vitals: patientVitals, cc: chiefComplaint,
  }), [selectedSymptoms, selectedDuration, selectedOnset, selectedSeverity, selectedBodyLocation, selectedRiskFactors, selectedMedicalHistory, selectedFamilyHistory, selectedExamFindings, patientVitals, chiefComplaint]);

  useEffect(() => {
    if (!mockPatient || selectedSymptoms.length === 0) return;
    if (pipelineTimerRef.current) clearTimeout(pipelineTimerRef.current);
    pipelineTimerRef.current = setTimeout(() => { runPipeline(); }, 1200);
    return () => { if (pipelineTimerRef.current) clearTimeout(pipelineTimerRef.current); };
  }, [contextFingerprint, mockPatient]);

  // Toggles
  const toggleSymptom = (s: string) => setSelectedSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const updateVital = (field: string, value: string) => {
    setPatientVitals((prev: any) => ({
      ...(prev || {}),
      [field]: value === "" ? null : isNaN(Number(value)) ? value : Number(value),
    }));
  };

  const filteredSymptoms = useMemo(() => {
    if (symptomSearch.length >= 1) {
      return COMMON_SYMPTOMS.filter(s => s.toLowerCase().includes(symptomSearch.toLowerCase()) && !selectedSymptoms.includes(s));
    }
    return [];
  }, [symptomSearch, selectedSymptoms]);

  const hasContext = selectedSymptoms.length > 0 || selectedDuration || selectedOnset || selectedSeverity || selectedBodyLocation || selectedRiskFactors.length > 0 || selectedMedicalHistory.length > 0 || selectedFamilyHistory.length > 0 || selectedExamFindings.length > 0;

  // ── Merged diagnoses for Assessment & Plan ──
  // ── Merged diagnoses — SINGLE SOURCE: Bayesian only ──
  const mergedDiagnoses = useMemo(() => {
    console.log("[RENDER SOURCE USED]", renderSource);

    // Only render when Bayesian is locked
    if (renderSource !== "bayesian" || !pipelineBayesian?.diagnoses?.length) return [];

    const ddxNameMap = new Map<string, { name: string; supporting: string[]; mustNotMiss: boolean }>();
    const ddxTraces: any[] = pipelineDDX?.reasoning_traces || [];
    const ddxDifferentials: any[] = pipelineDDX?.differential_diagnoses || [];

    ddxTraces.forEach((t: any) => {
      if (t.diagnosis_id && t.diagnosis) {
        ddxNameMap.set(t.diagnosis_id, {
          name: t.diagnosis,
          supporting: (t.symptom_evidence || []).map((e: any) => e.symptom || e),
          mustNotMiss: t.must_not_miss || false,
        });
      }
    });
    ddxDifferentials.forEach((dd: any) => {
      if (dd.diagnosis_id && dd.diagnosis_name && !ddxNameMap.has(dd.diagnosis_id)) {
        ddxNameMap.set(dd.diagnosis_id, {
          name: dd.diagnosis_name,
          supporting: dd.supporting_symptoms || [],
          mustNotMiss: dd.must_not_miss || false,
        });
      }
    });

    const ddxLabs: string[] = (pipelineDDX?.recommended_labs || []).map((l: any) => l.test_name);
    const ddxMeds: Array<{ drug: string; dose: string; route: string; freq: string; dur: string; line: "first" | "alternative" | "emergency"; forDiagnosis: string }> = [];
    (pipelineDDX?.suggested_medications || []).forEach((m: any) => {
      ddxMeds.push({
        drug: m.generic_name || m.drug_name || m.drug || "",
        dose: m.dose || "", route: m.route || "PO", freq: m.frequency || "", dur: m.duration || "",
        line: (m.line as any) || "first",
        forDiagnosis: m.for_diagnosis || "",
      });
    });

    return pipelineBayesian.diagnoses.slice(0, 8).map((d: any, idx: number) => {
      const ddxEntry = ddxNameMap.get(d.diagnosis_id);
      const hyp = pipelineHypotheses.find((h: any) => {
        const hName = (h.diagnosis || "").toLowerCase();
        return ddxEntry && hName === ddxEntry.name.toLowerCase();
      }) || pipelineHypotheses[idx];

      const displayName = ddxEntry?.name
        || hyp?.diagnosis
        || (d.supporting_evidence?.find((e: string) => !/^[0-9a-f]{8}-/.test(e)) || `Diagnosis ${idx + 1}`);

      const management = resolveManagement(displayName);
      const pipelineTests = hyp?.recommended_tests || [];
      const allTests = [...new Set([...ddxLabs, ...pipelineTests, ...management.tests])];

      const ddxMedsForDx = ddxMeds.filter(m => m.forDiagnosis.toLowerCase() === displayName.toLowerCase());
      const allMeds = management.medications.length > 0
        ? management.medications
        : ddxMedsForDx.map(m => ({ drug: m.drug, dose: m.dose, route: m.route, freq: m.freq, dur: m.dur, line: m.line }));

      return {
        name: displayName,
        pct: Math.round((d.posterior_probability || 0) * 100),
        supporting: [...new Set([
          ...(ddxEntry?.supporting || []),
          ...(d.supporting_evidence || []),
          ...(hyp?.supporting_factors || []),
        ])].filter(e => !/^[0-9a-f]{8}-/.test(e)),
        contradicting: hyp?.contradicting_factors || [],
        tests: allTests,
        medications: allMeds,
        mustNotMiss: ddxEntry?.mustNotMiss || d.must_not_miss || false,
        bayesian: d,
        instructions: management.instructions,
        monitoring: management.monitoring,
      };
    });
  }, [pipelineBayesian, pipelineHypotheses, pipelineDDX, renderSource]);

  // ── All recommended tests from DDX + pipeline + management engine ──
  const allRecommendedTests = useMemo(() => {
    const tests = new Set<string>();
    // Direct from DDX engine
    (pipelineDDX?.recommended_labs || []).forEach((l: any) => tests.add(l.test_name));
    mergedDiagnoses.forEach((d: any) => d.tests?.forEach((t: string) => tests.add(t)));
    pipelineHypotheses.forEach(h => h.recommended_tests?.forEach(t => tests.add(t)));
    return Array.from(tests);
  }, [mergedDiagnoses, pipelineHypotheses, pipelineDDX]);

  // ── All recommended medications from DDX + management engine ──
  const allRecommendedMedications = useMemo(() => {
    const seen = new Set<string>();
    const meds: Array<{ drug: string; dose: string; route: string; freq: string; dur: string; line: "first" | "alternative" | "emergency" }> = [];
    (pipelineDDX?.suggested_medications || []).forEach((m: any) => {
      const name = m.generic_name || m.drug_name || m.drug || "";
      if (name && !seen.has(name)) {
        seen.add(name);
        meds.push({ drug: name, dose: m.dose || "", route: m.route || "PO", freq: m.frequency || "", dur: m.duration || "", line: m.line || "first" });
      }
    });
    mergedDiagnoses.forEach((d: any) => {
      d.medications?.forEach((rx: any) => {
        if (!seen.has(rx.drug)) { seen.add(rx.drug); meds.push(rx); }
      });
    });
    return meds;
  }, [mergedDiagnoses, pipelineDDX]);

  // ── All patient instructions from management engine ──
  const allInstructions = useMemo(() => {
    const insts = new Set<string>();
    mergedDiagnoses.forEach((d: any) => {
      (d.instructions || []).forEach((i: string) => insts.add(i));
    });
    return Array.from(insts);
  }, [mergedDiagnoses]);

  // ── All monitoring parameters from management engine ──
  const allMonitoring = useMemo(() => {
    const mons = new Set<string>();
    mergedDiagnoses.forEach((d: any) => {
      (d.monitoring || []).forEach((m: string) => mons.add(m));
    });
    return Array.from(mons);
  }, [mergedDiagnoses]);

  // ── Plan sections derived from selections ──
  const planInvestigations = selectedTests;
  const planTreatments = pendingRx;

  // ── Command bar handler ──
  const handleCommand = useCallback(() => {
    if (!commandInput.trim()) return;
    const input = commandInput.trim().toLowerCase();
    // Simple NLP extraction for common patterns
    const symptomMatches = COMMON_SYMPTOMS.filter(s => input.includes(s.toLowerCase()));
    if (symptomMatches.length > 0) {
      setSelectedSymptoms(prev => [...new Set([...prev, ...symptomMatches])]);
      if (!chiefComplaint && symptomMatches.length > 0) {
        setChiefComplaint(symptomMatches[0]);
      }
    }
    // Extract severity
    for (const sev of SEVERITY_PRESETS) {
      if (input.includes(sev.toLowerCase())) { setSelectedSeverity(sev); break; }
    }
    // Extract onset
    for (const on of ONSET_PRESETS) {
      if (input.includes(on.toLowerCase())) { setSelectedOnset(on); break; }
    }
    setCommandInput("");
    toast({ title: "Context updated", description: `Extracted ${symptomMatches.length} signals from input` });
  }, [commandInput, chiefComplaint, toast]);

  // ── Sepsis Validation Test ──
  const runSepsisTest = useCallback(() => {
    const runNum = sepsisRunCount + 1;
    setSepsisRunCount(runNum);
    console.log(`\n=== SEPSIS TEST RUN #${runNum} ===`);

    // Step 1: Clean state
    setRenderSource("none");
    renderSourceRef.current = "none";
    setPipelineBayesian(null);
    setPipelineDDX(null);
    setPipelineHypotheses([]);
    setPipelineComplete(false);
    setSoapSections(EMPTY_SOAP);
    setSoapManualEdits({});
    setSelectedDiagnoses([]);
    setSelectedTests([]);
    setSelectedInstructions([]);
    setSelectedMonitoring([]);
    setPendingRx([]);
    setEditingCategory(null);

    // Step 2: Inject sepsis test case
    const sepsisPatient = {
      name: "Test Patient (Sepsis)", age: 58, gender: "Male",
      location: "Delhi", occupation: "Retired", diet: "Non-vegetarian",
      allergies: [] as string[], pregnancyStatus: undefined,
    };
    setMockPatient(sepsisPatient);
    setSelectedSymptoms(["Fever", "Dizziness", "Breathlessness"]);
    setChiefComplaint("Fever");
    setSelectedDuration("2 days");
    setSelectedOnset("Sudden");
    setSelectedSeverity("Severe");
    setSelectedBodyLocation("Generalized");
    setSelectedRiskFactors(["Diabetes", "Immunocompromised"]);
    setSelectedMedicalHistory(["Diabetes mellitus"]);
    setSelectedFamilyHistory([]);
    setSelectedExamFindings(["Pallor"]);
    setExpansionSelections({});
    setPatientVitals({
      bp_systolic: 92, bp_diastolic: 55, pulse: 112, spo2: 92,
      temperature: 103.6, respiratory_rate: 24, weight_kg: 75, blood_sugar: 220,
    });
    setSelectedScenario("Sepsis (Validation)");

    toast({ title: `Sepsis Test Run #${runNum}`, description: "Injecting sepsis scenario — pipeline will auto-trigger" });

    // Step 3: Log results when Bayesian arrives (via effect below)
  }, [sepsisRunCount, toast]);

  // ── Sepsis result logger + stability checker ──
  useEffect(() => {
    if (selectedScenario !== "Sepsis (Validation)" || !pipelineBayesian?.diagnoses?.length || renderSource !== "bayesian") return;

    const ddxTraces: any[] = pipelineDDX?.reasoning_traces || [];
    const ddxDiffs: any[] = pipelineDDX?.differential_diagnoses || [];
    const nameMap = new Map<string, string>();
    ddxTraces.forEach((t: any) => { if (t.diagnosis_id && t.diagnosis) nameMap.set(t.diagnosis_id, t.diagnosis); });
    ddxDiffs.forEach((d: any) => { if (d.diagnosis_id && d.diagnosis_name) nameMap.set(d.diagnosis_id, d.diagnosis_name); });

    const results = pipelineBayesian.diagnoses.slice(0, 8).map((d: any, i: number) => ({
      rank: i + 1,
      name: nameMap.get(d.diagnosis_id) || d.diagnosis_id,
      pct: Math.round((d.posterior_probability || 0) * 100),
    }));

    console.log("=== SEPSIS TEST RESULT ===");
    console.table(results.map((r: any) => ({ rank: r.rank, diagnosis: r.name, probability: r.pct + "%" })));

    // Check if sepsis is in top 5
    const sepsisIdx = results.findIndex((r: any) => /sepsis|septic/i.test(r.name));
    if (sepsisIdx === -1 || sepsisIdx >= 5) {
      console.warn("⚠️ WARNING: Sepsis NOT in top 5 diagnoses!");
    } else {
      console.log(`✅ Sepsis found at rank ${sepsisIdx + 1} with ${results[sepsisIdx].pct}%`);
    }

    // Stability comparison with previous run
    const prev = sepsisLastResultRef.current;
    if (prev) {
      console.log("=== STABILITY CHECK (vs previous run) ===");
      let hasRegression = false;
      results.forEach((r: any, i: number) => {
        const prevEntry = prev.find((p: any) => p.name === r.name);
        if (prevEntry) {
          const diff = Math.abs(r.pct - prevEntry.pct);
          if (diff > 5) {
            console.warn(`⚠️ SCORE DRIFT: ${r.name} — ${prevEntry.pct}% → ${r.pct}% (Δ${diff}%)`);
            hasRegression = true;
          }
        }
        const prevAtRank = prev[i];
        if (prevAtRank && prevAtRank.name !== r.name) {
          console.warn(`⚠️ RANK CHANGE at #${i + 1}: was "${prevAtRank.name}", now "${r.name}"`);
          hasRegression = true;
        }
      });
      if (!hasRegression) {
        console.log("✅ STABLE — rankings and scores match previous run");
      }
    }

    sepsisLastResultRef.current = results.map((r: any) => ({ name: r.name, pct: r.pct }));
  }, [pipelineBayesian, renderSource, selectedScenario, pipelineDDX]);

  useEffect(() => {
    if (mergedDiagnoses.length > 0) {
      const topNames = mergedDiagnoses.slice(0, 3).map((d: any) => d.name);
      setSelectedDiagnoses(topNames);
    }
  }, [mergedDiagnoses]);

  // ── SOAP auto-sync: regenerate Treatment Plan text from selections ──
  useEffect(() => {
    if (soapManualEdits["Treatment Plan"]) return;
    const parts: string[] = [];
    if (selectedTests.length > 0) {
      parts.push(`Investigations: ${selectedTests.join(", ")}.`);
    }
    if (pendingRx.length > 0) {
      const rxLines = pendingRx.map(rx => `${rx.drug_name} ${rx.dose} ${(rx as any).route || "PO"} ${rx.frequency}`).join("; ");
      parts.push(`Treatment: ${rxLines}.`);
    }
    if (selectedMonitoring.length > 0) {
      parts.push(`Monitoring: ${selectedMonitoring.join("; ")}.`);
    }
    if (selectedInstructions.length > 0) {
      parts.push(`Patient instructions: ${selectedInstructions.join(". ")}.`);
    }
    if (parts.length > 0) {
      setSoapSections(prev => ({ ...prev, "Treatment Plan": parts.join("\n") }));
    }
  }, [selectedTests, pendingRx, selectedInstructions, selectedMonitoring, soapManualEdits]);

  // ── Copilot props — wired tests/medications/monitoring, NO diagnoses ──
  const copilotProps = {
    diagnoses: [] as string[], selectedDiagnoses,
    onToggleDiagnosis: (d: string) => setSelectedDiagnoses(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]),
    tests: allRecommendedTests, selectedTests,
    onToggleTest: (t: string) => setSelectedTests(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]),
    medications: allRecommendedMedications, selectedMedications: pendingRx,
    onToggleMedication: (rx: any) => {
      if (pendingRx.some(p => p.drug_name === rx.drug)) {
        setPendingRx(prev => prev.filter(p => p.drug_name !== rx.drug));
      } else {
        setPendingRx(prev => [...prev, { drug_name: rx.drug, dose: rx.dose, frequency: rx.freq, duration: rx.dur, route: rx.route || "PO" }]);
      }
    },
    safetyResults: pendingRx.length > 0 ? safetyResults : null,
    patientAge: mockPatient?.age,
    allergies: mockPatient?.allergies || [],
    diagnosis: selectedDiagnoses[0],
    chiefComplaint,
    instructions: allInstructions, selectedInstructions,
    onToggleInstruction: (inst: string) => setSelectedInstructions(prev => prev.includes(inst) ? prev.filter(x => x !== inst) : [...prev, inst]),
    monitoring: allMonitoring, selectedMonitoring,
    onToggleMonitoring: (m: string) => setSelectedMonitoring(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]),
    pipelineEvidence, pipelineCompliance,
    visitId: null, consultationId: null, clinicId: null,
    pipelineStage: reasoningLevel !== "doctor" && pipelineRunning ? pipelineStage : null,
    stageLatencies,
    physiologicalContext: pipelinePhysiology,
    isAdmin: reasoningLevel === "debug",
  };

  // ── Likelihood badge ──
  const likelihoodBadge = (pct: number) => {
    if (pct >= 30) return <Badge className="text-[8px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">High</Badge>;
    if (pct >= 15) return <Badge className="text-[8px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">Moderate</Badge>;
    return <Badge variant="outline" className="text-[8px]">Low</Badge>;
  };

  // ── Context Tree Section Renderer ──
  const ContextTreeNode = ({ label, icon: Icon, items, color, category, editPresets, variant }: {
    label: string; icon: any; items: string[]; color: string; category: ContextCategory;
    editPresets: string[]; variant?: any;
  }) => {
    const isEditing = editingCategory === category;
    if (items.length === 0 && !isEditing) return null;

    return (
      <div className="group">
        <button
          onClick={() => setEditingCategory(isEditing ? null : category)}
          className="flex items-center gap-1.5 w-full text-left py-1.5 hover:bg-muted/50 rounded-lg px-2 transition-colors"
        >
          <Icon className={`h-3.5 w-3.5 ${color} shrink-0`} />
          <span className="text-xs font-semibold text-foreground flex-1">{label}</span>
          {items.length > 0 && <Badge variant="outline" className="text-[9px] h-5">{items.length}</Badge>}
          {isEditing ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
        </button>

        {/* Selected items as large chips */}
        {!isEditing && items.length > 0 && (
          <div className="ml-6 mt-1 flex flex-wrap gap-1.5 pb-1">
            {items.map(item => (
              <span key={item} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                category === "symptoms" ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" :
                category === "risk_factors" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" :
                category === "medical_history" || category === "family_history" ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20" :
                category === "exam_findings" ? "bg-destructive/10 text-destructive border-destructive/20" :
                "bg-muted text-foreground border-border"
              }`}>
                {item}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (category === "symptoms") toggleSymptom(item);
                    else if (category === "risk_factors") setSelectedRiskFactors(p => p.filter(x => x !== item));
                    else if (category === "medical_history") setSelectedMedicalHistory(p => p.filter(x => x !== item));
                    else if (category === "family_history") setSelectedFamilyHistory(p => p.filter(x => x !== item));
                    else if (category === "exam_findings") setSelectedExamFindings(p => p.filter(x => x !== item));
                  }}
                  className="text-muted-foreground hover:text-destructive transition-all"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Inline edit chips */}
        {isEditing && (
          <div className="ml-6 mt-1 pb-2">
            <div className="flex flex-wrap gap-1.5">
              {editPresets.map(preset => {
                const isSelected = items.includes(preset);
                return (
                  <Chip
                    key={preset}
                    variant={variant || "neutral"}
                    size="sm"
                    selected={isSelected}
                    onClick={() => {
                      if (category === "symptoms") toggleSymptom(preset);
                      else if (category === "risk_factors") setSelectedRiskFactors(p => p.includes(preset) ? p.filter(x => x !== preset) : [...p, preset]);
                      else if (category === "medical_history") setSelectedMedicalHistory(p => p.includes(preset) ? p.filter(x => x !== preset) : [...p, preset]);
                      else if (category === "family_history") setSelectedFamilyHistory(p => p.includes(preset) ? p.filter(x => x !== preset) : [...p, preset]);
                      else if (category === "exam_findings") setSelectedExamFindings(p => p.includes(preset) ? p.filter(x => x !== preset) : [...p, preset]);
                    }}
                  >
                    {preset}
                  </Chip>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Single-value tree node for modifiers ──
  const ModifierTreeNode = ({ label, value, presets, onSelect }: {
    label: string; value: string; presets: string[];
    onSelect: (v: string) => void;
  }) => {
    const category = label.toLowerCase().replace(/\s/g, "_") as ContextCategory;
    const isEditing = editingCategory === (category as any);
    if (!value && !isEditing) return null;

    return (
      <div className="group">
        <button
          onClick={() => setEditingCategory(isEditing ? null : category as any)}
          className="flex items-center gap-2 w-full text-left py-1 hover:bg-muted/50 rounded-lg px-2 transition-colors ml-4"
        >
          <span className="text-xs text-muted-foreground">{label}</span>
          {value && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground border border-border ml-auto">
              {value}
            </span>
          )}
          {!value && <span className="text-xs text-muted-foreground ml-auto">—</span>}
          {!isEditing && <Edit3 className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
        </button>

        {isEditing && (
          <div className="ml-8 mt-1 pb-1.5">
            <div className="flex flex-wrap gap-1.5">
              {presets.map(p => (
                <Chip key={p} variant="neutral" size="sm" selected={value === p}
                  onClick={() => { onSelect(value === p ? "" : p); setEditingCategory(null); }}
                >
                  {p}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <SEO title="Cockpit Playground — Admin" description="Test clinical cockpit UI with mock data" />

      <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-background">
        {/* ── Header ── */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Beaker className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-bold text-foreground">Clinical Cockpit</span>
            <Badge variant="outline" className="text-[10px]">Playground</Badge>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Reasoning Level Toggle */}
            <div className="flex items-center bg-muted rounded-full p-0.5 gap-0.5">
              {(["doctor", "explanation", "debug"] as const).map(level => (
                <button
                  key={level}
                  onClick={() => setReasoningLevel(level)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                    reasoningLevel === level
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {level === "doctor" ? "Doctor" : level === "explanation" ? "Explain" : "Debug"}
                </button>
              ))}
            </div>

            {pipelineRunning && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/5 border border-primary/10">
                <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />
                <span className="text-[10px] text-primary font-medium">{pipelineStage || "Running…"}</span>
              </div>
            )}

            {snapshots.length > 0 && (
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setShowComparison(!showComparison)}>
                <GitCompare className="h-2.5 w-2.5" /> Compare ({snapshots.length})
              </Button>
            )}

            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={resetCase}>
              <RotateCcw className="h-2.5 w-2.5" /> Reset
            </Button>
          </div>
        </div>

        {/* ── Scenario Selector ── */}
        <div className="shrink-0 px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Scenarios:</span>
            {SCENARIOS.map(s => (
              <Button
                key={s.name}
                variant={selectedScenario === s.name ? "default" : "outline"}
                size="sm"
                className="h-6 text-[10px] rounded-full"
                onClick={() => loadScenario(s.name)}
              >
                {s.name}
              </Button>
            ))}
          </div>
        </div>

        {/* ── Comparison overlay ── */}
        {showComparison && snapshots.length > 0 && (
          <div className="shrink-0 border-b border-border bg-card overflow-hidden">
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <GitCompare className="h-3.5 w-3.5 text-primary" /> Run Comparison
                </p>
                <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setShowComparison(false)}>Close</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {snapshots.map((snap, idx) => (
                  <div key={idx} className="rounded-lg border border-border p-2 bg-muted/20">
                    <p className="text-[10px] font-bold text-foreground mb-1">{snap.label} <span className="text-muted-foreground font-normal">({new Date(snap.timestamp).toLocaleTimeString()})</span></p>
                    {snap.hypotheses.slice(0, 5).map((h, hi) => (
                      <div key={hi} className="flex items-center justify-between text-[10px] py-0.5">
                        <span className="text-foreground truncate">{h.diagnosis}</span>
                        <Badge variant="outline" className="text-[9px]">{Math.round(h.confidence * 100)}%</Badge>
                      </div>
                    ))}
                  </div>
                ))}
                {pipelineComplete && pipelineHypotheses.length > 0 && (
                  <div className="rounded-lg border border-primary/20 p-2 bg-primary/5">
                    <p className="text-[10px] font-bold text-primary mb-1">Current Run</p>
                    {pipelineHypotheses.slice(0, 5).map((h, hi) => (
                      <div key={hi} className="flex items-center justify-between text-[10px] py-0.5">
                        <span className="text-foreground truncate">{h.diagnosis}</span>
                        <Badge variant="outline" className="text-[9px]">{Math.round(h.confidence * 100)}%</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ MAIN CONTENT — BALANCED 3 COLUMNS ══════════ */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3">

          {/* ═══ LEFT: Patient Context ═══ */}
          <div className="overflow-y-auto border-r border-border">
            <div className="p-3 space-y-3">

              {/* Empty state */}
              {!mockPatient ? (
                <ClinicalCard className="p-8">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="h-14 w-14 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
                      <Stethoscope className="h-7 w-7 text-primary/30" />
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">Select a Scenario</p>
                    <p className="text-xs text-muted-foreground">Choose a textbook case above to simulate a clinical consultation.</p>
                  </div>
                </ClinicalCard>
              ) : (
                <>
                  {/* SECTION 1: Patient Demographics */}
                  <ClinicalCard className="p-3">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {mockPatient.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{mockPatient.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[10px]">{mockPatient.age}y · {mockPatient.gender}</Badge>
                          {mockPatient.location && <Badge variant="outline" className="text-[10px]">{mockPatient.location}</Badge>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs border-t border-border pt-2.5">
                      {mockPatient.occupation && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Occupation</span><span className="text-foreground font-medium">{mockPatient.occupation}</span></div>
                      )}
                      {mockPatient.diet && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Diet</span><span className="text-foreground font-medium">{mockPatient.diet}</span></div>
                      )}
                      {mockPatient.allergies && mockPatient.allergies.length > 0 && (
                        <div className="col-span-2 flex items-center gap-1.5 mt-1">
                          <Shield className="h-3 w-3 text-destructive" />
                          <span className="text-[10px] text-destructive font-semibold">Allergies:</span>
                          {mockPatient.allergies.map(a => (
                            <Badge key={a} className="text-[9px] bg-destructive/10 text-destructive border-destructive/20">{a}</Badge>
                          ))}
                        </div>
                      )}
                      {mockPatient.pregnancyStatus && (
                        <div className="col-span-2 flex justify-between"><span className="text-muted-foreground">Pregnancy</span><span className="text-foreground font-medium">{mockPatient.pregnancyStatus}</span></div>
                      )}
                    </div>
                  </ClinicalCard>

                  {/* SECTION 2: Vitals (always visible) */}
                  <ClinicalCard className="p-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                      <HeartPulse className="h-3.5 w-3.5 text-primary" /> Vital Signs
                      {pipelineRunning && <Loader2 className="h-3 w-3 animate-spin text-primary ml-auto" />}
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { field: "bp_systolic", label: "BP", icon: Heart, isBp: true, unit: "mmHg" },
                        { field: "pulse", label: "HR", icon: Activity, unit: "bpm" },
                        { field: "spo2", label: "SpO₂", icon: Droplets, unit: "%" },
                        { field: "respiratory_rate", label: "RR", icon: Wind, unit: "/min" },
                        { field: "temperature", label: "Temp", icon: Thermometer, unit: "°F" },
                        { field: "weight_kg", label: "Wt", icon: User, unit: "kg" },
                        { field: "blood_sugar", label: "Sugar", icon: Activity, unit: "mg/dL" },
                      ].map(v => {
                        const status = v.isBp
                          ? (getVitalStatus("bp_systolic", patientVitals?.bp_systolic) === "critical" || getVitalStatus("bp_diastolic", patientVitals?.bp_diastolic) === "critical" ? "critical" : getVitalStatus("bp_systolic", patientVitals?.bp_systolic) === "abnormal" || getVitalStatus("bp_diastolic", patientVitals?.bp_diastolic) === "abnormal" ? "abnormal" : "normal")
                          : getVitalStatus(v.field, patientVitals?.[v.field]);
                        return (
                          <div key={v.field} className={`text-center p-2 rounded-lg border transition-all ${vitalStatusColor(status as VitalStatus)}`}>
                            <v.icon className={`h-3.5 w-3.5 mx-auto mb-1 ${status === "critical" ? "text-destructive" : status === "abnormal" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                            {v.isBp ? (
                              <div className="flex items-center justify-center gap-0.5">
                                <input type="number" value={patientVitals?.bp_systolic ?? ""} onChange={e => updateVital("bp_systolic", e.target.value)}
                                  className="w-7 text-center text-xs font-bold bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="—" />
                                <span className="text-[9px] text-muted-foreground">/</span>
                                <input type="number" value={patientVitals?.bp_diastolic ?? ""} onChange={e => updateVital("bp_diastolic", e.target.value)}
                                  className="w-7 text-center text-xs font-bold bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="—" />
                              </div>
                            ) : (
                              <input type="number" value={patientVitals?.[v.field] ?? ""} onChange={e => updateVital(v.field, e.target.value)}
                                className="w-full text-center text-xs font-bold bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="—" />
                            )}
                            <p className="text-[8px] mt-0.5 font-medium text-muted-foreground">{v.label} ({v.unit})</p>
                          </div>
                        );
                      })}
                    </div>
                  </ClinicalCard>

                  {/* SECTION 3: Clinical Context Tree */}
                  <ClinicalCard className="p-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                      <TreePine className="h-3.5 w-3.5 text-primary" /> Clinical Context
                    </p>

                    {/* Chief Complaint — editable inline */}
                    <div className="flex items-center gap-2 py-2 px-2.5 rounded-lg bg-primary/[0.04] border border-primary/10 mb-3">
                      <Brain className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs text-muted-foreground shrink-0">Chief Complaint</span>
                      <input
                        type="text"
                        value={chiefComplaint}
                        onChange={e => setChiefComplaint(e.target.value)}
                        placeholder="Enter chief complaint…"
                        className="flex-1 text-sm font-semibold text-foreground bg-transparent border-none outline-none text-right placeholder:text-muted-foreground/50 placeholder:font-normal"
                      />
                    </div>

                    <div className="space-y-1">
                      <ContextTreeNode label="Symptoms" icon={Stethoscope} items={selectedSymptoms} color="text-blue-600 dark:text-blue-400" category="symptoms" editPresets={COMMON_SYMPTOMS} variant="symptom" />

                      {/* Modifiers */}
                      {(selectedDuration || selectedOnset || selectedSeverity || selectedBodyLocation) && (
                        <div className="mt-2">
                          <div className="flex items-center gap-1.5 py-1.5 px-2">
                            <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs font-semibold text-foreground">Modifiers</span>
                          </div>
                          <ModifierTreeNode label="Duration" value={selectedDuration} presets={DURATION_PRESETS} onSelect={setSelectedDuration} />
                          <ModifierTreeNode label="Onset" value={selectedOnset} presets={ONSET_PRESETS} onSelect={setSelectedOnset} />
                          <ModifierTreeNode label="Severity" value={selectedSeverity} presets={SEVERITY_PRESETS} onSelect={setSelectedSeverity} />
                          <ModifierTreeNode label="Location" value={selectedBodyLocation} presets={BODY_LOCATION_PRESETS} onSelect={setSelectedBodyLocation} />
                        </div>
                      )}

                      <ContextTreeNode label="Risk Factors" icon={AlertTriangle} items={selectedRiskFactors} color="text-amber-600 dark:text-amber-400" category="risk_factors" editPresets={RISK_FACTOR_PRESETS} variant="alert" />
                      <ContextTreeNode label="Past Medical History" icon={FileText} items={selectedMedicalHistory} color="text-purple-600 dark:text-purple-400" category="medical_history" editPresets={MEDICAL_HISTORY_PRESETS} variant="diagnosis" />
                      <ContextTreeNode label="Family History" icon={User} items={selectedFamilyHistory} color="text-purple-500 dark:text-purple-300" category="family_history" editPresets={FAMILY_HISTORY_PRESETS} />
                      <ContextTreeNode label="Exam Findings" icon={Eye} items={selectedExamFindings} color="text-destructive" category="exam_findings" editPresets={EXAM_FINDINGS_PRESETS} variant="alert" />
                    </div>

                    {/* Quick add if no context yet */}
                    {!hasContext && (
                      <div className="mt-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Quick Add Symptoms</p>
                        <div className="flex flex-wrap gap-1.5">
                          {COMMON_SYMPTOMS.slice(0, 12).map(s => (
                            <Chip key={s} variant="symptom" size="sm" onClick={() => toggleSymptom(s)}>{s}</Chip>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Symptom search */}
                    <div className="relative mt-3">
                      <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-border bg-background focus-within:ring-1 focus-within:ring-primary/30">
                        <Search className="h-3.5 w-3.5 text-muted-foreground" />
                        <input type="text" value={symptomSearch} onChange={e => setSymptomSearch(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && symptomSearch.trim()) { toggleSymptom(symptomSearch.trim()); setSymptomSearch(""); } }}
                          placeholder="Search or add symptom…"
                          className="flex-1 text-xs bg-transparent border-none outline-none"
                        />
                      </div>
                      {filteredSymptoms.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-0.5 bg-popover border border-border rounded-lg shadow-md z-10 max-h-32 overflow-y-auto">
                          {filteredSymptoms.map(s => (
                            <button key={s} className="w-full text-left px-2.5 py-1.5 text-xs text-foreground hover:bg-muted transition-colors" onClick={() => { toggleSymptom(s); setSymptomSearch(""); }}>{s}</button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add modifiers prompt */}
                    {selectedSymptoms.length > 0 && !selectedDuration && !selectedOnset && !selectedSeverity && !selectedBodyLocation && (
                      <div className="mt-3 p-2.5 rounded-lg bg-muted/30 border border-border">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Add Modifiers</p>
                        <div className="space-y-2">
                          <ChipGroup label="Duration">
                            {DURATION_PRESETS.map(d => <Chip key={d} variant="neutral" size="sm" onClick={() => setSelectedDuration(d)}>{d}</Chip>)}
                          </ChipGroup>
                          <ChipGroup label="Onset">
                            {ONSET_PRESETS.map(o => <Chip key={o} variant="neutral" size="sm" onClick={() => setSelectedOnset(o)}>{o}</Chip>)}
                          </ChipGroup>
                          <ChipGroup label="Severity">
                            {SEVERITY_PRESETS.map(s => <Chip key={s} variant={s === "Severe" || s === "Worsening" ? "alert" : "neutral"} size="sm" onClick={() => setSelectedSeverity(s)}>{s}</Chip>)}
                          </ChipGroup>
                        </div>
                      </div>
                    )}
                  </ClinicalCard>
                </>
              )}
            </div>
          </div>

          {/* ═══ CENTER: SOAP Output ═══ */}
          <div className="overflow-y-auto border-r border-border">
            {mockPatient && (
              <div className="p-4 space-y-4">
                <ClinicalCard className="p-4 border-primary/15">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Clinical Note</span>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <AiDisclosureBadge label="AI Draft" tooltip="Generated by AI pipeline" />
                      {pipelineComplete && (
                        <Badge className="text-[9px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                          <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Complete
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-5">
                    {/* ── Subjective ── */}
                    <div className="rounded-xl border p-3.5 bg-primary/[0.03] border-primary/15">
                      <div className="flex items-center gap-1.5 mb-2">
                        <User className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-bold uppercase tracking-wide text-primary">Subjective (HPI)</span>
                      </div>
                      <Textarea
                        value={soapManualEdits["Visit Summary"] ? soapSections["Visit Summary"] : (soapSections["Visit Summary"] || generatedSubjective)}
                        onChange={e => {
                          setSoapSections(prev => ({ ...prev, "Visit Summary": e.target.value }));
                          setSoapManualEdits(prev => ({ ...prev, "Visit Summary": true }));
                        }}
                        rows={4}
                        className="text-xs min-h-[60px] resize-y rounded-lg bg-background/80 border-none shadow-sm leading-relaxed"
                      />
                    </div>

                    {/* ── Objective ── */}
                    <div className="rounded-xl border p-3.5 bg-emerald-500/5 border-emerald-500/15">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Eye className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Objective</span>
                      </div>
                      <Textarea
                        value={soapManualEdits["Findings"] ? soapSections["Findings"] : (soapSections["Findings"] || generatedObjective)}
                        onChange={e => {
                          setSoapSections(prev => ({ ...prev, "Findings": e.target.value }));
                          setSoapManualEdits(prev => ({ ...prev, "Findings": true }));
                        }}
                        rows={2}
                        className="text-xs min-h-[32px] resize-y rounded-lg bg-background/80 border-none shadow-sm"
                      />
                    </div>

                    {/* ── Assessment (Differential Diagnoses) ── */}
                    <div className="rounded-xl border p-3.5 bg-amber-500/5 border-amber-500/15">
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <Brain className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Assessment</span>
                      </div>

                      {mergedDiagnoses.length > 0 ? (
                        <div className="space-y-2">
                          {/* Primary Diagnosis */}
                          {mergedDiagnoses.slice(0, 1).map((d: any, i: number) => {
                            const isExpanded = expandedDx.has(d.name);
                            return (
                            <div key={i}>
                              <p className="text-[9px] font-bold text-primary uppercase tracking-wider mb-1.5">Primary Diagnosis</p>
                              <button
                                onClick={() => setExpandedDx(prev => { const n = new Set(prev); n.has(d.name) ? n.delete(d.name) : n.add(d.name); return n; })}
                                className="w-full text-left rounded-lg border border-primary/20 p-3 bg-primary/[0.03] hover:bg-primary/[0.05] transition-colors"
                              >
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-sm font-bold text-foreground flex-1">{d.name}</span>
                                  {likelihoodBadge(d.pct)}
                                  <Badge variant="outline" className="text-[10px] font-mono">{d.pct}%</Badge>
                                  {d.mustNotMiss && <Badge className="text-[8px] bg-destructive/10 text-destructive border-destructive/20">⚠ Must not miss</Badge>}
                                  {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                                </div>
                                <div className="h-1.5 rounded-full bg-muted">
                                  <div className={`h-full rounded-full transition-all ${d.pct >= 30 ? "bg-emerald-500" : d.pct >= 15 ? "bg-amber-500" : "bg-muted-foreground/30"}`} style={{ width: `${Math.min(d.pct, 100)}%` }} />
                                </div>
                              </button>
                              {isExpanded && (
                                <div className="mt-1.5 rounded-lg border border-border p-2.5 bg-muted/20 space-y-2">
                                  {d.supporting.length > 0 && (
                                    <div>
                                      <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1">Supporting Evidence</p>
                                      <div className="flex flex-wrap gap-1">
                                        {d.supporting.map((e: string, ei: number) => (
                                          <span key={ei} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">✓ {e}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {d.contradicting.length > 0 && (
                                    <div>
                                      <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1">Against</p>
                                      <div className="flex flex-wrap gap-1">
                                        {d.contradicting.map((e: string, ei: number) => (
                                          <span key={ei} className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">✗ {e}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {reasoningLevel === "explanation" && d.bayesian && (
                                    <div className="p-2 rounded-lg bg-muted/30 border border-border">
                                      <p className="text-[9px] text-muted-foreground font-semibold uppercase mb-1">Modifier Contributions</p>
                                      <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-[10px] font-mono">
                                        {d.bayesian.onset_modifier != null && d.bayesian.onset_modifier !== 1 && <span>Onset: ×{d.bayesian.onset_modifier?.toFixed(2)}</span>}
                                        {d.bayesian.duration_modifier != null && d.bayesian.duration_modifier !== 1 && <span>Duration: ×{d.bayesian.duration_modifier?.toFixed(2)}</span>}
                                        {d.bayesian.risk_modifier != null && d.bayesian.risk_modifier !== 1 && <span>Risk: ×{d.bayesian.risk_modifier?.toFixed(2)}</span>}
                                        {d.bayesian.cluster_modifier != null && d.bayesian.cluster_modifier !== 1 && <span>Cluster: ×{d.bayesian.cluster_modifier?.toFixed(2)}</span>}
                                        {d.bayesian.vital_modifier != null && d.bayesian.vital_modifier !== 1 && <span>Vitals: ×{d.bayesian.vital_modifier?.toFixed(2)}</span>}
                                      </div>
                                    </div>
                                  )}
                                  {reasoningLevel === "debug" && d.bayesian && (
                                    <div className="p-2 rounded-lg bg-muted/40 border border-border font-mono text-[9px] space-y-0.5">
                                      <p className="font-semibold text-muted-foreground uppercase text-[8px]">Bayesian Breakdown</p>
                                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                        <span>Prior: {d.bayesian.prior?.toFixed(4)}</span>
                                        <span>Symptom LH: {d.bayesian.symptom_likelihood?.toFixed(4)}</span>
                                        <span>Onset: ×{d.bayesian.onset_modifier?.toFixed(3)}</span>
                                        <span>Duration: ×{d.bayesian.duration_modifier?.toFixed(3)}</span>
                                        <span>Risk: ×{d.bayesian.risk_modifier?.toFixed(3)}</span>
                                        <span>Vital: ×{d.bayesian.vital_modifier?.toFixed(3)}</span>
                                        <span className="col-span-2 font-bold text-primary">Posterior: {d.bayesian.posterior_probability?.toFixed(4)}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )})}

                          {/* Working Differentials */}
                          {mergedDiagnoses.filter((d: any) => !d.mustNotMiss).slice(1, 3).length > 0 && (
                            <div>
                              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 mt-2">Working Differentials</p>
                              <div className="space-y-1.5">
                                {mergedDiagnoses.filter((d: any) => !d.mustNotMiss).slice(1, 3).map((d: any, i: number) => {
                                  const isExpanded = expandedDx.has(d.name);
                                  return (
                                  <div key={i}>
                                    <button
                                      onClick={() => setExpandedDx(prev => { const n = new Set(prev); n.has(d.name) ? n.delete(d.name) : n.add(d.name); return n; })}
                                      className="w-full text-left rounded-lg border border-border p-2.5 bg-background/60 hover:bg-muted/50 transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-foreground flex-1">{d.name}</span>
                                        {likelihoodBadge(d.pct)}
                                        <span className="text-xs font-mono text-muted-foreground">{d.pct}%</span>
                                        {isExpanded ? <ChevronUp className="h-2.5 w-2.5 text-muted-foreground" /> : <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />}
                                      </div>
                                      <div className="h-1 rounded-full bg-muted mt-1">
                                        <div className={`h-full rounded-full ${d.pct >= 30 ? "bg-emerald-500" : d.pct >= 15 ? "bg-amber-500" : "bg-muted-foreground/30"}`} style={{ width: `${Math.min(d.pct, 100)}%` }} />
                                      </div>
                                    </button>
                                    {isExpanded && d.supporting.length > 0 && (
                                      <div className="mt-1 ml-3 flex flex-wrap gap-1">
                                        {d.supporting.slice(0, 4).map((e: string, ei: number) => (
                                          <span key={ei} className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">✓ {e}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )})}
                              </div>
                            </div>
                          )}

                          {/* Show more toggle for additional differentials */}
                          {mergedDiagnoses.filter((d: any) => !d.mustNotMiss).length > 3 && (
                            <button
                              onClick={() => setShowMoreDx(prev => !prev)}
                              className="text-[10px] text-primary font-medium hover:underline flex items-center gap-1 mt-1"
                            >
                              {showMoreDx ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              {showMoreDx ? "Show less" : `Show ${mergedDiagnoses.filter((d: any) => !d.mustNotMiss).length - 3} more`}
                            </button>
                          )}
                          {showMoreDx && mergedDiagnoses.filter((d: any) => !d.mustNotMiss).slice(3).map((d: any, i: number) => (
                            <div key={`more-${i}`} className="rounded-lg border border-border p-2 bg-background/40">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-foreground flex-1">{d.name}</span>
                                <span className="text-[10px] font-mono text-muted-foreground">{d.pct}%</span>
                              </div>
                            </div>
                          ))}

                          {/* Must-Not-Miss */}
                          {mergedDiagnoses.filter((d: any) => d.mustNotMiss && mergedDiagnoses.indexOf(d) > 0).length > 0 && (
                            <div>
                              <p className="text-[9px] font-bold text-destructive uppercase tracking-wider mb-1.5 mt-2 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Must Not Miss
                              </p>
                              <div className="space-y-1.5">
                                {mergedDiagnoses.filter((d: any) => d.mustNotMiss && mergedDiagnoses.indexOf(d) > 0).map((d: any, i: number) => (
                                  <div key={i} className="rounded-lg border border-destructive/30 p-2.5 bg-destructive/5">
                                    <div className="flex items-center gap-2">
                                      <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                                      <span className="text-xs font-semibold text-destructive flex-1">{d.name}</span>
                                      <span className="text-xs font-mono text-destructive">{d.pct}%</span>
                                    </div>
                                    {d.supporting.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5 ml-5">
                                        {d.supporting.slice(0, 3).map((e: string, ei: number) => (
                                          <span key={ei} className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">✓ {e}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          {pipelineRunning ? "Generating differential…" : "Add symptoms to generate differential diagnoses."}
                        </p>
                      )}
                    </div>

                    {/* ── Plan (Structured subsections) ── */}
                    <div className="rounded-xl border p-3.5 bg-purple-500/5 border-purple-500/15">
                      <div className="flex items-center gap-1.5 mb-3">
                        <ClipboardCheck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        <span className="text-xs font-bold uppercase tracking-wide text-purple-700 dark:text-purple-400">Plan</span>
                      </div>

                      {/* Investigations */}
                      <div className="mb-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                          <FlaskConical className="h-3 w-3" /> Investigations
                        </p>
                        {planInvestigations.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {planInvestigations.map(t => (
                              <Chip key={t} variant="lab" size="sm" selected
                                onClick={() => setSelectedTests(prev => prev.filter(x => x !== t))}>
                                ✓ {t}
                              </Chip>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Select investigations from AI Copilot →</p>
                        )}
                      </div>

                      {/* Treatment — with Drug/Dose/Route/Freq format */}
                      <div className="mb-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                          <Pill className="h-3 w-3" /> Treatment
                        </p>
                        {planTreatments.length > 0 ? (
                          <div className="space-y-1.5">
                            {planTreatments.map((rx, i) => (
                              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-foreground">{rx.drug_name}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {rx.dose} {(rx as any).route ? `${(rx as any).route} ` : ""}{rx.frequency} × {rx.duration}
                                  </p>
                                </div>
                                <button onClick={() => setPendingRx(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive shrink-0"><X className="h-3.5 w-3.5" /></button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Select prescriptions from AI Copilot →</p>
                        )}
                      </div>

                      {/* Monitoring & Follow-up — selected only */}
                      <div className="mb-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                          <Activity className="h-3 w-3" /> Monitoring & Follow-up
                        </p>
                        {selectedMonitoring.length > 0 ? (
                          <div className="space-y-1">
                            {selectedMonitoring.map((m, i) => (
                              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs">
                                <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="flex-1 text-foreground">{m}</span>
                                <button onClick={() => setSelectedMonitoring(prev => prev.filter(x => x !== m))} className="text-muted-foreground hover:text-destructive shrink-0"><X className="h-3 w-3" /></button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            {allMonitoring.length > 0 ? "Select monitoring from AI Copilot →" : "Monitoring parameters will appear after diagnosis."}
                          </p>
                        )}
                      </div>

                      {/* Patient Instructions */}
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> Instructions to Patient
                        </p>
                        {selectedInstructions.length > 0 ? (
                          <div className="space-y-1">
                            {selectedInstructions.map((inst, i) => (
                              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs">
                                <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="flex-1 text-foreground">{inst}</span>
                                <button onClick={() => setSelectedInstructions(prev => prev.filter(x => x !== inst))} className="text-muted-foreground hover:text-destructive shrink-0"><X className="h-3 w-3" /></button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            {allInstructions.length > 0 ? "Select instructions from AI Copilot →" : "Instructions will appear after diagnosis."}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </ClinicalCard>

                {/* Debug: Stage Latencies */}
                {reasoningLevel === "debug" && Object.keys(stageLatencies).length > 0 && (
                  <ClinicalCard className="p-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                      <Zap className="h-3 w-3" /> Pipeline Latency
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {Object.entries(stageLatencies).map(([stage, ms]) => (
                        <span key={stage} className="text-[10px] font-mono text-muted-foreground">
                          {stage}: <span className={`font-semibold ${(ms as number) > 3000 ? "text-destructive" : "text-foreground"}`}>{ms as number}ms</span>
                        </span>
                      ))}
                    </div>
                  </ClinicalCard>
                )}
              </div>
            )}
          </div>

          {/* ═══ RIGHT: AI Copilot ═══ */}
          <div className="overflow-y-auto bg-card/30 hidden lg:block">
            <div className="p-3 space-y-2.5">
              <div className="flex items-center gap-2 px-0.5">
                <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center relative">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  {pipelineComplete && <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
                </div>
                <span className="text-sm font-semibold text-foreground">AI Copilot</span>
                <Badge className={`text-[10px] ml-auto ${pipelineComplete ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground border-border"}`}>
                  {pipelineComplete ? "Active" : pipelineRunning ? "Running" : "Idle"}
                </Badge>
              </div>
              {mockPatient && <ClinicalCopilot {...copilotProps} />}
            </div>
          </div>
        </div>

        {/* ══════════ COMMAND BAR ══════════ */}
        {mockPatient && (
          <div className="shrink-0 border-t border-border bg-card px-4 py-2.5">
            <div className="flex items-center gap-2.5 max-w-4xl mx-auto rounded-xl border border-border bg-background px-4 py-2 shadow-sm">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={commandInput}
                onChange={e => setCommandInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCommand(); }}
                placeholder="Type clinical notes, symptoms, or ask AI…"
                className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground"
              />
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary" title="Voice input">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
