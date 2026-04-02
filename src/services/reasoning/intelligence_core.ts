/**
 * Intelligence Core — Phase 6 Clinical Reasoning Engine
 *
 * Multi-factor scoring and ranking of diagnostic candidates.
 *
 * ClinicalReasoningScore =
 *   base_probability
 *   × cluster_activation_strength
 *   × symptom_match_score
 *   × risk_amplifier_score
 *   × temporal_consistency_score
 *   × severity_weight
 *   × (1 + weak_signal_score)
 *   × mnm_priority_boost
 *   − contradiction_penalty
 *
 * Pure functional module. No mutations, no side effects.
 */

import type { ClinicalContext } from "@/lib/clinical-context";
import type { KGActivation } from "@/services/kg/kg_activation";
import type { CandidateHint } from "@/services/context_candidate_expander";
import { evaluateTemporalConsistency, type TemporalResult } from "./temporal_engine";
import { evaluateContradictions, type ContradictionResult } from "./contradiction_engine";
import { evaluateWeakSignals, type WeakSignalResult } from "./weak_signal_engine";
import { clamp, roundTo, jaccardSimilarity } from "./scoring_utils";

// ── Types ──

export interface ReasoningInput {
  context: ClinicalContext;
  candidates: CandidateHint[];
  activation: KGActivation;
}

export interface RankedDiagnosis {
  diagnosis: string;
  score: number;
  reasoning: {
    base_probability: number;
    cluster_strength: number;
    symptom_match: number;
    risk_amplifier: number;
    temporal_score: number;
    severity_weight: number;
    weak_signal_score: number;
    mnm_boost: number;
    contradiction_penalty: number;
    supporting_clusters: string[];
    matched_features: string[];
    weak_signals: string[];
    risk_factors: string[];
    contradictions: string[];
    mnm_flag: boolean;
    recovery_mode?: boolean;
  };
}

export interface IntelligenceCoreResult {
  ranked: RankedDiagnosis[];
  top_score: number;
  candidate_count: number;
  execution_ms: number;
}

// ── Severity classification ──

function classifySeverity(context: ClinicalContext): number {
  let score = 1.0;
  const sev = (context.severity || "").toLowerCase();
  if (sev.includes("severe") || sev.includes("critical")) score = 1.3;
  else if (sev.includes("moderate")) score = 1.1;
  else if (sev.includes("mild")) score = 0.9;

  // Vital sign severity signals
  if (context.temperature && context.temperature > 39.0) score *= 1.1;
  if (context.pulse && context.pulse > 120) score *= 1.1;
  if (context.oxygen_saturation && context.oxygen_saturation < 92) score *= 1.15;
  const bp = context.blood_pressure;
  if (bp) {
    const systolic = parseInt(bp.split("/")[0]);
    if (systolic > 180 || systolic < 90) score *= 1.1;
  }

  return clamp(score, 0.7, 1.5);
}

// ── Risk amplifier ──

function computeRiskAmplifier(
  diagnosisName: string,
  context: ClinicalContext,
): { score: number; matched_factors: string[] } {
  const factors: string[] = [];
  let score = 1.0;
  const diagLower = diagnosisName.toLowerCase();

  const allRisk = [
    ...(context.risk_factors || []),
    ...(context.medical_history || []),
  ].map(r => r.toLowerCase());

  // Generic risk amplification
  const RISK_BOOSTS: Record<string, { terms: string[]; boost: number }> = {
    cardiac: { terms: ["hypertension", "diabetes", "smoking", "hyperlipidemia", "coronary", "stent", "cabg"], boost: 1.2 },
    pe_dvt: { terms: ["dvt", "clot", "thrombosis", "immobile", "surgery", "cancer", "contraceptive"], boost: 1.25 },
    stroke: { terms: ["atrial fibrillation", "hypertension", "diabetes", "tia", "previous stroke"], boost: 1.2 },
    infection: { terms: ["immunocompromised", "hiv", "transplant", "chemotherapy", "diabetes", "cirrhosis"], boost: 1.15 },
  };

  const cardiacDx = ["myocardial infarction", "acute coronary syndrome", "unstable angina"];
  const peDx = ["pulmonary embolism", "deep vein thrombosis", "massive pulmonary embolism"];
  const strokeDx = ["stroke", "posterior circulation stroke"];
  const infectionDx = ["sepsis", "necrotizing fasciitis", "meningitis", "pneumonia"];

  let boostConfig: { terms: string[]; boost: number } | null = null;
  if (cardiacDx.some(d => diagLower.includes(d))) boostConfig = RISK_BOOSTS.cardiac;
  else if (peDx.some(d => diagLower.includes(d))) boostConfig = RISK_BOOSTS.pe_dvt;
  else if (strokeDx.some(d => diagLower.includes(d))) boostConfig = RISK_BOOSTS.stroke;
  else if (infectionDx.some(d => diagLower.includes(d))) boostConfig = RISK_BOOSTS.infection;

  if (boostConfig) {
    for (const term of boostConfig.terms) {
      if (allRisk.some(r => r.includes(term))) {
        score *= boostConfig.boost;
        factors.push(term);
        break; // One match per category is sufficient
      }
    }
  }

  // Age-based risk
  if (context.patient_age) {
    if (context.patient_age > 65 && cardiacDx.some(d => diagLower.includes(d))) {
      score *= 1.1;
      factors.push("age>65");
    }
    if (context.patient_age < 5 && diagLower.includes("intussusception")) {
      score *= 1.15;
      factors.push("age<5");
    }
  }

  return { score: clamp(score, 0.8, 1.5), matched_factors: factors };
}

// ── Symptom match scoring ──

function computeSymptomMatch(
  candidateSymptoms: string[],
  patientSymptoms: string[],
): { score: number; matched: string[] } {
  if (patientSymptoms.length === 0) return { score: 0.3, matched: [] };

  const patientSet = new Set(patientSymptoms.map(s => s.toLowerCase().trim()));
  const matched: string[] = [];

  for (const cs of candidateSymptoms) {
    const csLower = cs.toLowerCase().trim();
    // Exact or substring match
    if ([...patientSet].some(ps => ps.includes(csLower) || csLower.includes(ps))) {
      matched.push(cs);
    }
  }

  const coverage = candidateSymptoms.length > 0
    ? matched.length / candidateSymptoms.length
    : 0;

  // Also consider Jaccard similarity
  const jaccard = jaccardSimilarity(candidateSymptoms, patientSymptoms);

  const score = clamp((coverage * 0.6 + jaccard * 0.4) + 0.2, 0.2, 1.0);
  return { score, matched };
}

// ── Main ranking function ──

/**
 * Rank diagnostic candidates using multi-factor clinical reasoning.
 *
 * This is a deterministic, explainable scoring system:
 *   - No ML models
 *   - No external API calls
 *   - Every score component is traceable
 */
export function rankCandidates(input: ReasoningInput): IntelligenceCoreResult {
  const t0 = performance.now();
  const { context, candidates, activation } = input;

  const symptoms = extractSymptoms(context);
  const severityWeight = classifySeverity(context);

  const ranked: RankedDiagnosis[] = candidates.map(candidate => {
    const diagName = candidate.diagnosis_name;
    const diagLower = diagName.toLowerCase().trim();

    // 1. Base probability from candidate confidence
    const baseProbability = clamp(candidate.confidence, 0.05, 1.0);

    // 2. Cluster activation strength
    const activeClusters: string[] = [];
    let clusterStrength = 0.5; // default if no cluster info
    for (const nodeId of activation.nodes) {
      if (activation.weights[nodeId] > 0) {
        // Check if this cluster contains the diagnosis
        // We approximate by checking if the node was a trigger source
        activeClusters.push(nodeId);
      }
    }
    if (activeClusters.length > 0) {
      clusterStrength = Math.min(
        activeClusters.reduce((max, c) => Math.max(max, activation.weights[c] ?? 0), 0),
        1.0,
      );
    }

    // 3. Symptom match
    const symptomResult = computeSymptomMatch(
      candidate.reasoning ? [candidate.reasoning] : [],
      symptoms,
    );

    // 4. Risk amplifier
    const riskResult = computeRiskAmplifier(diagName, context);

    // 5. Temporal consistency
    const temporalResult = evaluateTemporalConsistency(diagName, {
      onset_pattern: context.onset_pattern,
      duration: context.symptom_duration,
      severity: context.severity,
      symptoms,
    });

    // 6. Weak signals
    const isMNM = activation.must_not_miss_nodes.has(
      [...activation.nodes].find(n => {
        const w = activation.weights[n];
        return w !== undefined;
      }) || "",
    );
    const weakResult = evaluateWeakSignals({
      diagnosis_name: diagName,
      patient_symptoms: symptoms,
      supporting_symptoms: candidate.reasoning ? [candidate.reasoning] : [],
      cluster_ids: activeClusters,
      activation_weight: clusterStrength,
      must_not_miss: isMNM || candidate.source === "context_signal",
      risk_factors: context.risk_factors,
      medical_history: context.medical_history,
    });

    // 7. Contradiction penalty
    const contradictionResult = evaluateContradictions({
      diagnosis_name: diagName,
      supporting_symptoms: candidate.reasoning ? [candidate.reasoning] : [],
      patient_symptoms: symptoms,
      patient_age: context.patient_age,
      patient_sex: context.patient_sex,
      vitals: {
        temperature: context.temperature || undefined,
        pulse: context.pulse || undefined,
        bp_systolic: context.blood_pressure ? parseInt(context.blood_pressure.split("/")[0]) : undefined,
        spo2: context.oxygen_saturation || undefined,
      },
      must_not_miss: isMNM,
    });

    // 8. MNM priority boost
    const mnmBoost = isMNM ? 1.3 : 1.0;

    // ── Composite Score ──
    const rawScore =
      baseProbability
      * clusterStrength
      * symptomResult.score
      * riskResult.score
      * temporalResult.score
      * severityWeight
      * (1 + weakResult.score)
      * mnmBoost
      - contradictionResult.penalty;

    const finalScore = roundTo(clamp(rawScore, 0.01, 1.0), 4);

    return {
      diagnosis: diagName,
      score: finalScore,
      reasoning: {
        base_probability: roundTo(baseProbability, 3),
        cluster_strength: roundTo(clusterStrength, 3),
        symptom_match: roundTo(symptomResult.score, 3),
        risk_amplifier: roundTo(riskResult.score, 3),
        temporal_score: roundTo(temporalResult.score, 3),
        severity_weight: roundTo(severityWeight, 3),
        weak_signal_score: roundTo(weakResult.score, 3),
        mnm_boost: mnmBoost,
        contradiction_penalty: roundTo(contradictionResult.penalty, 3),
        supporting_clusters: activeClusters,
        matched_features: symptomResult.matched,
        weak_signals: weakResult.signals_detected,
        risk_factors: riskResult.matched_factors,
        contradictions: contradictionResult.contradictions,
        mnm_flag: isMNM,
      },
    };
  });

  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score);

  const executionMs = Math.round(performance.now() - t0);

  console.log(
    `[IntelligenceCore] Ranked ${ranked.length} candidates in ${executionMs}ms. ` +
    `Top: ${ranked[0]?.diagnosis || "none"} (${ranked[0]?.score || 0})`
  );

  return {
    ranked,
    top_score: ranked[0]?.score ?? 0,
    candidate_count: ranked.length,
    execution_ms: executionMs,
  };
}

// ── Helper ──

function extractSymptoms(ctx: ClinicalContext): string[] {
  const symptoms: string[] = [];
  if (ctx.chief_complaint) symptoms.push(ctx.chief_complaint);
  if (ctx.symptoms?.length) symptoms.push(...ctx.symptoms);
  if (ctx.associated_symptoms?.length) symptoms.push(...ctx.associated_symptoms);
  return [...new Set(symptoms)];
}
