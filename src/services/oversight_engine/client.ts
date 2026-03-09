/**
 * Clinical Oversight Engine — Client Service
 * 
 * Records and retrieves AI decision audit trails.
 * Every AI suggestion writes an immutable ledger entry.
 * Gated by the new pipeline feature flag.
 */

import { supabase } from "@/integrations/supabase/client";
import { isNewPipelineEnabled } from "@/services/feature_flags";

export interface LedgerEntry {
  ai_output: string;
  ai_output_type?: string;
  consultation_id?: string;
  guideline_source?: string;
  evidence_reference?: string;
  model_version?: string;
  confidence?: number;
  safety_status?: string;
  doctor_action?: string;
  override_reason?: string;
  metadata?: Record<string, unknown>;
}

export interface LedgerRecord extends LedgerEntry {
  id: string;
  visit_id: string;
  doctor_id: string;
  clinic_id: string;
  created_at: string;
}

export interface DecisionTrace {
  trace: LedgerRecord[];
  summary: {
    total_decisions: number;
    accepted: number;
    rejected: number;
    modified: number;
    pending: number;
    overridden: number;
    safety_flags: number;
  };
}

/**
 * Record AI decision ledger entries for a visit.
 */
export async function recordAIDecisions(
  visitId: string,
  entries: LedgerEntry[]
): Promise<number> {
  if (!isNewPipelineEnabled()) {
    console.log("[OversightEngine] Pipeline disabled, skipping ledger.");
    return 0;
  }

  const { data, error } = await supabase.functions.invoke("ai-decision-ledger", {
    body: { action: "record", visit_id: visitId, entries },
  });

  if (error) {
    console.error("[OversightEngine] Failed to record decisions:", error);
    return 0;
  }

  return data?.recorded ?? 0;
}

/**
 * Get full AI decision trace for a visit.
 */
export async function getAIDecisionTrace(
  visitId: string
): Promise<DecisionTrace | null> {
  const { data, error } = await supabase.functions.invoke("ai-decision-ledger", {
    body: { action: "trace", visit_id: visitId },
  });

  if (error) {
    console.error("[OversightEngine] Failed to get trace:", error);
    return null;
  }

  return {
    trace: data?.trace ?? [],
    summary: data?.summary ?? {
      total_decisions: 0, accepted: 0, rejected: 0,
      modified: 0, pending: 0, overridden: 0, safety_flags: 0,
    },
  };
}

/**
 * Update doctor action on a ledger entry.
 */
export async function updateDoctorAction(
  ledgerId: string,
  doctorAction: "accepted" | "rejected" | "modified" | "overridden",
  overrideReason?: string
): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("ai-decision-ledger", {
    body: {
      action: "update",
      ledger_id: ledgerId,
      doctor_action: doctorAction,
      override_reason: overrideReason,
    },
  });

  if (error) {
    console.error("[OversightEngine] Failed to update action:", error);
    return false;
  }

  return data?.updated ?? false;
}
