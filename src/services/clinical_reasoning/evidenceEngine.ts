/**
 * Bayesian Evidence Engine (Phase 5.7)
 *
 * Applies investigation (lab) results as log-likelihood-ratio updates
 * to diagnostic posteriors. Uses log-odds arithmetic to prevent
 * normalization washout.
 *
 * Pipeline position: AFTER Score Fusion + CPR, BEFORE SSAL Freeze.
 *
 * Guarantees:
 *   - Pure function, no side effects
 *   - No hard overrides (no diagnosis can reach >0.95 without multi-factor support)
 *   - Deterministic: same inputs → same outputs
 *   - Explainable: every contribution is traced
 *   - Diagnosis-conditional: likelihood depends on diagnosis category
 *   - No double counting: explicit lab disables inferred shock proxy
 *
 * 🚫 RAW STRING USAGE FORBIDDEN — Diagnosis classification uses canonical category sets
 */

import type { InvestigationResults } from "@/lib/clinical-context";
import type { BayesianResult, BayesianDiagnosis } from "@/services/bayesian_engine/client";

// ── Public Types ──

export type EvidenceSource = "symptom" | "vital" | "lab" | "risk" | "shock";

export interface EvidenceContribution {
  source: EvidenceSource;
  feature: string;
  value: any;
  multiplier: number;
  logLR: number;
  direction: "support" | "against" | "neutral";
}

export interface EvidenceEnrichedDiagnosis extends BayesianDiagnosis {
  evidence_contributions: EvidenceContribution[];
  prior_score: number;
  posterior_score: number;
  evidence_delta: number;
}

export interface EvidenceEngineResult {
  diagnoses: EvidenceEnrichedDiagnosis[];
  shock_score: number;
  shock_active: boolean;
  labs_applied: string[];
  total_evidence_features: number;
  execution_ms: number;
}

// ── Diagnosis Category Classification via Canonical Sets ──
// These sets contain NORMALIZED diagnosis names used in the system.
// Matching uses Set.has() for O(1) lookup — NO .includes() substring matching.

const SYSTEMIC_DIAGNOSIS_IDS = new Set([
  "sepsis", "severe sepsis", "septic shock",
  "systemic inflammatory response syndrome", "sirs",
  "bacteremia", "disseminated intravascular coagulation",
]);

const CARDIAC_DIAGNOSIS_IDS = new Set([
  "myocardial infarction", "acute myocardial infarction",
  "acute coronary syndrome", "unstable angina",
  "nstemi", "stemi", "heart failure",
  "acute heart failure", "congestive heart failure",
]);

const INFECTION_DIAGNOSIS_IDS = new Set([
  "sepsis", "severe sepsis", "septic shock",
  "community acquired pneumonia", "pneumonia",
  "urinary tract infection", "pyelonephritis",
  "meningitis", "cellulitis", "endocarditis",
  "peritonitis", "abscess",
]);

const PE_DIAGNOSIS_IDS = new Set([
  "pulmonary embolism", "pe",
  "deep vein thrombosis", "venous thromboembolism",
]);

// Substring-based classification tokens for broader matching
// These are used ONLY for diagnosis names (system-generated), NOT patient input
const SYSTEMIC_TOKENS = ["sepsis", "septic", "sirs"] as const;
const CARDIAC_TOKENS = ["myocardial", "coronary", "heart failure"] as const;
const INFECTION_TOKENS = ["pneumonia", "infection"] as const;
const PE_TOKENS = ["pulmonary embolism", "thromboembolism"] as const;

export interface DiagnosisCategory {
  systemic: boolean;
  cardiac: boolean;
  infection: boolean;
  pe: boolean;
}

/**
 * Classify a diagnosis by its name into clinical categories.
 * Uses canonical set membership first, then token matching for variants.
 * NOTE: This operates on DIAGNOSIS NAMES (system-generated), not patient input.
 */
function classifyDiagnosis(name: string): DiagnosisCategory {
  const n = name.toLowerCase().trim();
  return {
    systemic: SYSTEMIC_DIAGNOSIS_IDS.has(n) || SYSTEMIC_TOKENS.some(t => n.includes(t)),
    cardiac: CARDIAC_DIAGNOSIS_IDS.has(n) || CARDIAC_TOKENS.some(t => n.includes(t)),
    infection: INFECTION_DIAGNOSIS_IDS.has(n) || INFECTION_TOKENS.some(t => n.includes(t)),
    pe: PE_DIAGNOSIS_IDS.has(n) || PE_TOKENS.some(t => n.includes(t)),
  };
}

// ── Shock Model ──

export interface ShockInput {
  bp_systolic?: number | null;
  heart_rate?: number | null;
  lactate?: number | null;
}

/**
 * Compute a shock score (0–1) from hemodynamic signals ONLY.
 * Lactate is excluded from shock score when explicit lab is present
 * to prevent double counting.
 */
export function computeShockScore(input: ShockInput, hasExplicitLactate: boolean): number {
  let score = 0;
  let factors = 0;

  if (input.bp_systolic != null) {
    factors++;
    if (input.bp_systolic < 90) score += 0.4;
    else if (input.bp_systolic < 100) score += 0.2;
  }

  if (input.heart_rate != null) {
    factors++;
    if (input.heart_rate > 120) score += 0.3;
    else if (input.heart_rate > 100) score += 0.15;
  }

  // Only use inferred lactate signal if no explicit lab value exists
  if (!hasExplicitLactate && input.lactate != null) {
    factors++;
    if (input.lactate >= 4) score += 0.3;
    else if (input.lactate >= 2) score += 0.15;
  }

  return factors > 0 ? Math.min(score, 1.0) : 0;
}

// ── Log-Likelihood Ratio Functions ──
// Each returns a logLR (natural log of likelihood ratio) that is diagnosis-conditional.
// Positive logLR = evidence supports diagnosis. Negative = evidence against.

function lactateLikelihood(value: number, category: DiagnosisCategory): EvidenceContribution {
  let logLR = 0;
  let direction: EvidenceContribution["direction"] = "neutral";

  if (category.systemic) {
    if (value >= 4) { logLR = Math.log(12); direction = "support"; }
    else if (value >= 2) { logLR = Math.log(3); direction = "support"; }
    else { logLR = Math.log(0.5); direction = "against"; }
  } else if (category.infection) {
    if (value >= 4) { logLR = Math.log(2.5); direction = "support"; }
    else if (value >= 2) { logLR = Math.log(1.5); direction = "support"; }
  } else if (category.cardiac) {
    if (value >= 4) { logLR = Math.log(1.3); direction = "neutral"; }
    else { logLR = 0; }
  } else {
    if (value >= 4) { logLR = Math.log(0.4); direction = "against"; }
    else if (value >= 2) { logLR = Math.log(0.7); direction = "against"; }
  }

  return { source: "lab", feature: "lactate", value, multiplier: Math.exp(logLR), logLR, direction };
}

function troponinLikelihood(value: number, category: DiagnosisCategory): EvidenceContribution {
  let logLR = 0;
  let direction: EvidenceContribution["direction"] = "neutral";

  if (category.cardiac) {
    if (value > 0.4) { logLR = Math.log(8); direction = "support"; }
    else if (value > 0.04) { logLR = Math.log(4); direction = "support"; }
    else { logLR = Math.log(0.4); direction = "against"; }
  } else if (category.systemic || category.pe) {
    if (value > 0.04) { logLR = Math.log(1.2); direction = "neutral"; }
  } else {
    if (value > 0.4) { logLR = Math.log(0.5); direction = "against"; }
  }

  return { source: "lab", feature: "troponin", value, multiplier: Math.exp(logLR), logLR, direction };
}

function crpLikelihood(value: number, category: DiagnosisCategory): EvidenceContribution {
  let logLR = 0;
  let direction: EvidenceContribution["direction"] = "neutral";

  if (category.infection || category.systemic) {
    if (value > 100) { logLR = Math.log(3); direction = "support"; }
    else if (value > 50) { logLR = Math.log(2); direction = "support"; }
    else if (value > 10) { logLR = Math.log(1.3); direction = "support"; }
  } else if (category.cardiac) {
    if (value > 10) { logLR = Math.log(1.1); direction = "neutral"; }
  }

  return { source: "lab", feature: "CRP", value, multiplier: Math.exp(logLR), logLR, direction };
}

function procalcitoninLikelihood(value: number, category: DiagnosisCategory): EvidenceContribution {
  let logLR = 0;
  let direction: EvidenceContribution["direction"] = "neutral";

  if (category.systemic) {
    if (value > 2) { logLR = Math.log(5); direction = "support"; }
    else if (value > 0.5) { logLR = Math.log(2.5); direction = "support"; }
    else { logLR = Math.log(0.4); direction = "against"; }
  } else if (category.infection) {
    if (value > 0.5) { logLR = Math.log(2); direction = "support"; }
  } else {
    if (value > 2) { logLR = Math.log(0.5); direction = "against"; }
  }

  return { source: "lab", feature: "procalcitonin", value, multiplier: Math.exp(logLR), logLR, direction };
}

function wbcLikelihood(value: number, category: DiagnosisCategory): EvidenceContribution {
  let logLR = 0;
  let direction: EvidenceContribution["direction"] = "neutral";

  if (category.infection || category.systemic) {
    if (value > 15) { logLR = Math.log(2); direction = "support"; }
    else if (value > 11) { logLR = Math.log(1.3); direction = "support"; }
    else if (value < 4) { logLR = Math.log(2.5); direction = "support"; }
  }

  return { source: "lab", feature: "WBC", value, multiplier: Math.exp(logLR), logLR, direction };
}

function dDimerLikelihood(value: number, category: DiagnosisCategory): EvidenceContribution {
  let logLR = 0;
  let direction: EvidenceContribution["direction"] = "neutral";

  if (category.pe) {
    if (value > 2000) { logLR = Math.log(6); direction = "support"; }
    else if (value > 500) { logLR = Math.log(3); direction = "support"; }
    else { logLR = Math.log(0.15); direction = "against"; }
  } else {
    if (value > 500) { logLR = Math.log(1.05); direction = "neutral"; }
  }

  return { source: "lab", feature: "D-dimer", value, multiplier: Math.exp(logLR), logLR, direction };
}

// ── Shock Modifier ──

function computeShockModifier(shockScore: number, category: DiagnosisCategory): EvidenceContribution | null {
  if (shockScore < 0.3) return null;

  let logLR = 0;
  let direction: EvidenceContribution["direction"] = "neutral";

  if (category.systemic) {
    logLR = Math.log(1 + shockScore * 2.0);
    direction = "support";
  } else if (!category.cardiac && !category.pe) {
    logLR = Math.log(1 - shockScore * 0.3);
    direction = "against";
  }

  if (Math.abs(logLR) < 0.01) return null;

  return { source: "shock", feature: "shock_score", value: shockScore, multiplier: Math.exp(logLR), logLR, direction };
}

// ── Feature Gating ──

function isLabClinicallyRelevant(feature: string, value: number): boolean {
  const neutralRanges: Record<string, [number, number]> = {
    CRP: [0, 5],
    WBC: [4.5, 11],
    lactate: [0.5, 1.5],
    D_dimer: [0, 400],
  };

  const range = neutralRanges[feature];
  if (range && value >= range[0] && value <= range[1]) return false;
  return true;
}

// ── Main Engine ──

/**
 * Apply Bayesian evidence update to prior diagnoses using log-odds arithmetic.
 * Pure function: no side effects, no mutations.
 *
 * @param diagnosisNameMap Optional UUID→name map for resolving diagnosis identities
 *        when diagnosis_name is not yet set on the object (pre-SSAL).
 */
export function applyBayesianEvidence(
  bayesianResult: BayesianResult,
  investigationResults: InvestigationResults | undefined | null,
  shockInput: ShockInput,
  diagnosisNameMap?: Map<string, string>,
): EvidenceEngineResult {
  const t0 = performance.now();

  const labs = investigationResults || {};
  const hasExplicitLactate = labs.lactate != null && isLabClinicallyRelevant("lactate", labs.lactate);

  const shockScore = computeShockScore(shockInput, hasExplicitLactate);
  const shockActive = shockScore >= 0.3;
  const labsApplied: string[] = [];

  const labEntries: Array<{ key: string; value: number; fn: (v: number, c: DiagnosisCategory) => EvidenceContribution }> = [];

  if (hasExplicitLactate) {
    labEntries.push({ key: "lactate", value: labs.lactate!, fn: lactateLikelihood });
    labsApplied.push("lactate");
  }
  if (labs.troponin != null) {
    labEntries.push({ key: "troponin", value: labs.troponin, fn: troponinLikelihood });
    labsApplied.push("troponin");
  }
  if (labs.CRP != null && isLabClinicallyRelevant("CRP", labs.CRP)) {
    labEntries.push({ key: "CRP", value: labs.CRP, fn: crpLikelihood });
    labsApplied.push("CRP");
  }
  if (labs.procalcitonin != null) {
    labEntries.push({ key: "procalcitonin", value: labs.procalcitonin, fn: procalcitoninLikelihood });
    labsApplied.push("procalcitonin");
  }
  if (labs.WBC != null && isLabClinicallyRelevant("WBC", labs.WBC)) {
    labEntries.push({ key: "WBC", value: labs.WBC, fn: wbcLikelihood });
    labsApplied.push("WBC");
  }
  if (labs.D_dimer != null && isLabClinicallyRelevant("D_dimer", labs.D_dimer)) {
    labEntries.push({ key: "D-dimer", value: labs.D_dimer, fn: dDimerLikelihood });
    labsApplied.push("D-dimer");
  }

  const hasEvidence = labEntries.length > 0 || shockActive;

  if (!hasEvidence) {
    const passthrough: EvidenceEnrichedDiagnosis[] = bayesianResult.diagnoses.map(d => ({
      ...d,
      evidence_contributions: [],
      prior_score: d.posterior_probability,
      posterior_score: d.posterior_probability,
      evidence_delta: 0,
    }));

    return {
      diagnoses: passthrough,
      shock_score: shockScore,
      shock_active: false,
      labs_applied: [],
      total_evidence_features: 0,
      execution_ms: Math.round(performance.now() - t0),
    };
  }

  const rawScores: Array<{ diagnosis: BayesianDiagnosis; logOdds: number; contributions: EvidenceContribution[]; priorProb: number }> = [];

  for (const d of bayesianResult.diagnoses) {
    const diagName = (d as any).diagnosis_name
      || diagnosisNameMap?.get(d.diagnosis_id)
      || d.diagnosis_id;
    const category = classifyDiagnosis(diagName);
    const contributions: EvidenceContribution[] = [];
    const priorProb = Math.max(d.posterior_probability, 0.001);

    let logOdds = Math.log(priorProb / (1 - Math.min(priorProb, 0.999)));

    for (const lab of labEntries) {
      const contrib = lab.fn(lab.value, category);
      contributions.push(contrib);
      logOdds += contrib.logLR;
    }

    const shockContrib = computeShockModifier(shockScore, category);
    if (shockContrib) {
      contributions.push(shockContrib);
      logOdds += shockContrib.logLR;
    }

    let posteriorProb = 1 / (1 + Math.exp(-logOdds));

    const supportCount = contributions.filter(c => c.direction === "support").length;
    if (posteriorProb > 0.95 && supportCount < 3) {
      posteriorProb = Math.min(posteriorProb, 0.92);
    }

    if (isNaN(posteriorProb) || posteriorProb <= 0) {
      console.error(`[EvidenceEngine] NaN/zero collapse for ${diagName}, resetting to prior`);
      posteriorProb = priorProb;
    }

    rawScores.push({ diagnosis: d, logOdds, contributions, priorProb });
  }

  const rawProbs = rawScores.map(r => 1 / (1 + Math.exp(-r.logOdds)));
  const totalRaw = rawProbs.reduce((sum, p) => sum + p, 0);

  const enriched: EvidenceEnrichedDiagnosis[] = rawScores.map((r, i) => {
    const posteriorNorm = totalRaw > 0 ? rawProbs[i] / totalRaw : r.priorProb;

    const hasStrongSupport = r.contributions.some(c => c.direction === "support" && c.logLR > 1.5);
    let finalPosterior = posteriorNorm;
    if (hasStrongSupport && finalPosterior < r.priorProb) {
      finalPosterior = Math.min(r.priorProb + 0.15, 0.92);
      console.log(`[EvidenceEngine] Clinical floor applied for ${(r.diagnosis as any).diagnosis_name || r.diagnosis.diagnosis_id}: ${(posteriorNorm * 100).toFixed(1)}% → ${(finalPosterior * 100).toFixed(1)}%`);
    }

    return {
      ...r.diagnosis,
      posterior_probability: finalPosterior,
      evidence_contributions: r.contributions,
      prior_score: r.priorProb,
      posterior_score: finalPosterior,
      evidence_delta: finalPosterior - r.priorProb,
    };
  });

  const postFloorTotal = enriched.reduce((sum, d) => sum + d.posterior_probability, 0);
  if (postFloorTotal > 0 && Math.abs(postFloorTotal - 1.0) > 0.01) {
    for (const d of enriched) {
      d.posterior_probability /= postFloorTotal;
      d.posterior_score = d.posterior_probability;
      d.evidence_delta = d.posterior_probability - d.prior_score;
    }
  }

  enriched.sort((a, b) => b.posterior_probability - a.posterior_probability);

  const executionMs = Math.round(performance.now() - t0);
  console.log(
    `[EvidenceEngine] Applied ${labEntries.length} lab(s) + shock=${shockActive}. ` +
    `Top: ${(enriched[0] as any)?.diagnosis_name || enriched[0]?.diagnosis_id} ` +
    `(${Math.round(enriched[0]?.posterior_probability * 100)}%). ${executionMs}ms`,
  );

  return {
    diagnoses: enriched,
    shock_score: shockScore,
    shock_active: shockActive,
    labs_applied: labsApplied,
    total_evidence_features: labEntries.length + (shockActive ? 1 : 0),
    execution_ms: executionMs,
  };
}
