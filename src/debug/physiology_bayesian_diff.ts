/**
 * Physiology vs Bayesian Disagreement Analyzer
 * 
 * Pure observability layer — does NOT modify any scores, rankings, or pipeline state.
 * Exposes where physiology signals and Bayesian posteriors disagree.
 * 
 * SSAL-compliant: Uses canonical_name and rank from self-describing diagnosis objects.
 * Physiology-First: Uses computeSystemicState for authoritative systemic assessment.
 */

import {
  computeSystemicState,
  matchDiseaseProfile,
  type SystemicState,
} from "@/services/physiology_engine/systemic_state";

// ── Types ──

interface SystemicSignals {
  hypotension: boolean;
  tachycardia: boolean;
  tachypnea: boolean;
  fever: boolean;
  hypoxia: boolean;
}

type SystemicSeverity = "HIGH" | "MODERATE" | "LOW";
type DisagreementType = "SYSTEMIC_MISSED" | "ORGAN_MISSED" | "ALIGNED_SYSTEMIC" | "ALIGNED_ORGAN" | "ALIGNED";

export interface PhysioBayesianDiff {
  physiology: {
    systemic_state: SystemicSeverity;
    systemic_score: number;
    confidence: number;
    signals: SystemicSignals;
    affected_systems: string[];
    candidate_diagnosis_ids: string[];
    phenotype: string;
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

function isSepsisLike(name: string): boolean {
  return /sepsis|septic|sirs|bacteremia|urosepsis/i.test(name);
}

function isPneumoniaLike(name: string): boolean {
  return /pneumonia|cap\b|community.acquired/i.test(name);
}

/** Resolve display name from SSAL diagnosis */
function resolveName(d: SSALDiagnosis, nameMap?: Map<string, string>): string {
  if (d.diagnosis_name) return d.diagnosis_name;
  if (d.canonical_name) return d.canonical_name;
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

  // ── Physiology-First: Use authoritative systemic state engine ──
  const systemicState = computeSystemicState({
    bp_systolic: vitals.bp_systolic,
    pulse: vitals.pulse,
    respiratory_rate: vitals.respiratory_rate,
    temperature: vitals.temperature,
    spo2: vitals.spo2,
  });

  const { signals, signal_count, severity, phenotype, systemic_strength } = systemicState;

  // Extract top 3 with resolved names — SSAL-compliant: use rank field if available
  const hasRanks = diagnoses.some(d => d.rank != null);
  const ordered = hasRanks
    ? [...diagnoses].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
    : [...diagnoses].sort((a, b) => (b.posterior_probability ?? 0) - (a.posterior_probability ?? 0));
  const top3 = ordered.slice(0, 3).map(d => ({
    name: resolveName(d, nameMap),
    prob: Math.round((d.posterior_probability ?? 0) * 10000) / 10000,
  }));

  const sepsisRank = findRank(diagnoses, isSepsisLike, nameMap);
  const pneumoniaRank = findRank(diagnoses, isPneumoniaLike, nameMap);

  // Confidence from signal density
  const confidence = systemic_strength;

  // Classify disagreement — aligned with Physiology-First architecture
  let type: DisagreementType = "ALIGNED";
  let explanation = "Physiology and diagnostic rankings are consistent.";

  // Check if #1 diagnosis is a systemic type
  const topDiagName = top3[0]?.name || "";
  const topProfile = matchDiseaseProfile(topDiagName);
  const topIsSystemic = topProfile?.requires_systemic_instability === true;

  if (severity === "HIGH") {
    if (sepsisRank === 1 || topIsSystemic) {
      type = "ALIGNED_SYSTEMIC";
      const sepsisEntry = ordered.find(d => isSepsisLike(resolveName(d, nameMap)));
      const sepsisProb = sepsisEntry ? Math.round((sepsisEntry.posterior_probability ?? 0) * 100) : 0;
      explanation = `${signal_count}/5 systemic signals (${phenotype}) — ${resolveName(sepsisEntry || ordered[0], nameMap)} correctly prioritized at ${sepsisProb}% (confidence ${(confidence * 100).toFixed(0)}%).`;
    } else {
      type = "SYSTEMIC_MISSED";
      const sepsisEntry = sorted.find(d => isSepsisLike(resolveName(d, nameMap)));
      const sepsisScore = sepsisEntry ? Math.round((sepsisEntry.posterior_probability ?? 0) * 100) : 0;
      explanation = `HIGH systemic instability (${signal_count}/5 signals, ${phenotype}) but Sepsis ranked #${sepsisRank} at ${sepsisScore}% — organ-level diagnosis prioritized over systemic condition.`;
    }
  } else if (severity === "LOW") {
    if (pneumoniaRank < sepsisRank) {
      type = "ALIGNED_ORGAN";
      explanation = `Low systemic instability (${phenotype}) — organ-level diagnosis correctly prioritized. Pneumonia #${pneumoniaRank}, Sepsis #${sepsisRank}.`;
    } else if (sepsisRank <= pneumoniaRank) {
      type = "ORGAN_MISSED";
      explanation = `Low systemic instability but Sepsis ranked #${sepsisRank} at or above Pneumonia #${pneumoniaRank}. Organ-specific signals may be under-weighted.`;
    }
  } else {
    // MODERATE
    if (sepsisRank > pneumoniaRank + 2) {
      type = "SYSTEMIC_MISSED";
      explanation = `Moderate systemic instability (${signal_count}/5, ${phenotype}) but Sepsis ranked #${sepsisRank} well behind Pneumonia #${pneumoniaRank}.`;
    }
  }

  return {
    physiology: {
      systemic_state: severity,
      systemic_score: signal_count,
      confidence,
      signals,
      affected_systems: input.affected_systems ?? [],
      candidate_diagnosis_ids: input.candidate_diagnosis_ids ?? [],
      phenotype,
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
