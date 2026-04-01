/**
 * Contradiction Detection Engine
 *
 * Penalizes diagnoses based on:
 *   - Missing key symptoms (expected but absent)
 *   - Demographic mismatch (age/sex)
 *   - Conflicting clinical signals
 *
 * NEVER fully eliminates must-not-miss diagnoses — only applies bounded penalty.
 * Pure function, no side effects.
 */

import { clamp } from "./scoring_utils";

export interface ContradictionInput {
  diagnosis_name: string;
  supporting_symptoms: string[];
  patient_symptoms: string[];
  patient_age?: number | null;
  patient_sex?: string | null;
  vitals?: {
    temperature?: number;
    pulse?: number;
    bp_systolic?: number;
    spo2?: number;
  };
  must_not_miss: boolean;
}

export interface ContradictionResult {
  penalty: number;           // 0 = no penalty, up to 0.5 max
  contradictions: string[];  // Human-readable explanations
  missing_key_symptoms: string[];
  demographic_mismatch: boolean;
}

// ── Key symptom expectations per diagnosis ──

const KEY_SYMPTOMS: Record<string, string[]> = {
  "myocardial infarction":   ["chest pain", "diaphoresis"],
  "pulmonary embolism":      ["dyspnea", "shortness of breath"],
  "stroke":                  ["weakness", "speech", "facial droop", "confusion"],
  "meningitis":              ["fever", "neck stiffness", "headache"],
  "appendicitis":            ["abdominal pain", "nausea"],
  "pneumonia":               ["cough", "fever"],
  "sepsis":                  ["fever", "tachycardia"],
  "diabetic ketoacidosis":   ["polyuria", "polydipsia", "nausea"],
  "anaphylaxis":             ["rash", "urticaria", "dyspnea", "swelling"],
  "aortic dissection":       ["chest pain", "back pain", "tearing"],
  "testicular torsion":      ["scrotal pain", "testicular pain"],
  "cauda equina syndrome":   ["back pain", "urinary", "weakness"],
};

// ── Demographic constraints ──

const DEMOGRAPHIC_RULES: Array<{
  diagnosis: string;
  constraint: (age?: number | null, sex?: string | null) => boolean;
  reason: string;
}> = [
  { diagnosis: "testicular torsion", constraint: (_, sex) => sex === "female", reason: "Female patient — testicular torsion anatomically impossible" },
  { diagnosis: "ectopic pregnancy", constraint: (_, sex) => sex === "male", reason: "Male patient — ectopic pregnancy impossible" },
  { diagnosis: "pre-eclampsia", constraint: (_, sex) => sex === "male", reason: "Male patient — pre-eclampsia impossible" },
  { diagnosis: "ovarian torsion", constraint: (_, sex) => sex === "male", reason: "Male patient — ovarian torsion impossible" },
  { diagnosis: "pyloric stenosis", constraint: (age) => !!age && age > 5, reason: "Age >5 — pyloric stenosis primarily neonatal" },
  { diagnosis: "kawasaki disease", constraint: (age) => !!age && age > 10, reason: "Age >10 — Kawasaki disease rare in older children" },
  { diagnosis: "retinoblastoma", constraint: (age) => !!age && age > 8, reason: "Age >8 — retinoblastoma extremely rare" },
];

/**
 * Evaluate contradictions for a diagnosis candidate.
 * Returns penalty (0–0.5) and explanation.
 */
export function evaluateContradictions(input: ContradictionInput): ContradictionResult {
  const contradictions: string[] = [];
  const missingKey: string[] = [];
  let penalty = 0;
  let demographicMismatch = false;

  const diagLower = input.diagnosis_name.toLowerCase().trim();
  const symptomSet = new Set(input.patient_symptoms.map(s => s.toLowerCase().trim()));

  // 1. Missing key symptoms
  const expected = KEY_SYMPTOMS[diagLower];
  if (expected) {
    for (const key of expected) {
      const found = [...symptomSet].some(s => s.includes(key));
      if (!found) {
        missingKey.push(key);
      }
    }
    if (missingKey.length > 0 && expected.length > 0) {
      const missingRatio = missingKey.length / expected.length;
      // Penalty scales: missing 1/3 key symptoms = 0.1, missing all = 0.3
      const missingPenalty = missingRatio * 0.3;
      penalty += missingPenalty;
      contradictions.push(`Missing ${missingKey.length}/${expected.length} key symptoms: ${missingKey.join(", ")}`);
    }
  }

  // 2. Demographic rules
  for (const rule of DEMOGRAPHIC_RULES) {
    if (diagLower === rule.diagnosis && rule.constraint(input.patient_age, input.patient_sex)) {
      demographicMismatch = true;
      penalty += 0.4;
      contradictions.push(rule.reason);
    }
  }

  // 3. Vital sign contradictions
  if (input.vitals) {
    // Sepsis without fever or tachycardia
    if (diagLower === "sepsis" && input.vitals.temperature && input.vitals.temperature < 37.5 && input.vitals.pulse && input.vitals.pulse < 90) {
      penalty += 0.15;
      contradictions.push("Normal temperature + pulse — atypical for sepsis");
    }
    // PE with normal SpO2 is possible but reduces confidence
    if (diagLower === "pulmonary embolism" && input.vitals.spo2 && input.vitals.spo2 > 97) {
      penalty += 0.05;
      contradictions.push("Normal SpO2 — less typical for PE (but possible)");
    }
  }

  // Cap penalty for MNM diagnoses — never fully eliminate
  const maxPenalty = input.must_not_miss ? 0.3 : 0.5;
  penalty = clamp(penalty, 0, maxPenalty);

  return { penalty, contradictions, missing_key_symptoms: missingKey, demographic_mismatch: demographicMismatch };
}
