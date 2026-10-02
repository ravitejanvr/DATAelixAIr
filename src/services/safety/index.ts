/**
 * Safety Layer — V4
 *
 * Adapter over the shared must-not-miss evaluator
 * (`supabase/functions/_shared/must_not_miss.ts`), the single safety-detection
 * path also used by the `clinical-safety` edge function and O1's context-engine
 * risk flags (ROADMAP items 9/10). No rules live here — add them there.
 */

import type { SafetyOutput, SafetyAlert, PipelineVitals } from "../pipeline/types";
import type { CanonicalFeature } from "../canonical/types";
import {
  evaluateMustNotMiss,
  type MnmResult,
  type MnmTrigger,
} from "../../../supabase/functions/_shared/must_not_miss.ts";

function toSafetyAlert(t: MnmTrigger): SafetyAlert {
  return {
    alert_id: t.rule_id,
    condition: t.condition,
    severity: t.tier === "escalation" ? "critical" : "high",
    trigger_features: t.evidence,
    action: t.action,
  };
}

/** Map an evaluator result to V4's SafetyOutput shape. */
export function mustNotMissToSafetyOutput(result: MnmResult): SafetyOutput {
  const escalations = result.triggers.filter(t => t.tier === "escalation");
  return {
    safety_alerts: result.triggers.map(toSafetyAlert),
    escalation_required: result.escalate,
    emergency_flags: Array.from(new Set(escalations.map(t => t.condition))),
  };
}

/**
 * Run safety analysis on canonical features and vitals.
 */
export function analyzeSafety(params: {
  features: CanonicalFeature[];
  vitals: PipelineVitals | null;
  patientAge: number | null;
  /** Raw symptom text, when available — matched in addition to the features. */
  rawSymptoms?: string[];
  medicalHistory?: string[];
}): SafetyOutput {
  return mustNotMissToSafetyOutput(
    evaluateMustNotMiss({
      features: params.features.filter(f => f.presence !== false).map(f => f.feature_id),
      symptoms: params.rawSymptoms ?? [],
      vitals: params.vitals,
      age: params.patientAge,
      history: params.medicalHistory ?? [],
    }),
  );
}
