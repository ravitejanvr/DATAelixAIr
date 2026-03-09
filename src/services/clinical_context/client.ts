/**
 * Clinical Context Engine — Client Service
 * 
 * Aggregates patient state by invoking the generate-patient-context
 * edge function. Falls back to client-side buildClinicalContext when
 * the new pipeline is disabled.
 */

import { supabase } from "@/integrations/supabase/client";
import { isNewPipelineEnabled } from "@/services/feature_flags";

export { buildClinicalContext, EMPTY_CLINICAL_CONTEXT } from "@/lib/clinical-context";
export type { ClinicalContext } from "@/lib/clinical-context";
export { buildEnrichedContext, validateContextCompleteness } from "./index";
export type { EnrichedClinicalContext } from "./index";

export interface PatientContextSnapshot {
  patient_id: string;
  age: number | null;
  sex: string | null;
  chief_complaint: string;
  symptoms: string;
  duration: string;
  vitals: {
    bp_systolic: number | null;
    bp_diastolic: number | null;
    pulse: number | null;
    temperature: number | null;
    spo2: number | null;
    respiratory_rate: number | null;
    weight_kg: number | null;
    height_cm: number | null;
  } | null;
  past_diagnoses: string[];
  medications: string[];
  allergies: string[];
  lab_results: Array<{
    parameter: string;
    value: string;
    unit: string | null;
    reference_range: string | null;
    is_abnormal: boolean | null;
    reported_at: string | null;
  }>;
  lifestyle_factors: Record<string, unknown>;
}

/**
 * Build a full patient context snapshot via the server-side engine.
 * Only runs when the new pipeline feature flag is enabled.
 * Returns null if disabled or on error.
 */
export async function buildPatientContext(
  visitId: string
): Promise<PatientContextSnapshot | null> {
  if (!isNewPipelineEnabled()) {
    console.log("[ContextEngine] New pipeline disabled, skipping server-side context build.");
    return null;
  }

  const { data, error } = await supabase.functions.invoke("generate-patient-context", {
    body: { visit_id: visitId },
  });

  if (error) {
    console.error("[ContextEngine] Failed to build patient context:", error);
    return null;
  }

  return data?.context ?? null;
}
