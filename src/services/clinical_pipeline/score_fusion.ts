/**
 * Post-Bayesian Score Fusion Layer (Phase 5.5)
 *
 * Bridges upstream intelligence (DDX, Physiology, Pattern Priority)
 * into the final Bayesian output WITHOUT modifying the Bayesian edge function.
 *
 * Invariants:
 *   - Pure function — no side effects, no async, no randomness
 *   - Deterministic: identical inputs → identical output
 *   - Bayesian remains base authority — fusion only modulates
 *   - Feature-flagged via enable_score_fusion
 *   - Output sum normalised to 1.0
 */

import type { BayesianResult, BayesianDiagnosis } from "@/services/bayesian_engine/client";
import type { DDXResult } from "@/services/ddx_engine/client";
import type { PhysiologicalContextResult } from "@/services/physiology_engine";
import type { PatternPriorityResult } from "@/services/clinical_pipeline/pattern_priority_layer";

// ── Types ──

export interface ScoreFusionInput {
  bayesian: BayesianResult;
  ddx: DDXResult | null;
  physiology: PhysiologicalContextResult | null;
  patternAdjustments: PatternPriorityResult | null;
}

export interface FusionDiagnostics {
  diagnosis_id: string;
  base_posterior: number;
  ddx_weight: number;
  pattern_weight: number;
  physiology_weight: number;
  raw_fused: number;
  final_normalised: number;
}

export interface ScoreFusionOutput {
  result: BayesianResult;
  diagnostics: FusionDiagnostics[];
  fusion_applied: boolean;
}

// ── Constants ──

const DDX_WEIGHT_MIN = 0.15;
const DDX_WEIGHT_MAX = 2.5;
const SCORE_FLOOR = 0.001;
const SCORE_CEILING = 0.95;

// ── Physiology Alignment Maps ──
// Deterministic keyword → system mapping for physiology modifiers

interface PhysioRule {
  keywords: string[];
  stateMatches: string[];
  boostWeight: number;
  contradictWeight: number;
}

const PHYSIO_RULES: PhysioRule[] = [
  {
    keywords: ["sepsis", "septic", "bacteremia", "urosepsis"],
    stateMatches: ["hemodynamic_instability", "systemic_inflammatory", "inflammatory", "tachycardia", "hypotension", "fever"],
    boostWeight: 1.6,
    contradictWeight: 0.5,
  },
  {
    keywords: ["pneumonia", "community-acquired pneumonia"],
    stateMatches: ["respiratory_compromise", "hypoxia", "tachypnea", "inflammatory", "fever"],
    boostWeight: 1.4,
    contradictWeight: 0.6,
  },
  {
    keywords: ["pulmonary embolism", "pe"],
    stateMatches: ["hypoxia", "tachycardia", "respiratory_compromise"],
    boostWeight: 1.5,
    contradictWeight: 0.5,
  },
  {
    keywords: ["acute coronary syndrome", "acs", "myocardial infarction", "mi", "nstemi", "stemi"],
    stateMatches: ["tachycardia", "hemodynamic_instability", "hypertension"],
    boostWeight: 1.4,
    contradictWeight: 0.6,
  },
  {
    keywords: ["hypoglycemia", "hypoglycemic"],
    stateMatches: ["hypoglycemia", "metabolic_derangement"],
    boostWeight: 1.5,
    contradictWeight: 0.4,
  },
  {
    keywords: ["meningitis", "encephalitis"],
    stateMatches: ["fever", "inflammatory", "neurological"],
    boostWeight: 1.5,
    contradictWeight: 0.5,
  },
  {
    keywords: ["appendicitis"],
    stateMatches: ["inflammatory", "fever", "tachycardia"],
    boostWeight: 1.3,
    contradictWeight: 0.7,
  },
  {
    keywords: ["stroke", "cerebrovascular", "cva", "tia"],
    stateMatches: ["hypertension", "neurological"],
    boostWeight: 1.4,
    contradictWeight: 0.6,
  },
];

// ── Helper: Build DDX weight map ──

function buildDDXWeightMap(ddx: DDXResult | null): Map<string, number> {
  const map = new Map<string, number>();
  if (!ddx?.differential_diagnoses?.length) return map;

  // DDX probabilities are on 0-100 scale
  // Convert to a weight factor: higher DDX score → higher multiplier
  // Normalise relative to max
  const maxProb = Math.max(...ddx.differential_diagnoses.map(d => d.probability), 1);

  for (const d of ddx.differential_diagnoses) {
    if (!d.diagnosis_id) continue;
    // Scale to [DDX_WEIGHT_MIN, DDX_WEIGHT_MAX]
    const normalised = d.probability / maxProb;
    const weight = DDX_WEIGHT_MIN + normalised * (DDX_WEIGHT_MAX - DDX_WEIGHT_MIN);
    map.set(d.diagnosis_id, Math.round(weight * 1000) / 1000);
  }

  return map;
}

// ── Helper: Build Pattern weight map ──

function buildPatternWeightMap(patterns: PatternPriorityResult | null, bayesianDiagnoses: BayesianDiagnosis[]): Map<string, number> {
  const map = new Map<string, number>();
  if (!patterns || patterns.patterns_detected.length === 0) return map;

  // Build lookup from pattern boost/suppress
  const boostLookup = new Map(
    patterns.priority_adjustments.boost.map(b => [b.diagnosis.toLowerCase(), b.weight_multiplier])
  );
  const suppressLookup = new Map(
    patterns.priority_adjustments.suppress.map(s => [s.diagnosis.toLowerCase(), s.weight_multiplier])
  );

  for (const d of bayesianDiagnoses) {
    const name = ((d as any).diagnosis_name || d.diagnosis_id || "").toLowerCase();
    let weight = 1.0;

    // Check boost matches (partial/exact)
    for (const [bk, bm] of boostLookup) {
      if (name.includes(bk) || bk.includes(name)) {
        weight = Math.max(weight, bm);
      }
    }

    // Check suppress matches (partial/exact)
    for (const [sk, sm] of suppressLookup) {
      if (name.includes(sk) || sk.includes(name)) {
        weight = Math.min(weight, sm);
      }
    }

    // MNM protection: never suppress below 1.0
    if (d.must_not_miss && weight < 1.0) {
      weight = 1.0;
    }

    if (weight !== 1.0) {
      map.set(d.diagnosis_id, Math.round(weight * 1000) / 1000);
    }
  }

  return map;
}

// ── Helper: Build Physiology weight map ──

function buildPhysiologyWeightMap(
  physiology: PhysiologicalContextResult | null,
  bayesianDiagnoses: BayesianDiagnosis[],
): Map<string, number> {
  const map = new Map<string, number>();
  if (!physiology?.physiological_states?.length) return map;

  // Collect active physiology state names (lowercased)
  const activeStates = new Set(
    physiology.physiological_states
      .filter((s: any) => (s.confidence ?? 1) >= 0.3)
      .map((s: any) => (s.state || s.state_name || "").toLowerCase())
  );

  if (activeStates.size === 0) return map;

  for (const d of bayesianDiagnoses) {
    const name = ((d as any).diagnosis_name || d.diagnosis_id || "").toLowerCase();

    // Find matching physio rule
    const rule = PHYSIO_RULES.find(r => r.keywords.some(k => name.includes(k)));
    if (!rule) continue;

    // Count how many physio states align with this diagnosis
    const matchCount = rule.stateMatches.filter(s =>
      [...activeStates].some(as => as.includes(s) || s.includes(as))
    ).length;

    if (matchCount === 0) {
      // Active physio states but none match → mild contradiction
      map.set(d.diagnosis_id, rule.contradictWeight);
    } else {
      // Graded boost: more matches → stronger boost, capped at rule.boostWeight
      const boostFraction = matchCount / rule.stateMatches.length;
      const weight = 1.0 + (rule.boostWeight - 1.0) * Math.min(boostFraction * 1.5, 1.0);
      map.set(d.diagnosis_id, Math.round(weight * 1000) / 1000);
    }
  }

  return map;
}

// ── Main Fusion Function ──

/**
 * Apply score fusion: modulate Bayesian posteriors using DDX, Pattern, and Physiology signals.
 * Pure, deterministic, no side effects.
 */
export function applyScoreFusion(input: ScoreFusionInput): ScoreFusionOutput {
  const { bayesian, ddx, physiology, patternAdjustments } = input;

  // Guard: if no Bayesian result or no diagnoses, pass through
  if (!bayesian?.diagnoses?.length) {
    return { result: bayesian, diagnostics: [], fusion_applied: false };
  }

  // Build lookup maps
  const ddxMap = buildDDXWeightMap(ddx);
  const patternMap = buildPatternWeightMap(patternAdjustments, bayesian.diagnoses);
  const physioMap = buildPhysiologyWeightMap(physiology, bayesian.diagnoses);

  // Check if any upstream intelligence exists
  const hasUpstream = ddxMap.size > 0 || patternMap.size > 0 || physioMap.size > 0;
  if (!hasUpstream) {
    console.log("[ScoreFusion] No upstream intelligence available — passing Bayesian through unchanged.");
    return { result: bayesian, diagnostics: [], fusion_applied: false };
  }

  // Compute fused scores
  const diagnostics: FusionDiagnostics[] = [];
  const fusedScores: { diagnosis: BayesianDiagnosis; rawFused: number }[] = [];

  for (const d of bayesian.diagnoses) {
    const base = d.posterior_probability;
    const ddxW = ddxMap.get(d.diagnosis_id) ?? 1.0;
    const patternW = patternMap.get(d.diagnosis_id) ?? 1.0;
    const physioW = physioMap.get(d.diagnosis_id) ?? 1.0;

    const rawFused = base * ddxW * patternW * physioW;

    diagnostics.push({
      diagnosis_id: d.diagnosis_id,
      base_posterior: base,
      ddx_weight: ddxW,
      pattern_weight: patternW,
      physiology_weight: physioW,
      raw_fused: rawFused,
      final_normalised: 0, // filled after normalisation
    });

    fusedScores.push({ diagnosis: d, rawFused });
  }

  // Clamp
  for (const entry of fusedScores) {
    entry.rawFused = Math.max(SCORE_FLOOR, Math.min(SCORE_CEILING, entry.rawFused));
  }

  // Normalise to sum = 1
  const total = fusedScores.reduce((sum, e) => sum + e.rawFused, 0);
  const normFactor = total > 0 ? 1.0 / total : 1.0;

  const fusedDiagnoses: BayesianDiagnosis[] = fusedScores.map((entry, i) => {
    const normalised = Math.max(SCORE_FLOOR, Math.min(SCORE_CEILING, entry.rawFused * normFactor));
    diagnostics[i].final_normalised = Math.round(normalised * 10000) / 10000;
    return {
      ...entry.diagnosis,
      posterior_probability: Math.round(normalised * 10000) / 10000,
    };
  });

  // Sort by posterior descending
  fusedDiagnoses.sort((a, b) => b.posterior_probability - a.posterior_probability);

  // Final sum correction (ensure exactly 1.0)
  const finalSum = fusedDiagnoses.reduce((s, d) => s + d.posterior_probability, 0);
  if (fusedDiagnoses.length > 0 && Math.abs(finalSum - 1.0) > 0.001) {
    const correction = 1.0 - finalSum;
    fusedDiagnoses[0].posterior_probability = Math.round(
      (fusedDiagnoses[0].posterior_probability + correction) * 10000
    ) / 10000;
  }

  console.log(
    `[ScoreFusion] Applied — DDX weights: ${ddxMap.size}, Pattern weights: ${patternMap.size}, ` +
    `Physio weights: ${physioMap.size}. Top: ${fusedDiagnoses[0]?.diagnosis_id} ` +
    `(${(fusedDiagnoses[0]?.posterior_probability * 100).toFixed(1)}%)`
  );

  return {
    result: {
      ...bayesian,
      diagnoses: fusedDiagnoses,
      source: `${bayesian.source || "bayesian"}_fused`,
    },
    diagnostics,
    fusion_applied: true,
  };
}
