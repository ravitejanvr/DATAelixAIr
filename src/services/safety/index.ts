/**
 * Safety Layer — V4
 *
 * Detects high-risk conditions from canonical features and vitals.
 * Generates escalation triggers and emergency flags.
 *
 * Operates ONLY on canonical IDs — no string matching.
 */

import type { SafetyOutput, SafetyAlert, PipelineVitals } from "../pipeline/types";
import type { CanonicalFeature } from "../canonical/types";

// ══════════════════════════════════════════════
// SAFETY RULES — Canonical ID based
// ══════════════════════════════════════════════

interface SafetyRule {
  id: string;
  condition: string;
  severity: "critical" | "high" | "moderate";
  trigger_combos: string[][];
  action: string;
}

const SAFETY_RULES: SafetyRule[] = [
  {
    id: "acs_safety",
    condition: "Acute Coronary Syndrome",
    severity: "critical",
    trigger_combos: [
      ["CHEST_PAIN", "DIAPHORESIS"],
      ["CHEST_PAIN", "DYSPNEA"],
      ["CHEST_PAIN", "NAUSEA", "DIAPHORESIS"],
    ],
    action: "Immediate ECG, troponin, aspirin. Consider emergency referral.",
  },
  {
    id: "meningitis_safety",
    condition: "Meningitis",
    severity: "critical",
    trigger_combos: [
      ["FEVER", "NECK_STIFFNESS"],
      ["FEVER", "HEADACHE", "PHOTOPHOBIA"],
      ["HEADACHE", "NECK_STIFFNESS", "CONFUSION"],
    ],
    action: "Urgent LP. Start empirical antibiotics immediately.",
  },
  {
    id: "pe_safety",
    condition: "Pulmonary Embolism",
    severity: "critical",
    trigger_combos: [
      ["DYSPNEA", "PLEURITIC_CHEST_PAIN"],
      ["DYSPNEA", "HEMOPTYSIS"],
      ["TACHYCARDIA", "DYSPNEA", "CHEST_PAIN"],
    ],
    action: "CTPA. Start anticoagulation if high clinical probability.",
  },
  {
    id: "stroke_safety",
    condition: "Stroke / TIA",
    severity: "critical",
    trigger_combos: [
      ["FACIAL_DROOP", "WEAKNESS"],
      ["SPEECH_DIFFICULTY", "WEAKNESS"],
      ["THUNDERCLAP_HEADACHE"],
    ],
    action: "FAST assessment. Urgent CT head. Neurology referral.",
  },
  {
    id: "sepsis_safety",
    condition: "Sepsis",
    severity: "critical",
    trigger_combos: [
      ["FEVER", "CONFUSION", "TACHYCARDIA"],
      ["FEVER", "WEAKNESS", "TACHYCARDIA"],
    ],
    action: "Blood cultures, lactate, fluid resuscitation. Sepsis-3 criteria.",
  },
  {
    id: "anaphylaxis_safety",
    condition: "Anaphylaxis",
    severity: "critical",
    trigger_combos: [
      ["RASH", "DYSPNEA", "SWELLING"],
    ],
    action: "Epinephrine IM. Secure airway. Monitor closely.",
  },
  {
    id: "cauda_equina_safety",
    condition: "Cauda Equina Syndrome",
    severity: "critical",
    trigger_combos: [
      ["BACK_PAIN", "SADDLE_ANESTHESIA"],
    ],
    action: "Urgent MRI spine. Surgical consultation.",
  },
];

/**
 * Run safety analysis on canonical features and vitals.
 */
export function analyzeSafety(params: {
  features: CanonicalFeature[];
  vitals: PipelineVitals | null;
  patientAge: number | null;
}): SafetyOutput {
  const featureIds = new Set(params.features.map(f => f.feature_id));
  const alerts: SafetyAlert[] = [];
  const emergencyFlags: string[] = [];

  // 1. Check symptom-cluster safety rules
  for (const rule of SAFETY_RULES) {
    for (const combo of rule.trigger_combos) {
      if (combo.every(id => featureIds.has(id))) {
        alerts.push({
          alert_id: rule.id,
          condition: rule.condition,
          severity: rule.severity,
          trigger_features: combo,
          action: rule.action,
        });
        if (rule.severity === "critical") {
          emergencyFlags.push(rule.condition);
        }
        break;
      }
    }
  }

  // 2. Vital-sign safety triggers
  if (params.vitals) {
    const v = params.vitals;
    if (v.temperature != null && v.temperature >= 39.5) {
      alerts.push({
        alert_id: "vital_high_fever",
        condition: "High Fever (≥39.5°C)",
        severity: "high",
        trigger_features: [],
        action: "Investigate source. Blood cultures if >40°C.",
      });
    }
    if (v.spo2 != null && v.spo2 < 92) {
      alerts.push({
        alert_id: "vital_hypoxia",
        condition: "Hypoxia (SpO₂ < 92%)",
        severity: "critical",
        trigger_features: [],
        action: "Supplemental oxygen. Investigate cause urgently.",
      });
      emergencyFlags.push("Hypoxia");
    }
    if (v.pulse != null && v.pulse > 120) {
      alerts.push({
        alert_id: "vital_tachycardia",
        condition: "Tachycardia (HR > 120)",
        severity: "high",
        trigger_features: [],
        action: "ECG. Assess for dehydration, infection, or cardiac cause.",
      });
    }
    if (v.bp_systolic != null && v.bp_systolic >= 180) {
      alerts.push({
        alert_id: "vital_hypertensive",
        condition: "Hypertensive Urgency (SBP ≥ 180)",
        severity: "high",
        trigger_features: [],
        action: "Assess for target organ damage. Oral antihypertensive.",
      });
    }
    if (v.bp_systolic != null && v.bp_systolic < 90) {
      alerts.push({
        alert_id: "vital_hypotension",
        condition: "Hypotension (SBP < 90)",
        severity: "critical",
        trigger_features: [],
        action: "IV fluid resuscitation. Monitor for shock.",
      });
      emergencyFlags.push("Hypotension");
    }
  }

  return {
    safety_alerts: alerts,
    escalation_required: emergencyFlags.length > 0,
    emergency_flags: emergencyFlags,
  };
}
