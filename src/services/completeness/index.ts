/**
 * Completeness Layer — V4
 *
 * Ensures no critical omissions in the diagnostic process.
 * Uses cognitive signals + clinical rules.
 *
 * SAFETY CRITICAL — operates post-DDX, pre-Authority.
 */

import type {
  CompletenessOutput,
  RedFlag,
  CognitiveSignals,
  ConfidenceOutput,
  DDXCandidate,
} from "../pipeline/types";
import type { CanonicalFeature } from "../canonical/types";

// ══════════════════════════════════════════════
// RED FLAG RULES — Canonical ID driven
// ══════════════════════════════════════════════

interface RedFlagRule {
  id: string;
  condition: string;
  severity: "critical" | "high" | "moderate";
  trigger_combos: string[][]; // Arrays of canonical IDs
  action: string;
}

const RED_FLAG_RULES: RedFlagRule[] = [
  {
    id: "acs_cluster",
    condition: "Possible Acute Coronary Syndrome",
    severity: "critical",
    trigger_combos: [
      ["CHEST_PAIN", "DIAPHORESIS"],
      ["CHEST_PAIN", "DYSPNEA"],
      ["CHEST_PAIN", "NAUSEA"],
    ],
    action: "Immediate ECG and troponin. Consider emergency referral.",
  },
  {
    id: "meningitis_cluster",
    condition: "Possible Meningitis",
    severity: "critical",
    trigger_combos: [
      ["FEVER", "NECK_STIFFNESS"],
      ["FEVER", "HEADACHE", "PHOTOPHOBIA"],
    ],
    action: "Urgent lumbar puncture consideration. Start empirical antibiotics.",
  },
  {
    id: "pe_cluster",
    condition: "Possible Pulmonary Embolism",
    severity: "critical",
    trigger_combos: [
      ["DYSPNEA", "CHEST_PAIN"],
      ["DYSPNEA", "HEMOPTYSIS"],
    ],
    action: "Consider CT pulmonary angiogram. D-dimer if low clinical probability.",
  },
  {
    id: "stroke_cluster",
    condition: "Possible Stroke",
    severity: "critical",
    trigger_combos: [
      ["CONFUSION", "WEAKNESS"],
      ["SPEECH_DIFFICULTY", "WEAKNESS"],
      ["FACIAL_DROOP", "WEAKNESS"],
    ],
    action: "FAST assessment. Urgent CT head. Neurology referral.",
  },
  {
    id: "sepsis_cluster",
    condition: "Possible Sepsis",
    severity: "critical",
    trigger_combos: [
      ["FEVER", "CONFUSION", "WEAKNESS"],
      ["FEVER", "TACHYCARDIA"],
    ],
    action: "Blood cultures, lactate. Consider Sepsis-3 criteria.",
  },
  {
    id: "dka_cluster",
    condition: "Possible Diabetic Ketoacidosis",
    severity: "high",
    trigger_combos: [
      ["NAUSEA", "VOMITING", "ABDOMINAL_PAIN"],
      ["KUSSMAUL_BREATHING", "VOMITING"],
    ],
    action: "Check blood glucose and ketones urgently. IV fluids.",
  },
  {
    id: "cauda_equina",
    condition: "Possible Cauda Equina Syndrome",
    severity: "critical",
    trigger_combos: [
      ["BACK_PAIN", "SADDLE_ANESTHESIA"],
      ["BACK_PAIN", "WEAKNESS"],
    ],
    action: "Urgent MRI spine. Surgical consultation.",
  },
];

/**
 * Run completeness analysis.
 */
export function analyzeCompleteness(params: {
  features: CanonicalFeature[];
  ddxCandidates: DDXCandidate[];
  cognitiveSignals: CognitiveSignals;
  confidence: ConfidenceOutput;
}): CompletenessOutput {
  const featureIds = new Set(params.features.map(f => f.feature_id));

  // 1. Detect red flags using canonical IDs
  const redFlags: RedFlag[] = [];
  for (const rule of RED_FLAG_RULES) {
    for (const combo of rule.trigger_combos) {
      if (combo.every(id => featureIds.has(id))) {
        redFlags.push({
          flag_id: rule.id,
          condition: rule.condition,
          severity: rule.severity,
          action: rule.action,
          trigger_features: combo,
        });
        break;
      }
    }
  }

  // 2. Identify missing tests from evidence gaps
  const missingTests: string[] = params.cognitiveSignals.evidence_gaps
    .filter(g => g.importance === "critical" || g.importance === "high")
    .map(g => g.suggested_action);

  // 3. Identify required questions from cognitive gaps
  const requiredQuestions: string[] = params.cognitiveSignals.evidence_gaps
    .filter(g => g.importance === "critical")
    .map(g => `Missing ${g.missing_feature} for ${g.diagnosis}`);

  // 4. Compute completeness score
  const totalExpected = params.ddxCandidates.length * 3; // avg features per dx
  const totalPresent = featureIds.size;
  const completenessScore = Math.min(totalPresent / Math.max(totalExpected, 1), 1.0);

  return {
    missing_tests: [...new Set(missingTests)],
    required_questions: requiredQuestions,
    red_flags: redFlags,
    completeness_score: Math.round(completenessScore * 100) / 100,
  };
}
