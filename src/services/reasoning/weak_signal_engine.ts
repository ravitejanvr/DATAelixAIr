/**
 * Weak Signal Engine
 *
 * Handles incomplete presentations, vague symptoms, and atypical cases.
 * Boosts candidates that have partial but coherent signal alignment,
 * especially for rare and high-risk conditions.
 *
 * Pure function — no side effects.
 */

import { clamp, partialOverlap } from "./scoring_utils";
import type { KGActivation } from "@/services/kg/kg_activation";
import { getClusterDiagnoses } from "@/services/kg/kg_clusters";

export interface WeakSignalInput {
  diagnosis_name: string;
  patient_symptoms: string[];
  supporting_symptoms: string[];
  cluster_ids: string[];        // Active clusters for this diagnosis
  activation_weight: number;    // From KG activation
  must_not_miss: boolean;
  risk_factors?: string[];
  medical_history?: string[];
}

export interface WeakSignalResult {
  score: number;         // 0–1 boost factor
  signals_detected: string[];
  is_weak_activation: boolean;
}

// ── Weak symptom associations (fuzzy/partial matches) ──

const WEAK_ASSOCIATIONS: Record<string, string[]> = {
  "pulmonary embolism":       ["leg pain", "swelling", "immobility", "recent surgery", "oral contraceptive", "long flight", "calf pain", "pleuritic"],
  "myocardial infarction":    ["jaw pain", "epigastric pain", "arm pain", "fatigue", "nausea", "indigestion"],
  "stroke":                   ["visual changes", "numbness", "tingling", "unsteady", "ataxia", "slurred"],
  "sepsis":                   ["malaise", "lethargy", "poor feeding", "irritability", "altered mental status"],
  "aortic dissection":        ["tearing pain", "migrating pain", "unequal pulses", "hypertension"],
  "meningitis":               ["photophobia", "lethargy", "irritability", "rash", "petechial"],
  "necrotizing fasciitis":    ["pain out of proportion", "rapidly spreading", "crepitus", "skin changes"],
  "diabetic ketoacidosis":    ["fruity breath", "kussmaul", "dehydration", "weight loss"],
  "subarachnoid hemorrhage":  ["worst headache", "thunderclap", "loss of consciousness", "neck pain"],
  "cauda equina syndrome":    ["saddle anesthesia", "bilateral leg", "bowel dysfunction", "bladder dysfunction"],
};

/**
 * Evaluate weak signal strength for a diagnosis.
 *
 * A weak signal is detected when:
 *   - Partial symptom overlap exists (< full match)
 *   - Risk factors or history align
 *   - Multiple weak indicators converge
 *
 * 2–3 weak signals = meaningful activation (per spec)
 */
export function evaluateWeakSignals(input: WeakSignalInput): WeakSignalResult {
  const diagLower = input.diagnosis_name.toLowerCase().trim();
  const symptomSet = new Set(input.patient_symptoms.map(s => s.toLowerCase().trim()));
  const signals: string[] = [];

  // 1. Check weak associations
  const weakAssoc = WEAK_ASSOCIATIONS[diagLower] || [];
  let weakMatches = 0;
  for (const assoc of weakAssoc) {
    if ([...symptomSet].some(s => s.includes(assoc) || assoc.includes(s))) {
      weakMatches++;
      signals.push(`weak_assoc:${assoc}`);
    }
  }

  // 2. Check risk factor alignment
  const riskFactors = input.risk_factors?.map(r => r.toLowerCase()) || [];
  const historyItems = input.medical_history?.map(h => h.toLowerCase()) || [];
  const contextItems = [...riskFactors, ...historyItems];

  // Risk factor patterns
  const RISK_PATTERNS: Record<string, string[]> = {
    "pulmonary embolism": ["dvt", "clot", "thrombosis", "immobile", "surgery", "cancer", "oral contraceptive"],
    "myocardial infarction": ["diabetes", "hypertension", "smoking", "cholesterol", "coronary", "stent"],
    "stroke": ["atrial fibrillation", "hypertension", "diabetes", "previous stroke", "tia"],
    "sepsis": ["immunocompromised", "hiv", "transplant", "chemotherapy", "dialysis"],
    "diabetic ketoacidosis": ["diabetes", "type 1", "insulin"],
  };

  const riskPatterns = RISK_PATTERNS[diagLower] || [];
  let riskMatches = 0;
  for (const pattern of riskPatterns) {
    if (contextItems.some(c => c.includes(pattern))) {
      riskMatches++;
      signals.push(`risk_factor:${pattern}`);
    }
  }

  // 3. Cluster coherence — does the activation cluster make sense?
  let clusterCoherence = 0;
  if (input.cluster_ids.length > 0) {
    // Multiple clusters active for this diagnosis = stronger signal
    clusterCoherence = Math.min(input.cluster_ids.length * 0.15, 0.3);
    if (input.cluster_ids.length >= 2) {
      signals.push(`multi_cluster:${input.cluster_ids.join(",")}`);
    }
  }

  // 4. Partial symptom overlap with expected presentation
  const directOverlap = partialOverlap(input.patient_symptoms, input.supporting_symptoms);
  if (directOverlap > 0 && directOverlap < 0.5) {
    signals.push(`partial_overlap:${(directOverlap * 100).toFixed(0)}%`);
  }

  // Calculate composite score
  const totalSignals = weakMatches + riskMatches;
  const isWeakActivation = totalSignals >= 2 || (totalSignals >= 1 && clusterCoherence > 0);

  let score: number;
  if (totalSignals === 0 && clusterCoherence === 0) {
    score = 0;
  } else {
    // Base: each weak signal contributes 0.1, risk match 0.15
    const signalScore = (weakMatches * 0.1) + (riskMatches * 0.15) + clusterCoherence + (directOverlap * 0.1);
    score = clamp(signalScore, 0, 0.6);

    // Boost for MNM when any weak signal present
    if (input.must_not_miss && totalSignals >= 1) {
      score = clamp(score + 0.1, 0, 0.7);
    }
  }

  return { score, signals_detected: signals, is_weak_activation: isWeakActivation };
}
