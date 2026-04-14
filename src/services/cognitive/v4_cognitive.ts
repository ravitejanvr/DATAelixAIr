/**
 * Cognitive Layer — V4
 *
 * Plug-in intelligence modules. NON-DOMINANT.
 * Cannot override V3. Can only influence downstream layers.
 *
 * Modules:
 * 1. Hypothesis Expander — ensures must-not-miss conditions
 * 2. Counterfactual Reasoning — explores alternatives
 * 3. Evidence Gap Detector — identifies missing data
 */

import type {
  CognitiveSignals,
  CounterfactualInsight,
  EvidenceGap,
  DDXCandidate,
} from "../pipeline/types";
import type { CanonicalFeature } from "../canonical/types";

// ══════════════════════════════════════════════
// MUST-NOT-MISS CONDITIONS (canonical ID based)
// ══════════════════════════════════════════════

const MUST_NOT_MISS: Record<string, string[]> = {
  CHEST_PAIN: ["Acute Coronary Syndrome", "Pulmonary Embolism", "Aortic Dissection", "Tension Pneumothorax"],
  HEADACHE: ["Subarachnoid Hemorrhage", "Meningitis", "Intracranial Mass"],
  DYSPNEA: ["Pulmonary Embolism", "Pneumothorax", "Cardiac Tamponade"],
  ABDOMINAL_PAIN: ["Appendicitis", "Ectopic Pregnancy", "Ruptured AAA", "Bowel Obstruction"],
  SYNCOPE: ["Cardiac Arrhythmia", "Aortic Stenosis", "Pulmonary Embolism"],
  BACK_PAIN: ["Cauda Equina Syndrome", "Epidural Abscess", "Aortic Dissection"],
  FEVER: ["Sepsis", "Meningitis", "Endocarditis"],
};

// ══════════════════════════════════════════════
// CRITICAL EVIDENCE MAP — what to check per diagnosis
// ══════════════════════════════════════════════

const CRITICAL_EVIDENCE: Record<string, { feature: string; action: string }[]> = {
  "Acute Coronary Syndrome": [
    { feature: "DIAPHORESIS", action: "Ask about sweating" },
    { feature: "CHEST_PAIN", action: "ECG and Troponin" },
  ],
  "Pulmonary Embolism": [
    { feature: "TACHYCARDIA", action: "Check heart rate" },
    { feature: "HEMOPTYSIS", action: "Ask about blood in sputum" },
  ],
  "Meningitis": [
    { feature: "NECK_STIFFNESS", action: "Check for neck rigidity" },
    { feature: "PHOTOPHOBIA", action: "Assess light sensitivity" },
    { feature: "KERNIG_SIGN", action: "Kernig sign examination" },
  ],
  "Sepsis": [
    { feature: "TACHYCARDIA", action: "Monitor heart rate" },
    { feature: "CONFUSION", action: "Assess mental status" },
  ],
};

/**
 * Run cognitive analysis on canonical features and DDX output.
 */
export function analyzeCognitive(params: {
  features: CanonicalFeature[];
  ddxCandidates: DDXCandidate[];
}): CognitiveSignals {
  const featureIds = new Set(params.features.map(f => f.feature_id));
  const ddxNames = new Set(params.ddxCandidates.map(d => d.diagnosis_name));

  // 1. Hypothesis Expansion
  const expanded: string[] = [];
  for (const feature of params.features) {
    const mustCheck = MUST_NOT_MISS[feature.feature_id];
    if (!mustCheck) continue;
    for (const condition of mustCheck) {
      if (!ddxNames.has(condition)) {
        expanded.push(condition);
      }
    }
  }

  // 2. Counterfactual Reasoning
  const counterfactuals: CounterfactualInsight[] = [];
  for (const dx of params.ddxCandidates.slice(0, 5)) {
    for (const contraFeature of dx.contradicting_features) {
      if (!featureIds.has(contraFeature)) {
        counterfactuals.push({
          diagnosis: dx.diagnosis_name,
          if_present: contraFeature,
          probability_delta: -0.15,
          explanation: `If ${contraFeature} were present, ${dx.diagnosis_name} would be less likely`,
        });
      }
    }
  }

  // 3. Evidence Gap Detection
  const gaps: EvidenceGap[] = [];
  for (const dx of params.ddxCandidates.slice(0, 5)) {
    const criticalEvidence = CRITICAL_EVIDENCE[dx.diagnosis_name];
    if (!criticalEvidence) continue;
    for (const ev of criticalEvidence) {
      if (!featureIds.has(ev.feature)) {
        gaps.push({
          diagnosis: dx.diagnosis_name,
          missing_feature: ev.feature,
          importance: dx.must_not_miss ? "critical" : "high",
          suggested_action: ev.action,
        });
      }
    }
  }

  return {
    expanded_hypotheses: [...new Set(expanded)],
    counterfactual_insights: counterfactuals,
    evidence_gaps: gaps,
  };
}
