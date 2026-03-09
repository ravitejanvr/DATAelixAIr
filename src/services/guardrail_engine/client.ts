/**
 * Clinical Guardrail Engine — Client Service
 * 
 * Runs comprehensive safety checks before consultation finalization.
 * Blocks unsafe suggestions unless doctor explicitly overrides.
 * Only active when new pipeline feature flag is enabled.
 */

import { supabase } from "@/integrations/supabase/client";
import { isNewPipelineEnabled } from "@/services/feature_flags";
import type { PatientContextSnapshot } from "@/services/clinical_context/client";

export interface GuardrailAlert {
  alert_type: string;
  severity: string;
  message: string;
  category: string;
  metadata?: Record<string, unknown>;
}

export interface GuardrailResult {
  alerts: GuardrailAlert[];
  summary: {
    total: number;
    critical: number;
    high: number;
    warning: number;
  };
  blocks_finalization: boolean;
  requires_override: boolean;
  checked_at: string;
}

/**
 * Run clinical guardrails against patient context and suggested treatments.
 * Returns null if pipeline is disabled or on error.
 */
export async function runClinicalGuardrails(
  visitId: string,
  patientContext: PatientContextSnapshot,
  suggestedTreatments?: {
    drugs?: string[];
    labs?: string[];
    diagnosis?: string;
  }
): Promise<GuardrailResult | null> {
  if (!isNewPipelineEnabled()) {
    console.log("[GuardrailEngine] New pipeline disabled, skipping.");
    return null;
  }

  const { data, error } = await supabase.functions.invoke("run-clinical-guardrails", {
    body: {
      visit_id: visitId,
      patient_context: patientContext,
      suggested_treatments: suggestedTreatments ?? {},
    },
  });

  if (error) {
    console.error("[GuardrailEngine] Failed:", error);
    return null;
  }

  return {
    alerts: data?.alerts ?? [],
    summary: data?.summary ?? { total: 0, critical: 0, high: 0, warning: 0 },
    blocks_finalization: data?.blocks_finalization ?? false,
    requires_override: data?.requires_override ?? false,
    checked_at: new Date().toISOString(),
  };
}
