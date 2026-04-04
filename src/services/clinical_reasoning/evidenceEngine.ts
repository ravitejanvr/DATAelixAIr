/**
 * Bayesian Evidence Engine
 *
 * Applies investigation (lab) results as likelihood multipliers to update
 * prior diagnostic probabilities into posterior probabilities.
 *
 * Pipeline position: AFTER Score Fusion + CPR, BEFORE SSAL Freeze.
 *
 * Guarantees:
 *   - Pure function, no side effects
 *   - No hard overrides (no diagnosis can reach >0.95 without multi-factor support)
 *   - Deterministic: same inputs → same outputs
 *   - Explainable: every contribution is traced
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
  additive_boost?: number;
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

// ── Diagnosis Category Helpers ──

const SYSTEMIC_DIAGNOSES = new Set([
  "sepsis", "severe sepsis", "septic shock", "systemic inflammatory response syndrome",
  "sirs", "bacteremia", "disseminated intravascular coagulation",
]);

const CARDIAC_DIAGNOSES = new Set([
  "myocardial infarction", "acute myocardial infarction", "acute coronary syndrome",
  "unstable angina", "nstemi", "stemi", "heart failure", "acute heart failure",
  "congestive heart failure",
]);

const INFECTION_DIAGNOSES = new Set([
  "sepsis", "severe sepsis", "septic shock", "community acquired pneumonia",
  "pneumonia", "urinary tract infection", "pyelonephritis", "meningitis",
  "cellulitis", "endocarditis", "peritonitis", "abscess",
]);

const PE_DIAGNOSES = new Set([
  "pulmonary embolism", "pe", "deep vein thrombosis", "venous thromboembolism",
]);

const SYSTEMIC_DIAGNOSIS_KEYWORDS = [
  "sepsis", "septic", "urosepsis", "systemic inflammatory", "sirs", "bacteremia",
  "disseminated intravascular coagulation",
];

const CARDIAC_DIAGNOSIS_KEYWORDS = [
  "myocardial infarction", "acute coronary", "unstable angina", "nstemi", "stemi", "heart failure",
];

const INFECTION_DIAGNOSIS_KEYWORDS = [
  "sepsis", "septic", "pneumonia", "urinary tract infection", "pyelonephritis", "meningitis",
  "cellulitis", "endocarditis", "peritonitis", "abscess",
];

const PE_DIAGNOSIS_KEYWORDS = [
  "pulmonary embol", "deep vein thrombosis", "venous thromboembol",
];

function hasDiagnosisKeyword(name: string, keywords: string[]): boolean {
  return keywords.some(keyword => name.includes(keyword));
}

function classifyDiagnosis(name: string): { systemic: boolean; cardiac: boolean; infection: boolean; pe: boolean } {
  const n = name.toLowerCase().trim();
  return {
    systemic: SYSTEMIC_DIAGNOSES.has(n) || hasDiagnosisKeyword(n, SYSTEMIC_DIAGNOSIS_KEYWORDS),
    cardiac: CARDIAC_DIAGNOSES.has(n) || hasDiagnosisKeyword(n, CARDIAC_DIAGNOSIS_KEYWORDS),
    infection: INFECTION_DIAGNOSES.has(n) || hasDiagnosisKeyword(n, INFECTION_DIAGNOSIS_KEYWORDS),
    pe: PE_DIAGNOSES.has(n) || hasDiagnosisKeyword(n, PE_DIAGNOSIS_KEYWORDS),
  };
}

function getDiagnosisLabel(diagnosis: BayesianDiagnosis | EvidenceEnrichedDiagnosis): string {
  return (((diagnosis as any).diagnosis_name || diagnosis.diagnosis_id || "") as string).toLowerCase().trim();
}

function isSepsisDiagnosis(diagnosis: BayesianDiagnosis | EvidenceEnrichedDiagnosis): boolean {
  const label = getDiagnosisLabel(diagnosis);
  return label.includes("sepsis") || label.includes("septic shock") || label.includes("severe sepsis") || label.includes("urosepsis");
}

// ── Shock Model ──

export interface ShockInput {
  bp_systolic?: number | null;
  heart_rate?: number | null;
  lactate?: number | null;
}

/**
 * Compute a shock score (0–1) from hemodynamic signals.
 * When explicit lactate lab is available, lactate is excluded from shock
 * to prevent double-counting (lactate likelihood handles it instead).
 */
export function computeShockScore(input: ShockInput, hasExplicitLactate = false): number {
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

  // Only include lactate in shock if no explicit lab result exists
  if (!hasExplicitLactate && input.lactate != null) {
    factors++;
    if (input.lactate >= 4) score += 0.3;
    else if (input.lactate >= 2) score += 0.15;
  }

  return factors > 0 ? Math.min(score, 1.0) : 0;
}

// ── Lab Likelihood Functions ──

function lactateLikelihood(value: number, category: ReturnType<typeof classifyDiagnosis>): EvidenceContribution {
  let multiplier = 1.0;
  let direction: EvidenceContribution["direction"] = "neutral";

  if (category.systemic) {
    // Sepsis/SIRS: strong discriminator
    if (value >= 4) {
      multiplier = Math.min(12, 8 + Math.max(0, value - 4) * 1.5);
      direction = "support";
    }
    else if (value >= 2) {
      multiplier = Math.min(5, 2.5 + Math.max(0, value - 2) * 1.25);
      direction = "support";
    }
    else { multiplier = 0.55; direction = "against"; }
  } else if (category.infection) {
    // Non-systemic infections: lactate is mildly relevant, NOT a strong signal
    if (value >= 4) { multiplier = 1.15; direction = "neutral"; }
    else if (value >= 2) { multiplier = 1.05; direction = "neutral"; }
  } else if (category.pe) {
    // PE: lactate weakly relevant
    if (value >= 4) { multiplier = 1.1; direction = "neutral"; }
  } else {
    // All other diagnoses: elevated lactate suppresses
    if (value >= 4) { multiplier = 0.5; direction = "against"; }
    else if (value >= 2) { multiplier = 0.7; direction = "against"; }
  }

  return { source: "lab", feature: "lactate", value, multiplier, direction };
}

function lactateClinicalBoost(value: number, category: ReturnType<typeof classifyDiagnosis>): EvidenceContribution | null {
  if (!category.systemic || value < 4) return null;

  const additiveBoost = Math.min(0.2, 0.12 + Math.max(0, value - 4) * 0.03);
  return {
    source: "lab",
    feature: "lactate_clinical_boost",
    value,
    multiplier: 1,
    additive_boost: additiveBoost,
    direction: "support",
  };
}

function troponinLikelihood(value: number, category: ReturnType<typeof classifyDiagnosis>): EvidenceContribution {
  let multiplier = 1.0;
  let direction: EvidenceContribution["direction"] = "neutral";

  if (category.cardiac) {
    if (value > 0.4) { multiplier = 4.0; direction = "support"; }
    else if (value > 0.04) { multiplier = 2.5; direction = "support"; }
    else { multiplier = 0.6; direction = "against"; }
  } else if (category.systemic || category.pe) {
    // Slight elevation in sepsis/PE is possible
    if (value > 0.04) { multiplier = 1.1; direction = "neutral"; }
  } else {
    if (value > 0.4) { multiplier = 0.6; direction = "against"; }
  }

  return { source: "lab", feature: "troponin", value, multiplier, direction };
}

function crpLikelihood(value: number, category: ReturnType<typeof classifyDiagnosis>): EvidenceContribution {
  let multiplier = 1.0;
  let direction: EvidenceContribution["direction"] = "neutral";

  if (category.infection || category.systemic) {
    if (value > 100) { multiplier = 2.0; direction = "support"; }
    else if (value > 50) { multiplier = 1.5; direction = "support"; }
    else if (value > 10) { multiplier = 1.2; direction = "support"; }
  } else if (category.cardiac) {
    if (value > 10) { multiplier = 1.1; direction = "neutral"; }
  }

  return { source: "lab", feature: "CRP", value, multiplier, direction };
}

function procalcitoninLikelihood(value: number, category: ReturnType<typeof classifyDiagnosis>): EvidenceContribution {
  let multiplier = 1.0;
  let direction: EvidenceContribution["direction"] = "neutral";

  if (category.systemic) {
    if (value > 2) { multiplier = 3.0; direction = "support"; }
    else if (value > 0.5) { multiplier = 2.0; direction = "support"; }
    else { multiplier = 0.5; direction = "against"; }
  } else if (category.infection) {
    if (value > 0.5) { multiplier = 1.5; direction = "support"; }
  } else {
    if (value > 2) { multiplier = 0.7; direction = "against"; }
  }

  return { source: "lab", feature: "procalcitonin", value, multiplier, direction };
}

function wbcLikelihood(value: number, category: ReturnType<typeof classifyDiagnosis>): EvidenceContribution {
  let multiplier = 1.0;
  let direction: EvidenceContribution["direction"] = "neutral";

  if (category.infection || category.systemic) {
    if (value > 15) { multiplier = 1.5; direction = "support"; }
    else if (value > 11) { multiplier = 1.2; direction = "support"; }
    else if (value < 4) { multiplier = 1.8; direction = "support"; } // Leukopenia → severe sepsis
  }

  return { source: "lab", feature: "WBC", value, multiplier, direction };
}

function dDimerLikelihood(value: number, category: ReturnType<typeof classifyDiagnosis>): EvidenceContribution {
  let multiplier = 1.0;
  let direction: EvidenceContribution["direction"] = "neutral";

  if (category.pe) {
    if (value > 2000) { multiplier = 3.5; direction = "support"; }
    else if (value > 500) { multiplier = 2.0; direction = "support"; }
    else { multiplier = 0.3; direction = "against"; } // Normal D-dimer strongly rules out PE
  } else {
    // Non-specific marker — weak/no effect on non-PE
    if (value > 500) { multiplier = 1.05; direction = "neutral"; }
  }

  return { source: "lab", feature: "D-dimer", value, multiplier, direction };
}

// ── Shock Modifier ──

function computeShockModifier(shockScore: number, category: ReturnType<typeof classifyDiagnosis>): EvidenceContribution | null {
  if (shockScore < 0.3) return null;

  let multiplier = 1.0;
  let direction: EvidenceContribution["direction"] = "neutral";

  if (category.systemic) {
    multiplier = 1 + shockScore * 2.0; // Up to ×3.0
    direction = "support";
  } else if (!category.cardiac && !category.pe) {
    multiplier = 1 - shockScore * 0.3; // Down to ×0.7
    direction = "against";
  }

  if (multiplier === 1.0) return null;

  return { source: "shock", feature: "shock_score", value: shockScore, multiplier, direction };
}

// ── Feature Gating ──

function isLabClinicallyRelevant(feature: string, value: number): boolean {
  // Neutral-zone values that should not influence ranking
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
 * Apply Bayesian evidence update to prior diagnoses.
 * Pure function: no side effects, no mutations.
 */
export function applyBayesianEvidence(
  bayesianResult: BayesianResult,
  investigationResults: InvestigationResults | undefined | null,
  shockInput: ShockInput,
): EvidenceEngineResult {
  const t0 = performance.now();

  // Detect explicit lactate to prevent double-counting with shock model
  const labs = investigationResults || {};
  const hasExplicitLactate = labs.lactate != null && isLabClinicallyRelevant("lactate", labs.lactate);

  const shockScore = computeShockScore(shockInput, hasExplicitLactate);
  const shockActive = shockScore >= 0.3;
  const labsApplied: string[] = [];

  if (hasExplicitLactate) {
    console.log("[EvidenceEngine] Explicit lactate detected — excluded from shock score to prevent double-counting");
  }

  // Determine which labs are present and relevant
  const labEntries: Array<{ key: string; value: number; fn: (v: number, c: ReturnType<typeof classifyDiagnosis>) => EvidenceContribution }> = [];

  if (labs.lactate != null && isLabClinicallyRelevant("lactate", labs.lactate)) {
    labEntries.push({ key: "lactate", value: labs.lactate, fn: lactateLikelihood });
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

  // If no evidence to apply, return enriched but unmodified diagnoses
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

  // Apply evidence multipliers
  const rawScores: Array<{ diagnosis: BayesianDiagnosis; score: number; contributions: EvidenceContribution[] }> = [];

  for (const d of bayesianResult.diagnoses) {
    const diagName = (d as any).diagnosis_name || d.diagnosis_id;
    const category = classifyDiagnosis(diagName);
    const contributions: EvidenceContribution[] = [];
    let score = d.posterior_probability;
    const priorScore = score;

    // Apply lab likelihoods
    for (const lab of labEntries) {
      const contrib = lab.fn(lab.value, category);
      contributions.push(contrib);
      score *= contrib.multiplier;

      if (lab.key === "lactate") {
        const boost = lactateClinicalBoost(lab.value, category);
        if (boost) {
          contributions.push(boost);
          score += boost.additive_boost || 0;
        }
      }
    }

    // Apply shock modifier only when explicit lactate is absent
    // When lactate lab exists, it is the sole perfusion-related contributor
    if (!hasExplicitLactate) {
      const shockContrib = computeShockModifier(shockScore, category);
      if (shockContrib) {
        contributions.push(shockContrib);
        score *= shockContrib.multiplier;
      }
    }

    // Guardrail: no single diagnosis can exceed 0.95 without ≥3 supporting factors
    const supportCount = contributions.filter(c => c.direction === "support").length;
    if (score > 0.95 && supportCount < 3) {
      score = Math.min(score, 0.92);
    }

    // Guardrail: no NaN or zero collapse
    if (isNaN(score) || score <= 0) {
      console.error(`[EvidenceEngine] NaN/zero collapse for ${diagName}, resetting to prior`);
      score = priorScore;
    }

    rawScores.push({ diagnosis: d, score, contributions });
  }

  // Normalize to sum to 1.0
  const totalRaw = rawScores.reduce((sum, r) => sum + r.score, 0);
  const enriched: EvidenceEnrichedDiagnosis[] = rawScores.map(r => {
    const posteriorNorm = totalRaw > 0 ? r.score / totalRaw : r.diagnosis.posterior_probability;
    return {
      ...r.diagnosis,
      posterior_probability: posteriorNorm,
      evidence_contributions: r.contributions,
      prior_score: r.diagnosis.posterior_probability,
      posterior_score: posteriorNorm,
      evidence_delta: posteriorNorm - r.diagnosis.posterior_probability,
    };
  });

  // Sort by posterior descending (preserve stable ranking)
  enriched.sort((a, b) => b.posterior_probability - a.posterior_probability);

  const sepsisBefore = bayesianResult.diagnoses.find(isSepsisDiagnosis);
  const sepsisAfter = enriched.find(isSepsisDiagnosis);
  if (sepsisBefore || sepsisAfter) {
    const lactateContribution = sepsisAfter?.evidence_contributions.find(c => c.feature === "lactate");
    const lactateBoost = sepsisAfter?.evidence_contributions.find(c => c.feature === "lactate_clinical_boost");
    console.log("[EvidenceEngine] Sepsis posterior shift", {
      before: sepsisBefore?.posterior_probability ?? null,
      after: sepsisAfter?.posterior_probability ?? null,
      delta: (sepsisAfter?.posterior_probability ?? 0) - (sepsisBefore?.posterior_probability ?? 0),
      lactate: labs.lactate ?? null,
      lactate_multiplier: lactateContribution?.multiplier ?? null,
      lactate_additive_boost: lactateBoost?.additive_boost ?? null,
    });
  }

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
