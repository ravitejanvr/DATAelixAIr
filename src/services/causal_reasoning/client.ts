/**
 * Causal Reasoning Engine — Client Service
 *
 * Invokes the causal-reasoning edge function to produce:
 *   1. Causal chains (Symptom → Mechanism → Disease)
 *   2. Convergent pathway detection
 *   3. Counterfactual analysis (critical vs supporting symptoms)
 *   4. Causal conflict detection
 *
 * Deterministic, graph-only — no LLM. Target: <300ms.
 */

import { supabase } from "@/integrations/supabase/client";

export interface CausalChain {
  symptom: string;
  mechanism: string;
  organ_system: string;
  disease: string;
  chain_confidence: number;
  chain_string: string;
}

export interface ConvergentPathway {
  mechanism: string;
  organ_system: string;
  contributing_symptoms: string[];
  linked_diseases: string[];
  convergence_strength: number;
}

export interface CounterfactualInsight {
  diagnosis: string;
  critical_symptoms: string[];
  supporting_symptoms: string[];
  missing_expected_symptoms: string[];
  counterfactual_fragility: number;
}

export interface CausalConflict {
  diagnosis: string;
  conflicting_symptom: string;
  expected_mechanism: string;
  actual_mechanism: string;
  conflict_severity: "low" | "moderate" | "high";
  explanation: string;
}

export interface CausalReasoningResult {
  causal_chains: CausalChain[];
  convergent_pathways: ConvergentPathway[];
  counterfactuals: CounterfactualInsight[];
  causal_conflicts: CausalConflict[];
  summary: {
    total_chains: number;
    convergent_pathways_detected: number;
    counterfactuals_analyzed: number;
    causal_conflicts_detected: number;
    unique_mechanisms: number;
    unique_organ_systems: number;
  };
  execution_ms: number;
}

export interface CausalReasoningInput {
  symptoms: string[];
  candidate_diagnoses?: Array<{
    diagnosis_id: string;
    diagnosis_name: string;
    probability: number;
    must_not_miss?: boolean;
  }>;
  patient_age?: number | null;
  patient_sex?: string | null;
}

/**
 * Run the causal reasoning engine. Returns null on error.
 */
export async function runCausalReasoning(
  input: CausalReasoningInput,
): Promise<CausalReasoningResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke("causal-reasoning", {
      body: input,
    });

    if (error) {
      console.error("[CausalReasoning] Failed:", error);
      return null;
    }

    return data as CausalReasoningResult;
  } catch (e) {
    console.error("[CausalReasoning] Error:", e);
    return null;
  }
}
