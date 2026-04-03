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

const DDX_WEIGHT_FLOOR = 0.20;
const DDX_WEIGHT_MAX = 2.5;
const SCORE_FLOOR = 0.001;
const SCORE_CEILING = 0.95;

// ── Physiology Alignment Maps ──

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

// ── Sepsis Shock Hard Trigger (FIX 3) ──
// Deterministic vitals-based physiology override for sepsis shock pattern.

interface VitalsSnapshot {
  systolic_bp?: number;
  heart_rate?: number;
  temperature_f?: number;
  respiratory_rate?: number;
  spo2?: number;
}

function extractVitalsFromPhysiology(physiology: PhysiologicalContextResult | null): VitalsSnapshot {
  if (!physiology) return {};
  const vitals: VitalsSnapshot = {};

  // Extract from physiological_states or vitals_summary if available
  const states = physiology.physiological_states || [];
  for (const s of states) {
    const name = ((s as any).state || (s as any).state_name || "").toLowerCase();
    const val = (s as any).value ?? (s as any).measured_value;

    if (name.includes("blood_pressure") || name.includes("systolic") || name.includes("hypotension")) {
      if (typeof val === "number") vitals.systolic_bp = val;
      else if (!vitals.systolic_bp) vitals.systolic_bp = 90; // hypotension state detected
    }
    if (name.includes("heart_rate") || name.includes("tachycardia")) {
      if (typeof val === "number") vitals.heart_rate = val;
      else if (!vitals.heart_rate) vitals.heart_rate = 110;
    }
    if (name.includes("temperature") || name.includes("fever") || name.includes("hyperpyrexia")) {
      if (typeof val === "number") vitals.temperature_f = val;
      else if (!vitals.temperature_f) vitals.temperature_f = 102;
    }
    if (name.includes("respiratory") || name.includes("tachypnea")) {
      if (typeof val === "number") vitals.respiratory_rate = val;
      else if (!vitals.respiratory_rate) vitals.respiratory_rate = 24;
    }
    if (name.includes("spo2") || name.includes("hypoxia")) {
      if (typeof val === "number") vitals.spo2 = val;
      else if (!vitals.spo2) vitals.spo2 = 92;
    }
  }

  return vitals;
}

function isSepsisShockPattern(vitals: VitalsSnapshot): boolean {
  let criteria = 0;
  if (vitals.systolic_bp !== undefined && vitals.systolic_bp < 100) criteria++;
  if (vitals.heart_rate !== undefined && vitals.heart_rate > 100) criteria++;
  if (vitals.temperature_f !== undefined && vitals.temperature_f > 101) criteria++;
  if (vitals.respiratory_rate !== undefined && vitals.respiratory_rate >= 22) criteria++;
  return criteria >= 3; // 3 of 4 SIRS-like criteria
}

// ── Helper: Build DDX weight map (FIX 1 — floor at 0.20) ──

function buildDDXWeightMap(ddx: DDXResult | null): Map<string, number> {
  const map = new Map<string, number>();
  if (!ddx?.differential_diagnoses?.length) return map;

  const maxProb = Math.max(...ddx.differential_diagnoses.map(d => d.probability), 1);

  for (const d of ddx.differential_diagnoses) {
    if (!d.diagnosis_id) continue;
    const normalised = d.probability / maxProb;
    // FIX 1: Floor at DDX_WEIGHT_FLOOR (0.20) instead of old 0.15
    const weight = DDX_WEIGHT_FLOOR + normalised * (DDX_WEIGHT_MAX - DDX_WEIGHT_FLOOR);
    map.set(d.diagnosis_id, Math.round(weight * 1000) / 1000);
  }

  return map;
}

// ── Helper: Build Pattern weight map (FIX 2 — high-risk override) ──

function buildPatternWeightMap(
  patterns: PatternPriorityResult | null,
  bayesianDiagnoses: BayesianDiagnosis[],
): Map<string, number> {
  const map = new Map<string, number>();
  if (!patterns || patterns.patterns_detected.length === 0) return map;

  const boostLookup = new Map(
    patterns.priority_adjustments.boost.map(b => [b.diagnosis.toLowerCase(), b.weight_multiplier])
  );
  const suppressLookup = new Map(
    patterns.priority_adjustments.suppress.map(s => [s.diagnosis.toLowerCase(), s.weight_multiplier])
  );

  // FIX 2: Detect if a critical infection+instability pattern is active
  const hasCriticalInfection = patterns.patterns_detected.some(
    p => p.clinical_significance === "critical" &&
      (p.pattern_name.toLowerCase().includes("sepsis") ||
       p.pattern_name.toLowerCase().includes("infection") ||
       p.pattern_name.toLowerCase().includes("systemic"))
  );

  for (const d of bayesianDiagnoses) {
    const name = ((d as any).diagnosis_name || d.diagnosis_id || "").toLowerCase();
    let weight = 1.0;

    // Check boost matches
    for (const [bk, bm] of boostLookup) {
      if (name.includes(bk) || bk.includes(name)) {
        weight = Math.max(weight, bm);
      }
    }

    // Check suppress matches
    for (const [sk, sm] of suppressLookup) {
      if (name.includes(sk) || sk.includes(name)) {
        weight = Math.min(weight, sm);
      }
    }

    // FIX 2: If critical infection pattern is active, enforce minimum boost for sepsis
    // and cap non-infectious competitors
    if (hasCriticalInfection) {
      const isSepsisLike = name.includes("sepsis") || name.includes("septic") ||
        name.includes("bacteremia") || name.includes("urosepsis");
      if (isSepsisLike) {
        weight = Math.max(weight, 3.0);
      }

      // Suppress metabolic/benign diagnoses harder during critical infection
      const isMetabolicOnly = name.includes("hypoglycemia") || name.includes("hypoglycemic");
      if (isMetabolicOnly) {
        weight = Math.min(weight, 0.5);
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

// ── Helper: Build Physiology weight map (FIX 3 — hard trigger) ──

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

  // FIX 3: Check for sepsis shock pattern via vitals
  const vitals = extractVitalsFromPhysiology(physiology);
  const shockPatternActive = isSepsisShockPattern(vitals);

  for (const d of bayesianDiagnoses) {
    const name = ((d as any).diagnosis_name || d.diagnosis_id || "").toLowerCase();

    // FIX 3: Hard trigger — if shock pattern active, apply strong boost to sepsis
    const isSepsisLike = name.includes("sepsis") || name.includes("septic") ||
      name.includes("bacteremia") || name.includes("urosepsis");

    if (shockPatternActive && isSepsisLike) {
      map.set(d.diagnosis_id, 2.8);
      continue; // Skip normal rule matching
    }

    // FIX 3: Suppress non-infectious diagnoses when shock pattern is active
    if (shockPatternActive) {
      const isMetabolicOnly = name.includes("hypoglycemia") || name.includes("hypoglycemic");
      const isBenign = name.includes("migraine") || name.includes("tension headache") ||
        name.includes("viral syndrome");
      if (isMetabolicOnly) {
        map.set(d.diagnosis_id, 0.4);
        continue;
      }
      if (isBenign) {
        map.set(d.diagnosis_id, 0.3);
        continue;
      }
    }

    // Normal physio rule matching (unchanged)
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

// ── Main Fusion Function (FIX 4 — non-linear amplification formula) ──

/**
 * Apply score fusion: modulate Bayesian posteriors using DDX, Pattern, and Physiology signals.
 * Pure, deterministic, no side effects.
 *
 * FIX 4 formula (non-linear amplification):
 *   final = base × (1 + ddx_weight) × pattern_weight × physiology_weight
 *
 * This amplifies the DDX signal additively (1 + ddx) while pattern and physiology
 * act as direct multipliers, creating stronger separation for high-acuity cases.
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

  // Log forensic trace for each diagnosis
  console.log("[ScoreFusion] === FORENSIC TRACE ===");

  // Compute fused scores
  const diagnostics: FusionDiagnostics[] = [];
  const fusedScores: { diagnosis: BayesianDiagnosis; rawFused: number }[] = [];

  for (const d of bayesian.diagnoses) {
    const base = d.posterior_probability;
    const ddxW = ddxMap.get(d.diagnosis_id) ?? 1.0;
    const patternW = patternMap.get(d.diagnosis_id) ?? 1.0;
    const physioW = physioMap.get(d.diagnosis_id) ?? 1.0;

    // FIX 4: Non-linear amplification formula
    // base × (1 + ddx_weight) × pattern_weight × physiology_weight
    const rawFused = base * (1 + ddxW) * patternW * physioW;

    console.log(`[ScoreFusion] ${(d as any).diagnosis_name || d.diagnosis_id}: base=${(base*100).toFixed(2)}% ddx=${ddxW} pat=${patternW} phys=${physioW} → raw=${(rawFused*100).toFixed(2)}%`);

    diagnostics.push({
      diagnosis_id: d.diagnosis_id,
      base_posterior: base,
      ddx_weight: ddxW,
      pattern_weight: patternW,
      physiology_weight: physioW,
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
    `[ScoreFusion] Applied — DDX weights: ${ddxMap.size}, Pattern weights: ${patternMap.size}, ` +
    `Physio weights: ${physioMap.size}. Top: ${(fusedDiagnoses[0] as any)?.diagnosis_name || fusedDiagnoses[0]?.diagnosis_id} ` +
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
