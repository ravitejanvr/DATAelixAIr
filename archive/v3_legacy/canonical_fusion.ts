/**
 * Canonical Score Fusion — ID-Based Disease Profile Resolution
 *
 * Replaces string-based matchDiseaseProfile with canonical ID-based resolution.
 * Feature-flagged via enable_canonical_mapping.
 *
 * When enabled:
 *   - Uses resolveCanonicalProfile(id, name) instead of matchDiseaseProfile(name)
 *   - Unknown diagnoses get multiplier = 1.0 (neutral) instead of 0.7x (suppressive)
 *   - Logs resolution method for each diagnosis
 *
 * When disabled:
 *   - Falls through to existing string-based logic (zero behavior change)
 *
 * INVARIANTS:
 *   - Pure function
 *   - Deterministic
 *   - No pipeline reorder
 *   - No Bayesian engine changes
 */

import type { BayesianResult, BayesianDiagnosis } from "@/services/bayesian_engine/client";
import type { DDXResult } from "@/services/ddx_engine/client";
import type { PhysiologicalContextResult } from "@/services/physiology_engine";
import type { PatternPriorityResult } from "@/services/clinical_pipeline/pattern_priority_layer";
import {
  computeSystemicState,
  computePhysioMultiplier,
  type SystemicState,
  type VitalsInput,
  type DiseaseSystemicProfile,
} from "@/services/physiology_engine/systemic_state";
import {
  resolveCanonicalProfile,
  getResolutionMethod,
  type CanonicalDiseaseProfile,
} from "@/services/clinical/knowledge/canonical_disease_profiles";
import type { ScoreFusionInput, ScoreFusionOutput, FusionDiagnostics } from "@/services/clinical_pipeline/score_fusion";

// ── Constants (same as score_fusion.ts) ──

const DDX_WEIGHT_FLOOR = 0.20;
const DDX_WEIGHT_MAX = 2.5;
const SCORE_FLOOR = 0.001;
const SCORE_CEILING = 0.95;

// ── Helper: Build DDX weight map (shared logic) ──

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

// ── Helper: Build Pattern weight map (shared logic) ──

function buildPatternWeightMap(
  patterns: PatternPriorityResult | null,
  bayesianDiagnoses: BayesianDiagnosis[],
  nameMap: Map<string, string>,
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
    const name = (nameMap.get(d.diagnosis_id) || (d as any).diagnosis_name || d.diagnosis_id || "").toLowerCase();
    let weight = 1.0;

    for (const [bk, bm] of boostLookup) {
      if (name.includes(bk) || bk.includes(name)) weight = Math.max(weight, bm);
    }
    for (const [sk, sm] of suppressLookup) {
      if (name.includes(sk) || sk.includes(name)) weight = Math.min(weight, sm);
    }

    if (d.must_not_miss && weight < 1.0) weight = 1.0;
    if (weight !== 1.0) map.set(d.diagnosis_id, Math.round(weight * 1000) / 1000);
  }
  return map;
}

// ── Helper: Build legacy physiology alignment weight map ──

interface PhysioRule {
  keywords: string[];
  stateMatches: string[];
  boostWeight: number;
  contradictWeight: number;
}

const PHYSIO_RULES: PhysioRule[] = [
  { keywords: ["pneumonia", "community-acquired pneumonia"], stateMatches: ["respiratory_compromise", "hypoxia", "tachypnea", "inflammatory", "fever"], boostWeight: 1.4, contradictWeight: 0.6 },
  { keywords: ["pulmonary embolism", "pe"], stateMatches: ["hypoxia", "tachycardia", "respiratory_compromise"], boostWeight: 1.5, contradictWeight: 0.5 },
  { keywords: ["acute coronary syndrome", "acs", "myocardial infarction", "mi", "nstemi", "stemi"], stateMatches: ["tachycardia", "hemodynamic_instability", "hypertension"], boostWeight: 1.4, contradictWeight: 0.6 },
  { keywords: ["hypoglycemia", "hypoglycemic"], stateMatches: ["hypoglycemia", "metabolic_derangement"], boostWeight: 1.5, contradictWeight: 0.4 },
  { keywords: ["meningitis", "encephalitis"], stateMatches: ["fever", "inflammatory", "neurological"], boostWeight: 1.5, contradictWeight: 0.5 },
  { keywords: ["appendicitis"], stateMatches: ["inflammatory", "fever", "tachycardia"], boostWeight: 1.3, contradictWeight: 0.7 },
  { keywords: ["stroke", "cerebrovascular", "cva", "tia"], stateMatches: ["hypertension", "neurological"], boostWeight: 1.4, contradictWeight: 0.6 },
];

function buildLegacyPhysioWeightMap(
  physiology: PhysiologicalContextResult | null,
  bayesianDiagnoses: BayesianDiagnosis[],
  nameMap: Map<string, string>,
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
    const name = (nameMap.get(d.diagnosis_id) || (d as any).diagnosis_name || d.diagnosis_id || "").toLowerCase();
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

// ── Convert CanonicalDiseaseProfile → DiseaseSystemicProfile for computePhysioMultiplier ──

function toSystemicProfile(canonical: CanonicalDiseaseProfile): DiseaseSystemicProfile {
  return {
    type: canonical.category,
    requires_systemic_instability: canonical.requires_systemic_instability,
    systemic_weight: canonical.systemic_weight,
    keywords: canonical.phenotype_keywords,
  };
}

// ── Main: Canonical Score Fusion ──

export function applyCanonicalScoreFusion(input: ScoreFusionInput): ScoreFusionOutput {
  const { bayesian, ddx, physiology, patternAdjustments, vitals, diagnosisNameMap } = input;

  if (!bayesian?.diagnoses?.length) {
    return { result: bayesian, diagnostics: [], fusion_applied: false, systemic_state: null };
  }

  // STEP 1: Systemic State
  const vitalsForState: VitalsInput = vitals || {};
  const systemicState = computeSystemicState(vitalsForState);

  console.log("[CANONICAL_FUSION] Systemic state:", {
    strength: systemicState.systemic_strength,
    severity: systemicState.severity,
    phenotype: systemicState.phenotype,
    signals: systemicState.signals,
  });

  // Build name map for pattern/legacy physio layers
  const nameMap = diagnosisNameMap || new Map<string, string>();

  // Build weight maps
  const ddxMap = buildDDXWeightMap(ddx);
  const patternMap = buildPatternWeightMap(patternAdjustments, bayesian.diagnoses, nameMap);
  const legacyPhysioMap = buildLegacyPhysioWeightMap(physiology, bayesian.diagnoses, nameMap);

  const hasUpstream = ddxMap.size > 0 || patternMap.size > 0 || legacyPhysioMap.size > 0 || systemicState.signal_count > 0;
  if (!hasUpstream) {
    console.log("[CANONICAL_FUSION] No upstream intelligence — passing through unchanged.");
    return { result: bayesian, diagnostics: [], fusion_applied: false, systemic_state: systemicState };
  }

  console.log("[CANONICAL_FUSION] === ID-BASED PHYSIOLOGY-FIRST FUSION ===");

  // STEP 2: Fuse scores with canonical profile resolution
  const diagnostics: FusionDiagnostics[] = [];
  const fusedScores: { diagnosis: BayesianDiagnosis; rawFused: number }[] = [];

  for (const d of bayesian.diagnoses) {
    const base = d.posterior_probability;
    const ddxW = ddxMap.get(d.diagnosis_id) ?? 1.0;
    const patternW = patternMap.get(d.diagnosis_id) ?? 1.0;
    const legacyPhysioW = legacyPhysioMap.get(d.diagnosis_id) ?? 1.0;

    // ── CANONICAL RESOLUTION (replaces string-based matchDiseaseProfile) ──
    const resolvedName = (d as any).diagnosis_name || nameMap.get(d.diagnosis_id) || null;
    const canonicalProfile = resolveCanonicalProfile(d.diagnosis_id, resolvedName);
    const resolutionMethod = getResolutionMethod(d.diagnosis_id, resolvedName);

    let physioMultiplier: number;
    if (canonicalProfile) {
      // Convert canonical profile → systemic profile for multiplier computation
      const systemicProfile = toSystemicProfile(canonicalProfile);
      physioMultiplier = computePhysioMultiplier(systemicState, systemicProfile);
      console.log(`[CANONICAL_RESOLVE] ${canonicalProfile.canonical_name} (${resolutionMethod}): category=${canonicalProfile.category} physio_mult=${physioMultiplier.toFixed(3)}`);
    } else {
      // NEUTRAL fallback — 1.0, NOT 0.7x suppression
      physioMultiplier = 1.0;
      console.warn(`[CANONICAL_PROFILE_MISSING] diagnosis_id=${d.diagnosis_id} name="${resolvedName}" method=${resolutionMethod} → neutral multiplier 1.0`);
    }

    const rawFused = base * physioMultiplier * (1 + ddxW) * patternW * legacyPhysioW;

    console.log(
      `[CANONICAL_ADJUST] ${resolvedName || d.diagnosis_id}: base=${(base * 100).toFixed(2)}% physio_mult=${physioMultiplier.toFixed(3)} ddx=${ddxW} pat=${patternW} legPhys=${legacyPhysioW} → raw=${(rawFused * 100).toFixed(2)}% [${canonicalProfile?.category || "unknown"}]`
    );

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

  // Normalise
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

  fusedDiagnoses.sort((a, b) => b.posterior_probability - a.posterior_probability);

  // Sum correction
  const finalSum = fusedDiagnoses.reduce((s, d) => s + d.posterior_probability, 0);
  if (fusedDiagnoses.length > 0 && Math.abs(finalSum - 1.0) > 0.001) {
    const correction = 1.0 - finalSum;
    fusedDiagnoses[0].posterior_probability = Math.round(
      (fusedDiagnoses[0].posterior_probability + correction) * 10000
    ) / 10000;
  }

  console.log("[CANONICAL_FUSION] === RESULT ===");
  console.log(
    `[CANONICAL_FUSION] severity=${systemicState.severity} phenotype=${systemicState.phenotype}. ` +
    `Top: ${(fusedDiagnoses[0] as any)?.diagnosis_name || fusedDiagnoses[0]?.diagnosis_id} ` +
    `(${(fusedDiagnoses[0]?.posterior_probability * 100).toFixed(1)}%)`
  );

  return {
    result: {
      ...bayesian,
      diagnoses: fusedDiagnoses,
      source: `${bayesian.source || "bayesian"}_canonical_fused`,
    },
    diagnostics,
    fusion_applied: true,
    systemic_state: systemicState,
  };
}
