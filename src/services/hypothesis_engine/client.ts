/**
 * Diagnostic Hypothesis Engine — Client Service
 * 
 * Invokes the generate-hypotheses edge function to produce
 * ranked differential diagnoses from patient context.
 * Only active when new pipeline feature flag is enabled.
 */

import { supabase } from "@/integrations/supabase/client";
import { isNewPipelineEnabled } from "@/services/feature_flags";
import type { PatientContextSnapshot } from "@/services/clinical_context/client";

export interface DiagnosticHypothesis {
  diagnosis: string;
  confidence: number;
  supporting_factors: string[];
  contradicting_factors: string[];
  recommended_tests: string[];
}

export interface HypothesisResult {
  hypotheses: DiagnosticHypothesis[];
  generated_at: string;
}

/**
 * Generate diagnostic hypotheses from patient context.
 * Returns null if pipeline is disabled or on error.
 */
export async function generateDiagnosticHypotheses(
  visitId: string,
  patientContext: PatientContextSnapshot
): Promise<HypothesisResult | null> {
  if (!isNewPipelineEnabled()) {
    console.log("[HypothesisEngine] New pipeline disabled, skipping.");
    return null;
  }

  const { data, error } = await supabase.functions.invoke("generate-hypotheses", {
    body: { visit_id: visitId, patient_context: patientContext },
  });

  if (error) {
    console.error("[HypothesisEngine] Failed:", error);
    return null;
  }

  return {
    hypotheses: data?.hypotheses ?? [],
    generated_at: new Date().toISOString(),
  };
}
