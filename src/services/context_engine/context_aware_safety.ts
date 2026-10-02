/**
 * Context-Aware Safety (comorbidity / age / vital-amplified rules)
 *
 * Adapter over the shared must-not-miss evaluator
 * (`supabase/functions/_shared/must_not_miss.ts`), which now owns the
 * comorbidity and age rules this module used to define. Kept as a thin
 * adapter so existing O1 call sites (orchestrator, benchmark_mode) are
 * unchanged. No rules live here.
 */

import type { RiskFlag } from "./risk_flag_engine";
import { mustNotMissToRiskFlags } from "./risk_flag_engine";
import { evaluateMustNotMiss } from "../../../supabase/functions/_shared/must_not_miss.ts";

export interface ContextAwareSafetyInput {
  symptoms: string[];
  chief_complaint: string;
  vitals?: {
    temperature?: number | null;
    pulse?: number | null;
    bp_systolic?: number | null;
    bp_diastolic?: number | null;
    spo2?: number | null;
    respiratory_rate?: number | null;
    blood_sugar?: number | null;
  } | null;
  age?: number | null;
  sex?: string | null;
  medical_history?: string[];
  current_medications?: string[];
  risk_factors?: string[];
  allergies?: string[];
}

/**
 * Augments existing risk flags with every must-not-miss trigger not already
 * present (by flag_id). Never removes existing flags. `context_triggers`
 * lists the comorbidity/age-dependent triggers, as before.
 */
export function detectContextAwareSafetyFlags(
  input: ContextAwareSafetyInput,
  existingFlags: RiskFlag[],
): { flags: RiskFlag[]; context_triggers: string[] } {
  const result = evaluateMustNotMiss({
    symptoms: [input.chief_complaint, ...input.symptoms],
    vitals: input.vitals ?? null,
    age: input.age ?? null,
    history: [...(input.medical_history || []), ...(input.risk_factors || [])],
  });

  const existingIds = new Set(existingFlags.map(f => f.flag_id));
  const newFlags = mustNotMissToRiskFlags(result).filter(f => !existingIds.has(f.flag_id));
  const contextTriggers = result.triggers
    .filter(t => t.kind === "context" && !existingIds.has(t.rule_id))
    .map(t => `${t.rule_id}: ${t.evidence.join(", ")}`);

  return {
    flags: [...existingFlags, ...newFlags],
    context_triggers: contextTriggers,
  };
}
