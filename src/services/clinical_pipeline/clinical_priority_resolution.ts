/**
 * Clinical Priority Resolution Layer
 *
 * Resolves near-tie diagnostic rankings using clinical priority rules.
 * When systemic instability is HIGH and two diagnoses have near-equal
 * posteriors (within epsilon), systemic diagnoses are promoted over
 * organ-specific diagnoses.
 *
 * This is a POST-fusion, PRE-SSAL ordering adjustment.
 * It does NOT change scores — only ordering.
 *
 * Feature-flagged: enable_clinical_priority_resolution
 *
 * INVARIANTS:
 *   - Pure function (no side effects)
 *   - Deterministic
 *   - Does NOT modify posterior values
 *   - Does NOT create new diagnoses
 *   - Only reorders when conditions are met
 */

import type { BayesianResult, BayesianDiagnosis } from "@/services/bayesian_engine/client";

const EPSILON = 0.05; // 5% tie threshold

// Systemic disease keywords — same as Bayesian engine classification
const SYSTEMIC_KEYWORDS = [
  "sepsis", "septic shock", "sirs", "bacteremia", "septicemia",
  "diabetic ketoacidosis", "dka", "thyroid storm", "addisonian crisis",
  "anaphylaxis", "disseminated intravascular",
];

const ORGAN_KEYWORDS = [
  "pneumonia", "bronchitis", "asthma", "copd", "pharyngitis",
  "appendicitis", "gastroenteritis", "urinary tract infection",
  "pyelonephritis", "migraine", "tension headache", "cluster headache",
  "otitis", "sinusitis", "cellulitis",
];

type DiseaseCategory = "SYSTEMIC" | "ORGAN" | "UNKNOWN";

function classifyCategory(name: string): DiseaseCategory {
  const lower = name.toLowerCase();
  if (SYSTEMIC_KEYWORDS.some(k => lower.includes(k))) return "SYSTEMIC";
  if (ORGAN_KEYWORDS.some(k => lower.includes(k))) return "ORGAN";
  return "UNKNOWN";
}

export interface ClinicalPriorityInput {
  bayesian: BayesianResult;
  systemic_instability_level: "LOW" | "MODERATE" | "HIGH";
  signal_count: number;
  /** UUID → name map for category classification */
  diagnosisNameMap: Map<string, string>;
}

export interface ClinicalPriorityOutput {
  result: BayesianResult;
  applied: boolean;
  promotions: Array<{
    promoted_id: string;
    promoted_name: string;
    demoted_id: string;
    demoted_name: string;
    score_delta: number;
    reason: string;
  }>;
}

/**
 * Apply clinical priority resolution to near-tie diagnoses.
 * When systemic instability is HIGH and a systemic diagnosis is within
 * epsilon of an organ diagnosis ranked above it, promote the systemic one.
 */
export function applyClinicalPriorityResolution(
  input: ClinicalPriorityInput
): ClinicalPriorityOutput {
  const { bayesian, systemic_instability_level, signal_count, diagnosisNameMap } = input;

  // Only apply when systemic instability is HIGH
  if (systemic_instability_level !== "HIGH") {
    return { result: bayesian, applied: false, promotions: [] };
  }

  if (!bayesian.diagnoses || bayesian.diagnoses.length < 2) {
    return { result: bayesian, applied: false, promotions: [] };
  }

  // Work on a mutable copy of diagnoses (sorted by posterior descending)
  const diagnoses = [...bayesian.diagnoses].sort(
    (a, b) => b.posterior_probability - a.posterior_probability
  );

  const promotions: ClinicalPriorityOutput["promotions"] = [];

  // Scan for near-ties where a systemic diagnosis is below an organ diagnosis
  // Only check adjacent pairs to maintain stability
  for (let i = 0; i < diagnoses.length - 1; i++) {
    const higher = diagnoses[i];
    const lower = diagnoses[i + 1];

    const higherName = diagnosisNameMap.get(higher.diagnosis_id)
      || (higher as any).diagnosis_name || "";
    const lowerName = diagnosisNameMap.get(lower.diagnosis_id)
      || (lower as any).diagnosis_name || "";

    const higherCategory = classifyCategory(higherName);
    const lowerCategory = classifyCategory(lowerName);

    const scoreDelta = Math.abs(higher.posterior_probability - lower.posterior_probability);

    // Near-tie: organ ranked above systemic → promote systemic
    if (
      scoreDelta < EPSILON &&
      higherCategory === "ORGAN" &&
      lowerCategory === "SYSTEMIC"
    ) {
      // Swap positions
      diagnoses[i] = lower;
      diagnoses[i + 1] = higher;

      promotions.push({
        promoted_id: lower.diagnosis_id,
        promoted_name: lowerName,
        demoted_id: higher.diagnosis_id,
        demoted_name: higherName,
        score_delta: scoreDelta,
        reason: `Systemic priority: ${lowerName} promoted over ${higherName} (delta=${(scoreDelta * 100).toFixed(1)}% < epsilon=${EPSILON * 100}%, instability=HIGH, signals=${signal_count}/5)`,
      });

      console.log(
        `[ClinicalPriority] PROMOTED: ${lowerName} over ${higherName} ` +
        `(delta=${(scoreDelta * 100).toFixed(1)}%, instability=HIGH, signals=${signal_count})`
      );

      // Don't cascade — only one swap per adjacent pair per pass
      // Skip next index since we just swapped
      i++;
    }
  }

  if (promotions.length === 0) {
    return { result: bayesian, applied: false, promotions: [] };
  }

  return {
    result: { ...bayesian, diagnoses },
    applied: true,
    promotions,
  };
}
