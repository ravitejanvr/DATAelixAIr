/**
 * Physiology vs Bayesian Disagreement Analyzer
 * 
 * Pure observability layer — does NOT modify any scores, rankings, or pipeline state.
 * Exposes where physiology signals and Bayesian posteriors disagree.
 * 
 * SSAL-compliant: Uses canonical_name and rank from self-describing diagnosis objects.
 * No external name maps required.
 */

// ── Types ──

interface SystemicSignals {
  hypotension: boolean;
  tachycardia: boolean;
  tachypnea: boolean;
  fever: boolean;
  hypoxia: boolean;
}

type SystemicState = "HIGH" | "MODERATE" | "LOW";
type DisagreementType = "SYSTEMIC_MISSED" | "ORGAN_MISSED" | "ALIGNED_SYSTEMIC" | "ALIGNED_ORGAN" | "ALIGNED";

export interface PhysioBayesianDiff {
  physiology: {
    systemic_state: SystemicState;
    systemic_score: number;
    confidence: number;
    signals: SystemicSignals;
    affected_systems: string[];
    candidate_diagnosis_ids: string[];
  };
  bayesian: {
    top_3: Array<{ name: string; prob: number }>;
    sepsis_rank: number;
    pneumonia_rank: number;
  };
  disagreement: {
    type: DisagreementType;
    explanation: string;
  };
}

/** SSAL-enriched diagnosis object */
interface SSALDiagnosis {
  diagnosis_id?: string;
  diagnosis_name?: string;
  canonical_name?: string;
  rank?: number;
  posterior_probability?: number;
  [key: string]: any;
}

interface AnalysisInput {
  physiological_states?: any[];
  affected_systems?: string[];
  candidate_diagnosis_ids?: string[];
  bayesian_diagnoses?: SSALDiagnosis[];
  symptoms?: string[];
  vitals?: {
    temperature?: number;
    pulse?: number;
    bp_systolic?: number;
    bp_diastolic?: number;
    respiratory_rate?: number;
    spo2?: number;
  };
  /** @deprecated Use canonical_name from diagnosis objects instead */
  diagnosisNameMap?: Map<string, string>;
}

// ── Helpers ──

function countTrue(signals: Record<string, boolean>): number {
  return Object.values(signals).filter(Boolean).length;
}

function classifyState(score: number): SystemicState {
  if (score >= 2) return "HIGH";
  if (score === 1) return "MODERATE";
  return "LOW";
}

function isSepsisLike(name: string): boolean {
  return /sepsis|septic|sirs|bacteremia|urosepsis/i.test(name);
}

function isPneumoniaLike(name: string): boolean {
  return /pneumonia|cap\b|community.acquired/i.test(name);
}

/** Resolve display name from SSAL diagnosis — uses canonical_name/diagnosis_name directly */
function resolveName(d: SSALDiagnosis, nameMap?: Map<string, string>): string {
  // SSAL priority: use self-describing fields first
  if (d.diagnosis_name) return d.diagnosis_name;
  if (d.canonical_name) return d.canonical_name;
  // Legacy fallback: external name map
  if (nameMap && d.diagnosis_id) {
    const mapped = nameMap.get(d.diagnosis_id);
    if (mapped) return mapped;
  }
  return d.diagnosis_id ?? "unknown";
}

function findRank(
  diagnoses: SSALDiagnosis[],
  matcher: (name: string) => boolean,
  nameMap?: Map<string, string>
): number {
  // SSAL: if diagnoses have rank field, use it directly
  for (const d of diagnoses) {
    const name = resolveName(d, nameMap);
    if (matcher(name) && d.rank != null) return d.rank;
  }
  // Fallback: compute from sorted order
  const sorted = [...diagnoses].sort(
    (a, b) => (b.posterior_probability ?? 0) - (a.posterior_probability ?? 0)
  );
  for (let i = 0; i < sorted.length; i++) {
    const name = resolveName(sorted[i], nameMap);
    if (matcher(name)) return i + 1;
  }
  return sorted.length + 1;
}

// ── Main Analysis Function ──

export function analyzePhysiologyBayesianMismatch(input: AnalysisInput): PhysioBayesianDiff {
  const vitals = input.vitals ?? {};
  const diagnoses = input.bayesian_diagnoses ?? [];
  const nameMap = input.diagnosisNameMap;

  // Step 1: Derive systemic signals from vitals
  const signals: SystemicSignals = {
    hypotension: (vitals.bp_systolic ?? 120) < 90,
    tachycardia: (vitals.pulse ?? 72) > 100,
    tachypnea: (vitals.respiratory_rate ?? 16) > 22,
    fever: (vitals.temperature ?? 98.6) > 100.4,
    hypoxia: (vitals.spo2 ?? 98) < 94,
  };

  const systemicScore = countTrue(signals as unknown as Record<string, boolean>);
  const systemicState = classifyState(systemicScore);

  // Step 2: Extract top 3 with resolved names (SSAL: use canonical_name/diagnosis_name)
  const sorted = [...diagnoses].sort(
    (a, b) => (b.posterior_probability ?? 0) - (a.posterior_probability ?? 0)
  );
  const top3 = sorted.slice(0, 3).map(d => ({
    name: resolveName(d, nameMap),
    prob: Math.round((d.posterior_probability ?? 0) * 10000) / 10000,
  }));

  const sepsisRank = findRank(diagnoses, isSepsisLike, nameMap);
  const pneumoniaRank = findRank(diagnoses, isPneumoniaLike, nameMap);

  // Step 3: Confidence from signal density
  const confidence = systemicScore / 5;

  // Step 4: Classify disagreement using FINAL rankings
  let type: DisagreementType = "ALIGNED";
  let explanation = "Physiology and Bayesian rankings are consistent.";

  if (systemicState === "HIGH") {
    if (sepsisRank === 1) {
      type = "ALIGNED_SYSTEMIC";
      const sepsisEntry = sorted.find(d => isSepsisLike(resolveName(d, nameMap)));
      const sepsisProb = sepsisEntry ? Math.round((sepsisEntry.posterior_probability ?? 0) * 100) : 0;
      explanation = `${resolveName(sepsisEntry || sorted[0], nameMap)} ranked #1 with ${sepsisProb}% probability — systemic instability correctly prioritized (${systemicScore}/5 signals, confidence ${(confidence * 100).toFixed(0)}%).`;
    } else {
      type = "SYSTEMIC_MISSED";
      const sepsisEntry = sorted.find(d => isSepsisLike(resolveName(d, nameMap)));
      const sepsisScore = sepsisEntry ? Math.round((sepsisEntry.posterior_probability ?? 0) * 100) : 0;
      explanation = `Strong systemic instability (${systemicScore}/5 signals) but Sepsis ranked #${sepsisRank} at ${sepsisScore}% — organ-level diagnosis prioritized over systemic condition.`;
    }
  } else if (systemicState === "LOW") {
    if (pneumoniaRank < sepsisRank) {
      type = "ALIGNED_ORGAN";
      explanation = `Low systemic instability — organ-level diagnosis correctly prioritized. Pneumonia #${pneumoniaRank}, Sepsis #${sepsisRank}.`;
    } else if (sepsisRank <= pneumoniaRank) {
      type = "ORGAN_MISSED";
      explanation = `Low systemic instability but Sepsis ranked #${sepsisRank} at or above Pneumonia #${pneumoniaRank}. Organ-specific signals may be under-weighted.`;
    }
  } else {
    // MODERATE
    if (sepsisRank > pneumoniaRank + 2) {
      type = "SYSTEMIC_MISSED";
      explanation = `Moderate systemic instability (${systemicScore}/5) but Sepsis ranked #${sepsisRank} well behind Pneumonia #${pneumoniaRank}.`;
    }
  }

  return {
    physiology: {
      systemic_state: systemicState,
      systemic_score: systemicScore,
      confidence,
      signals,
      affected_systems: input.affected_systems ?? [],
      candidate_diagnosis_ids: input.candidate_diagnosis_ids ?? [],
    },
    bayesian: {
      top_3: top3,
      sepsis_rank: sepsisRank,
      pneumonia_rank: pneumoniaRank,
    },
    disagreement: {
      type,
      explanation,
    },
  };
}
