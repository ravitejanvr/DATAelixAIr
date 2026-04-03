/**
 * Physiology vs Bayesian Disagreement Analyzer
 * 
 * Pure observability layer — does NOT modify any scores, rankings, or pipeline state.
 * Exposes where physiology signals and Bayesian posteriors disagree.
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

interface AnalysisInput {
  physiological_states?: any[];
  affected_systems?: string[];
  candidate_diagnosis_ids?: string[];
  bayesian_diagnoses?: Array<{ diagnosis_id?: string; diagnosis_name?: string; posterior_probability?: number }>;
  symptoms?: string[];
  vitals?: {
    temperature?: number;
    pulse?: number;
    bp_systolic?: number;
    bp_diastolic?: number;
    respiratory_rate?: number;
    spo2?: number;
  };
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
  return /sepsis|septic|sirs/i.test(name);
}

function isPneumoniaLike(name: string): boolean {
  return /pneumonia|cap\b|community.acquired/i.test(name);
}

function findRank(
  diagnoses: Array<{ diagnosis_id?: string; diagnosis_name?: string; posterior_probability?: number }>,
  matcher: (name: string) => boolean
): number {
  const sorted = [...diagnoses].sort(
    (a, b) => (b.posterior_probability ?? 0) - (a.posterior_probability ?? 0)
  );
  for (let i = 0; i < sorted.length; i++) {
    const name = sorted[i].diagnosis_name ?? sorted[i].diagnosis_id ?? "";
    if (matcher(name)) return i + 1;
  }
  return sorted.length + 1;
}

// ── Main Analysis Function ──

export function analyzePhysiologyBayesianMismatch(input: AnalysisInput): PhysioBayesianDiff {
  const vitals = input.vitals ?? {};
  const diagnoses = input.bayesian_diagnoses ?? [];

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

  // Step 2: Extract Bayesian top 3
  const sorted = [...diagnoses].sort(
    (a, b) => (b.posterior_probability ?? 0) - (a.posterior_probability ?? 0)
  );
  const top3 = sorted.slice(0, 3).map(d => ({
    name: d.diagnosis_name ?? d.diagnosis_id ?? "unknown",
    prob: Math.round((d.posterior_probability ?? 0) * 10000) / 10000,
  }));

  const sepsisRank = findRank(diagnoses, isSepsisLike);
  const pneumoniaRank = findRank(diagnoses, isPneumoniaLike);

  // Step 3: Detect disagreement
  let type: DisagreementType = "ALIGNED";
  let explanation = "Physiology and Bayesian rankings are consistent.";

  if (systemicState === "HIGH" && sepsisRank > pneumoniaRank) {
    type = "SYSTEMIC_MISSED";
    explanation = `Strong systemic instability (${systemicScore}/5 signals) but Bayesian ranks Sepsis #${sepsisRank} behind Pneumonia #${pneumoniaRank}. Systemic pattern may be under-weighted.`;
  } else if (systemicState === "LOW" && pneumoniaRank > sepsisRank && sepsisRank <= 3) {
    type = "ORGAN_MISSED";
    explanation = `Low systemic instability but Bayesian ranks Sepsis #${sepsisRank} above Pneumonia #${pneumoniaRank}. Organ-specific signals may be under-weighted.`;
  } else if (Math.abs(sepsisRank - pneumoniaRank) <= 1 && systemicState !== "LOW") {
    type = "AMBIGUOUS";
    explanation = `Sepsis (#${sepsisRank}) and Pneumonia (#${pneumoniaRank}) are within ±1 rank with ${systemicState} systemic state. Close competition.`;
  }

  return {
    physiology: {
      systemic_state: systemicState,
      systemic_score: systemicScore,
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
