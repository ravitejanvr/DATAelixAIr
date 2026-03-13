/**
 * Evidence Planning Engine — Client Service
 *
 * Computes information gain for each candidate lab test to recommend
 * the most discriminative investigations for differential diagnosis.
 * Deterministic, graph-only — no LLM calls. Target latency: <300ms.
 */

import { supabase } from "@/integrations/supabase/client";

export interface PlannedTest {
  test_name: string;
  test_id: string | null;
  category: string;
  priority: string;
  information_gain: number;
  discrimination_score: number;
  differentiates_between: string[];
  supports_diagnoses: string[];
  rules_out_diagnoses: string[];
  clinical_rationale: string;
}

export interface EvidencePlanResult {
  planned_tests: PlannedTest[];
  summary: {
    total_candidate_tests: number;
    high_value_tests: number;
    diagnoses_evaluated: number;
    max_information_gain: number;
  };
  execution_ms: number;
}

export interface EvidencePlanInput {
  candidate_diagnoses: Array<{
    diagnosis_id: string;
    diagnosis_name: string;
    probability: number;
    must_not_miss?: boolean;
  }>;
  patient_symptoms: string[];
  existing_tests?: string[];
  patient_age?: number | null;
  patient_sex?: string | null;
}

/**
 * Compute optimal next investigations ranked by information gain.
 * Returns null on error (graceful degradation).
 */
export async function planEvidence(
  input: EvidencePlanInput,
): Promise<EvidencePlanResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke("plan-evidence", {
      body: input,
    });

    if (error) {
      console.error("[EvidencePlanning] Failed:", error);
      return null;
    }

    return data as EvidencePlanResult;
  } catch (e) {
    console.error("[EvidencePlanning] Error:", e);
    return null;
  }
}
