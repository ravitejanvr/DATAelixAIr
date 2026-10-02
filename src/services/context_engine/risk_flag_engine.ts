/**
 * PCIE — Risk Flag Detection Module
 *
 * Detects early warning conditions from symptoms, vitals,
 * and patient history. Flags are surfaced in the Clinical Cockpit.
 *
 * Adapter over the shared must-not-miss evaluator
 * (`supabase/functions/_shared/must_not_miss.ts`) — the single
 * safety-detection path (ROADMAP items 9/10). No rules live here.
 */

import {
  evaluateMustNotMiss,
  type MnmResult,
} from "../../../supabase/functions/_shared/must_not_miss.ts";

export interface RiskFlag {
  flag_id: string;
  condition: string;
  severity: "critical" | "high" | "moderate";
  trigger_symptoms: string[];
  action: string;
  matched_at: string;
}

/** Map evaluator triggers to RiskFlags: escalation → critical, advisory → high. */
export function mustNotMissToRiskFlags(result: MnmResult): RiskFlag[] {
  const matchedAt = new Date().toISOString();
  return result.triggers.map(t => ({
    flag_id: t.rule_id,
    condition: t.label,
    severity: t.tier === "escalation" ? "critical" : "high",
    trigger_symptoms: t.evidence,
    action: t.action,
    matched_at: matchedAt,
  }));
}

/**
 * Detect risk flags from symptoms and patient context.
 */
export function detectRiskFlags(params: {
  symptoms: string[];
  chief_complaint: string;
  vitals?: {
    temperature?: number | null;
    pulse?: number | null;
    bp_systolic?: number | null;
    bp_diastolic?: number | null;
    spo2?: number | null;
  } | null;
  age?: number | null;
  medications?: string[];
  medical_history?: string[];
}): RiskFlag[] {
  return mustNotMissToRiskFlags(
    evaluateMustNotMiss({
      symptoms: [params.chief_complaint, ...params.symptoms],
      vitals: params.vitals ?? null,
      age: params.age ?? null,
      history: params.medical_history ?? [],
    }),
  );
}
