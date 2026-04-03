/**
 * Post-Bayesian Score Fusion Layer (Phase 5.5 — Physiology-First Architecture)
 *
 * Bridges upstream intelligence (DDX, Physiology, Pattern Priority)
 * into the final Bayesian output WITHOUT modifying the Bayesian edge function.
 *
 * ARCHITECTURE CHANGE (v2):
 *   Physiology is now PRIMARY TRUTH. Diagnosis ranking emerges from
 *   physiological state via conditioned scoring — NOT from post-hoc overrides.
 *
 * Invariants:
 *   - Pure function — no side effects, no async, no randomness
 *   - Deterministic: identical inputs → identical output
 *   - Bayesian remains base authority — physiology conditions the ranking
 *   - Feature-flagged via enable_score_fusion
 *   - Output sum normalised to 1.0
 */

import type { BayesianResult, BayesianDiagnosis } from "@/services/bayesian_engine/client";
import type { DDXResult } from "@/services/ddx_engine/client";
import type { PhysiologicalContextResult } from "@/services/physiology_engine";
import type { PatternPriorityResult } from "@/services/clinical_pipeline/pattern_priority_layer";
import {
  computeSystemicState,
  matchDiseaseProfile,
  computePhysioMultiplier,
  type SystemicState,
  type VitalsInput,
} from "@/services/physiology_engine/systemic_state";

// ── Types ──

export interface ScoreFusionInput {
  bayesian: BayesianResult;
  ddx: DDXResult | null;
  physiology: PhysiologicalContextResult | null;
  patternAdjustments: PatternPriorityResult | null;
  /** Direct vitals for systemic state computation (preferred over physiology extraction) */
  vitals?: VitalsInput;
  /** UUID → diagnosis_name map from DDX, used to resolve Bayesian UUIDs for semantic matching */
  diagnosisNameMap?: Map<string, string>;
}

export interface FusionDiagnostics {
  diagnosis_id: string;
  base_posterior: number;
  ddx_weight: number;
  pattern_weight: number;
  physiology_weight: number;
  physio_multiplier: number;
  raw_fused: number;
  final_normalised: number;
}

export interface ScoreFusionOutput {
  result: BayesianResult;
  diagnostics: FusionDiagnostics[];
  fusion_applied: boolean;
  systemic_state: SystemicState | null;
}

// ── Constants ──

const DDX_WEIGHT_FLOOR = 0.20;
const DDX_WEIGHT_MAX = 2.5;
const SCORE_FLOOR = 0.001;
const SCORE_CEILING = 0.95;

// ── Physiology Alignment Maps (legacy — kept for non-systemic alignment) ──

interface PhysioRule {
  keywords: string[];
  stateMatches: string[];
  boostWeight: number;
  contradictWeight: number;
}

const PHYSIO_RULES: PhysioRule[] = [
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

  const maxProb = Math.max(...ddx.differential_diagnoses.map(d => d.probability), 1);

  for (const d of ddx.differential_diagnoses) {
    if (!d.diagnosis_id) continue;
    const normalised = d.probability / maxProb;
    const weight = DDX_WEIGHT_FLOOR + normalised * (DDX_WEIGHT_MAX - DDX_WEIGHT_FLOOR);
    map.set(d.diagnosis_id, Math.round(weight * 1000) / 1000);
  }

  return map;
}

// ── Helper: Build Pattern weight map ──

function buildPatternWeightMap(
  patterns: PatternPriorityResult | null,
  bayesianDiagnoses: BayesianDiagnosis[],
): Map<string, number> {
  const map = new Map<string, number>();
  if (!patterns || patterns.patterns_detected.length === 0) return map;

  const boostLookup = new Map<string, number>(
    patterns.priority_adjustments.boost.map(b => [b.diagnosis.toLowerCase(), b.weight_multiplier] as [string, number])
  );
  const suppressLookup = new Map<string, number>(
    patterns.priority_adjustments.suppress.map(s => [s.diagnosis.toLowerCase(), s.weight_multiplier] as [string, number])
  );

  for (const d of bayesianDiagnoses) {
    const name = ((d as any).diagnosis_name || d.diagnosis_id || "").toLowerCase();
    let weight = 1.0;

    for (const [bk, bm] of boostLookup) {
      if (name.includes(bk) || bk.includes(name)) {
        weight = Math.max(weight, bm);
      }
    }

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

// ── Helper: Build legacy physiology alignment weight map ──
// Used for non-systemic physiology-state matching (e.g., respiratory_compromise → pneumonia)

function buildLegacyPhysioWeightMap(
  physiology: PhysiologicalContextResult | null,
  bayesianDiagnoses: BayesianDiagnosis[],
): Map<string, number> {
  const map = new Map<string, number>();
  if (!physiology?.physiological_states?.length) return map;

  const activeStates = new Set(
    physiology.physiological_states
      .filter((s: any) => (s.confidence ?? 1) >= 0.3)
      .map((s: any) => (s.state || s.state_name || "").toLowerCase())
  );

  if (activeStates.size === 0) return map;

  for (const d of bayesianDiagnoses) {
    const name = ((d as any).diagnosis_name || d.diagnosis_id || "").toLowerCase();
    const rule = PHYSIO_RULES.find(r => r.keywords.some(k => name.includes(k)));
    if (!rule) continue;

    const matchCount = rule.stateMatches.filter(s =>
      [...activeStates].some(as => as.includes(s) || s.includes(as))
    ).length;

    if (matchCount === 0) {
      map.set(d.diagnosis_id, rule.contradictWeight);
    } else {
      const boostFraction = matchCount / rule.stateMatches.length;
      const weight = 1.0 + (rule.boostWeight - 1.0) * Math.min(boostFraction * 1.5, 1.0);
      map.set(d.diagnosis_id, Math.round(weight * 1000) / 1000);
    }
  }

  return map;
}

// ── Main Fusion Function (Physiology-First Architecture) ──

/**
 * Apply score fusion: modulate Bayesian posteriors using physiology-conditioned
 * multipliers, DDX weights, and pattern signals.
 *
 * Physiology-First Formula:
 *   adjusted = base_posterior × physio_multiplier × (1 + ddx_weight) × pattern_weight × legacy_physio_weight
 *
 * Where physio_multiplier is computed from systemic state + disease profile,
 * ensuring systemic diseases are naturally boosted and organ-level diseases
 * are naturally suppressed during systemic instability.
 */
export function applyScoreFusion(input: ScoreFusionInput): ScoreFusionOutput {
  const { bayesian, ddx, physiology, patternAdjustments, vitals, diagnosisNameMap } = input;

  // Guard: if no Bayesian result or no diagnoses, pass through
  if (!bayesian?.diagnoses?.length) {
    return { result: bayesian, diagnostics: [], fusion_applied: false, systemic_state: null };
  }

  // ── STEP 1: Compute Systemic State (PRIMARY TRUTH) ──
  const vitalsForState: VitalsInput = vitals || {};
  const systemicState = computeSystemicState(vitalsForState);

  console.log("[PHYSIO_STATE]", {
    strength: systemicState.systemic_strength,
    severity: systemicState.severity,
    phenotype: systemicState.phenotype,
    signals: systemicState.signals,
    signal_count: systemicState.signal_count,
  });

  // Build lookup maps
  const ddxMap = buildDDXWeightMap(ddx);
  const patternMap = buildPatternWeightMap(patternAdjustments, bayesian.diagnoses);
  const legacyPhysioMap = buildLegacyPhysioWeightMap(physiology, bayesian.diagnoses);

  // Check if any upstream intelligence exists
  const hasUpstream = ddxMap.size > 0 || patternMap.size > 0 || legacyPhysioMap.size > 0 || systemicState.signal_count > 0;
  if (!hasUpstream) {
    console.log("[ScoreFusion] No upstream intelligence available — passing Bayesian through unchanged.");
    return { result: bayesian, diagnostics: [], fusion_applied: false, systemic_state: systemicState };
  }

  console.log("[ScoreFusion] === PHYSIOLOGY-FIRST FUSION ===");

  // ── STEP 2: Compute fused scores with physiology conditioning ──
  const diagnostics: FusionDiagnostics[] = [];
  const fusedScores: { diagnosis: BayesianDiagnosis; rawFused: number }[] = [];

  for (const d of bayesian.diagnoses) {
    const base = d.posterior_probability;
    const ddxW = ddxMap.get(d.diagnosis_id) ?? 1.0;
    const patternW = patternMap.get(d.diagnosis_id) ?? 1.0;
    const legacyPhysioW = legacyPhysioMap.get(d.diagnosis_id) ?? 1.0;

    // ── PHYSIOLOGY-FIRST: Compute multiplier from systemic state + disease profile ──
    const diagName = ((d as any).diagnosis_name || d.diagnosis_id || "").toLowerCase();
    const profile = matchDiseaseProfile(diagName);
    const physioMultiplier = computePhysioMultiplier(systemicState, profile);

    // Final formula: base × physio_multiplier × (1 + ddx) × pattern × legacy_physio
    const rawFused = base * physioMultiplier * (1 + ddxW) * patternW * legacyPhysioW;

    console.log(`[PHYSIO_ADJUST] ${(d as any).diagnosis_name || d.diagnosis_id}: base=${(base*100).toFixed(2)}% physio_mult=${physioMultiplier.toFixed(3)} ddx=${ddxW} pat=${patternW} legPhys=${legacyPhysioW} → raw=${(rawFused*100).toFixed(2)}% [${profile?.type || "unknown"}]`);

    diagnostics.push({
      diagnosis_id: d.diagnosis_id,
      base_posterior: base,
      ddx_weight: ddxW,
      pattern_weight: patternW,
      physiology_weight: legacyPhysioW,
      physio_multiplier: physioMultiplier,
      raw_fused: rawFused,
      final_normalised: 0,
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

  console.log("[ScoreFusion] === FUSION RESULT ===");
  console.log(
    `[ScoreFusion] Physiology-First — severity=${systemicState.severity} phenotype=${systemicState.phenotype}. ` +
    `DDX weights: ${ddxMap.size}, Pattern weights: ${patternMap.size}. ` +
    `Top: ${(fusedDiagnoses[0] as any)?.diagnosis_name || fusedDiagnoses[0]?.diagnosis_id} ` +
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
    systemic_state: systemicState,
  };
}
