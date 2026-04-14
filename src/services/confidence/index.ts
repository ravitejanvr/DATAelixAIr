/**
 * Confidence Engine — V4
 *
 * Measures uncertainty, conflicting evidence, and data sufficiency.
 * Inspired by Bayesian logic but not a standalone engine.
 *
 * Feeds into Authority Layer — does NOT score diagnoses.
 */

import type {
  ConfidenceOutput,
  ConflictingEvidence,
  ConfidenceFactor,
  PipelineVitals,
  PipelineLabResult,
} from "../pipeline/types";
import type { CanonicalFeature } from "../canonical/types";

/**
 * Compute confidence metrics for the current clinical context.
 */
export function computeConfidence(params: {
  features: CanonicalFeature[];
  vitals: PipelineVitals | null;
  labResults: PipelineLabResult[];
  patientAge: number | null;
  patientSex: string | null;
  medications: string[];
  allergies: string[];
  ddxSpread: number[];  // probability distribution from DDX
}): ConfidenceOutput {
  const factors: ConfidenceFactor[] = [];

  // 1. Feature density
  const featureCount = params.features.length;
  const featureDensity = Math.min(featureCount / 5, 1.0);
  factors.push({
    name: "feature_density",
    weight: 0.25,
    value: featureDensity,
    detail: `${featureCount} canonical features present`,
  });

  // 2. Demographics completeness
  let demoScore = 0;
  if (params.patientAge != null) demoScore += 0.5;
  if (params.patientSex) demoScore += 0.5;
  factors.push({
    name: "demographics",
    weight: 0.15,
    value: demoScore,
    detail: `Age: ${params.patientAge != null ? "✓" : "✗"}, Sex: ${params.patientSex ? "✓" : "✗"}`,
  });

  // 3. Vitals presence
  const vitalValues = params.vitals
    ? Object.values(params.vitals).filter(v => v != null).length
    : 0;
  const vitalScore = Math.min(vitalValues / 4, 1.0);
  factors.push({
    name: "vitals_presence",
    weight: 0.15,
    value: vitalScore,
    detail: `${vitalValues} vital measurements recorded`,
  });

  // 4. DDX discrimination (entropy of probability distribution)
  const uncertainty = computeEntropy(params.ddxSpread);
  const discriminationScore = 1.0 - Math.min(uncertainty / 3.0, 1.0);
  factors.push({
    name: "ddx_discrimination",
    weight: 0.25,
    value: discriminationScore,
    detail: `Entropy: ${uncertainty.toFixed(2)}, Discrimination: ${(discriminationScore * 100).toFixed(0)}%`,
  });

  // 5. Lab results
  const labScore = params.labResults.length > 0 ? 1.0 : 0.0;
  factors.push({
    name: "lab_evidence",
    weight: 0.10,
    value: labScore,
    detail: `${params.labResults.length} lab result(s)`,
  });

  // 6. Safety documentation (meds + allergies)
  let safetyDoc = 0;
  if (params.medications.length > 0) safetyDoc += 0.5;
  if (params.allergies.length > 0) safetyDoc += 0.5;
  factors.push({
    name: "safety_documentation",
    weight: 0.10,
    value: safetyDoc,
    detail: `Medications: ${params.medications.length}, Allergies: ${params.allergies.length}`,
  });

  // Compute overall confidence
  const overall = factors.reduce((sum, f) => sum + f.weight * f.value, 0);

  // Detect conflicting evidence
  const conflicts = detectConflicts(params.features);

  // Insufficient data flags
  const insufficientFlags: string[] = [];
  if (featureCount < 2) insufficientFlags.push("Too few symptoms for reliable differential");
  if (params.patientAge == null) insufficientFlags.push("Age unknown — limits age-specific reasoning");
  if (vitalValues === 0) insufficientFlags.push("No vitals recorded");

  return {
    overall_confidence: Math.round(overall * 100) / 100,
    uncertainty_score: Math.round(uncertainty * 100) / 100,
    conflicting_evidence: conflicts,
    insufficient_data_flags: insufficientFlags,
    confidence_factors: factors,
  };
}

/**
 * Shannon entropy of a probability distribution.
 */
function computeEntropy(probs: number[]): number {
  if (probs.length === 0) return 0;
  const total = probs.reduce((s, p) => s + p, 0);
  if (total === 0) return 0;
  let entropy = 0;
  for (const p of probs) {
    const normalized = p / total;
    if (normalized > 0) {
      entropy -= normalized * Math.log2(normalized);
    }
  }
  return entropy;
}

/**
 * Detect evidence conflicts from feature set.
 */
function detectConflicts(features: CanonicalFeature[]): ConflictingEvidence[] {
  const conflicts: ConflictingEvidence[] = [];
  const featureIds = new Set(features.map(f => f.feature_id));

  // Known clinical contradictions
  const CONTRADICTION_PAIRS: [string, string, string][] = [
    ["TACHYCARDIA", "SYNCOPE", "Tachycardia with syncope may indicate hemodynamic instability"],
    ["FEVER", "CHILLS", "Concurrent fever and chills — normal febrile pattern but check severity"],
  ];

  for (const [a, b, type] of CONTRADICTION_PAIRS) {
    if (featureIds.has(a) && featureIds.has(b)) {
      conflicts.push({
        feature_a: a,
        feature_b: b,
        conflict_type: type,
        impact: 0.1,
      });
    }
  }

  return conflicts;
}

/**
 * Get human-readable confidence label.
 */
export function getConfidenceLabel(score: number): string {
  if (score >= 0.85) return "High Confidence";
  if (score >= 0.65) return "Moderate Confidence";
  if (score >= 0.45) return "Low Confidence";
  return "Insufficient Context";
}
