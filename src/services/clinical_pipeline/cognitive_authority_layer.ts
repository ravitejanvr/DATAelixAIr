/**
 * Cognitive Authority Layer (CAL)
 *
 * Deterministic, pure module that applies clinician-like reasoning
 * to the SSAL-enriched diagnosis list. Runs AFTER score fusion and
 * SSAL enrichment, BEFORE Object.freeze.
 *
 * When systemic instability is HIGH (≥3 signals), systemic diagnoses
 * are boosted and organ-level diagnoses are suppressed — causing
 * systemic syndromes to naturally outrank organ-level sources.
 *
 * Invariants:
 *   - Pure function: no side effects, no async, no randomness
 *   - Deterministic: identical inputs → identical output
 *   - Feature-flagged: enable_cognitive_authority_layer
 *   - Fail-safe: returns input unchanged if any required data is missing
 *   - Output sum normalised to 1.0
 */

import {
  computeSystemicState,
  matchDiseaseProfile,
  type SystemicState,
  type VitalsInput,
  type DiseaseSystemicProfile,
} from "@/services/physiology_engine/systemic_state";

// ── Types ──

export interface CALDiagnosis {
  diagnosis_id: string;
  diagnosis_name: string;
  canonical_name: string;
  posterior_probability: number;
  rank: number;
  source: "bayesian" | "fused" | "override";
  must_not_miss?: boolean;
  [key: string]: any;
}

export interface CALAdjustment {
  diagnosis_id: string;
  diagnosis_name: string;
  type: string;
  before: number;
  after: number;
}

export interface CALMetadata {
  systemic_strength: number;
  severity: string;
  phenotype: string;
  triggers: string[];
  adjustments: CALAdjustment[];
  decision_basis: string;
  knowledge_sources: string[];
  applied: boolean;
  skip_reason?: string;
}

export interface CALInput {
  diagnoses: CALDiagnosis[];
  vitals?: VitalsInput;
  systemic_state?: SystemicState | null;
}

export interface CALOutput {
  diagnoses: CALDiagnosis[];
  cal_metadata: CALMetadata;
}

// ── Constants ──

const SYSTEMIC_BOOST_FACTOR = 0.25;   // per signal: score *= (1 + 0.25 * strength)
const ORGAN_SUPPRESS_FACTOR = 0.10;   // per signal: score *= (1 - 0.10 * strength)
const MIN_STRENGTH_THRESHOLD = 3;     // minimum signals to activate CAL
const SCORE_FLOOR = 0.001;
const SCORE_CEILING = 0.95;

// ── Main CAL Function ──

export function applyCognitiveAuthority(input: CALInput): CALOutput {
  const { diagnoses, vitals, systemic_state } = input;

  // ── FAIL-SAFE: Check required inputs ──
  if (!diagnoses || diagnoses.length === 0) {
    console.log("[CAL] SKIP — no diagnoses provided");
    return {
      diagnoses,
      cal_metadata: buildSkipMetadata("no_diagnoses"),
    };
  }

  // Compute or reuse systemic state
  const state = systemic_state || (vitals ? computeSystemicState(vitals) : null);

  if (!state) {
    console.log("[CAL] SKIP — no vitals or systemic state available");
    return {
      diagnoses,
      cal_metadata: buildSkipMetadata("no_physiology_data"),
    };
  }

  // ── FAIL-SAFE: Verify all diagnoses have taxonomy (canonical_name) ──
  const missingTaxonomy = diagnoses.filter(d => !d.canonical_name);
  if (missingTaxonomy.length > 0) {
    console.error("[CAL_ERROR] Missing canonical_name for diagnoses:", missingTaxonomy.map(d => d.diagnosis_id));
    return {
      diagnoses,
      cal_metadata: buildSkipMetadata("missing_taxonomy"),
    };
  }

  // ── CHECK ACTIVATION THRESHOLD ──
  if (state.signal_count < MIN_STRENGTH_THRESHOLD) {
    console.log(`[CAL] SKIP — systemic_strength ${state.signal_count} < threshold ${MIN_STRENGTH_THRESHOLD}`);
    return {
      diagnoses,
      cal_metadata: {
        systemic_strength: state.signal_count,
        severity: state.severity,
        phenotype: state.phenotype,
        triggers: [],
        adjustments: [],
        decision_basis: "below_threshold",
        knowledge_sources: ["physiology_engine"],
        applied: false,
        skip_reason: `signal_count ${state.signal_count} < ${MIN_STRENGTH_THRESHOLD}`,
      },
    };
  }

  // ── APPLY COGNITIVE AUTHORITY ──
  console.log(`[CAL] ACTIVATED — systemic_strength=${state.signal_count}, severity=${state.severity}, phenotype=${state.phenotype}`);

  const triggers: string[] = [];
  if (state.signals.hypotension) triggers.push("hypotension");
  if (state.signals.tachycardia) triggers.push("tachycardia");
  if (state.signals.tachypnea) triggers.push("tachypnea");
  if (state.signals.fever) triggers.push("fever");
  if (state.signals.hypoxia) triggers.push("hypoxia");

  const adjustments: CALAdjustment[] = [];
  const adjusted: { d: CALDiagnosis; score: number }[] = [];

  for (const d of diagnoses) {
    const profile = matchDiseaseProfile(d.canonical_name);
    const before = d.posterior_probability;
    let score = before;
    let diseaseType = profile?.type || "unknown";

    if (profile?.requires_systemic_instability) {
      // SYSTEMIC: Boost proportionally to signal count
      score = score * (1 + SYSTEMIC_BOOST_FACTOR * state.signal_count);
      diseaseType = "systemic";
    } else if (profile) {
      // ORGAN/METABOLIC/etc: Suppress proportionally to signal count
      score = score * (1 - ORGAN_SUPPRESS_FACTOR * state.signal_count);
    } else {
      // Unknown taxonomy: mild suppression
      score = score * (1 - 0.05 * state.signal_count);
      diseaseType = "unclassified";
    }

    // Clamp
    score = Math.max(SCORE_FLOOR, Math.min(SCORE_CEILING, score));

    if (Math.abs(score - before) > 0.0001) {
      adjustments.push({
        diagnosis_id: d.diagnosis_id,
        diagnosis_name: d.diagnosis_name,
        type: diseaseType,
        before: Math.round(before * 10000) / 10000,
        after: Math.round(score * 10000) / 10000,
      });
    }

    adjusted.push({ d, score });
  }

  // ── NORMALIZE to sum = 1.0 ──
  const total = adjusted.reduce((sum, a) => sum + a.score, 0);
  const normFactor = total > 0 ? 1.0 / total : 1.0;

  const normalised = adjusted.map(a => ({
    ...a,
    score: Math.max(SCORE_FLOOR, Math.min(SCORE_CEILING, a.score * normFactor)),
  }));

  // Sort by score descending
  normalised.sort((a, b) => b.score - a.score);

  // Final sum correction
  const finalSum = normalised.reduce((s, a) => s + a.score, 0);
  if (normalised.length > 0 && Math.abs(finalSum - 1.0) > 0.001) {
    normalised[0].score += (1.0 - finalSum);
  }

  // Build output diagnoses with updated probabilities and ranks
  const outputDiagnoses: CALDiagnosis[] = normalised.map((a, idx) => ({
    ...a.d,
    posterior_probability: Math.round(a.score * 10000) / 10000,
    rank: idx + 1,
    source: "fused" as const,
  }));

  // Log results
  console.log("[CAL] === AUTHORITY RESULT ===");
  for (const adj of adjustments) {
    console.log(`[CAL_ADJUST] ${adj.diagnosis_name}: ${(adj.before * 100).toFixed(1)}% → ${(adj.after * 100).toFixed(1)}% [${adj.type}]`);
  }
  console.log(`[CAL] Top diagnosis: ${outputDiagnoses[0]?.diagnosis_name} (${(outputDiagnoses[0]?.posterior_probability * 100).toFixed(1)}%)`);

  return {
    diagnoses: outputDiagnoses,
    cal_metadata: {
      systemic_strength: state.signal_count,
      severity: state.severity,
      phenotype: state.phenotype,
      triggers,
      adjustments,
      decision_basis: "physiology_guideline_rule",
      knowledge_sources: ["physiology_engine", "disease_systemic_profiles", "systemic_state_engine"],
      applied: true,
    },
  };
}

// ── Helper ──

function buildSkipMetadata(reason: string): CALMetadata {
  return {
    systemic_strength: 0,
    severity: "LOW",
    phenotype: "stable",
    triggers: [],
    adjustments: [],
    decision_basis: "skipped",
    knowledge_sources: [],
    applied: false,
    skip_reason: reason,
  };
}
