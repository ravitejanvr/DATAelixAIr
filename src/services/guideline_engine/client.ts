/**
 * Guideline Alignment Engine — Client Service
 * 
 * Retrieves tier-ranked clinical guidelines matching patient context.
 * Only active when new pipeline feature flag is enabled.
 */

import { supabase } from "@/integrations/supabase/client";
import { isNewPipelineEnabled } from "@/services/feature_flags";
import type { PatientContextSnapshot } from "@/services/clinical_context/client";
import type { DiagnosticHypothesis } from "@/services/hypothesis_engine/client";

export interface GuidelineRecommendation {
  guideline_id?: string;
  guideline_source: string;
  tier: number;
  tier_label?: string;
  country?: string;
  recommendation: string;
  condition?: string;
  version?: string;
  relevance_score?: number;
  evidence_grade?: string;
}

export interface GuidelineResult {
  guidelines: GuidelineRecommendation[];
  source: string;
  retrieved_at: string;
}

/**
 * Retrieve tier-ranked guidelines for the current clinical context.
 * Returns null if pipeline is disabled or on error.
 */
export async function retrieveGuidelines(
  visitId: string,
  patientContext: PatientContextSnapshot,
  hypotheses?: DiagnosticHypothesis[]
): Promise<GuidelineResult | null> {
  if (!isNewPipelineEnabled()) {
    console.log("[GuidelineEngine] New pipeline disabled, skipping.");
    return null;
  }

  const { data, error } = await supabase.functions.invoke("retrieve-guidelines", {
    body: {
      visit_id: visitId,
      patient_context: patientContext,
      hypotheses: hypotheses ?? [],
    },
  });

  if (error) {
    console.error("[GuidelineEngine] Failed:", error);
    return null;
  }

  return {
    guidelines: data?.guidelines ?? [],
    source: data?.source ?? "unknown",
    retrieved_at: new Date().toISOString(),
  };
}
