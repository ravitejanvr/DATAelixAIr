/**
 * Hypothesis Testing Engine — Client Service
 *
 * Validates DDX candidates against symptom_likelihoods from the knowledge graph.
 * Deterministic, graph-only — no LLM calls. Target latency: <200ms.
 */

import { supabase } from "@/integrations/supabase/client";

export interface TestedHypothesis {
  diagnosis_id: string;
  diagnosis_name: string;
  icd10_code: string | null;
  original_probability: number;
  evidence_score: number;
  adjusted_probability: number;
  verdict: "supported" | "partially_supported" | "weakly_supported" | "indeterminate";
  supporting_symptoms: Array<{ symptom: string; likelihood: number }>;
  missing_expected_symptoms: Array<{ symptom: string; likelihood: number }>;
  contradicting_factors: string[];
  must_not_miss: boolean;
  coverage_ratio: number;
}

export interface HypothesisTestResult {
  tested_hypotheses: TestedHypothesis[];
  summary: {
    total_tested: number;
    supported: number;
    partially_supported: number;
    weakly_supported: number;
    indeterminate: number;
    likelihoods_available: number;
  };
  execution_ms: number;
}

export interface HypothesisTestInput {
  candidate_diagnoses: Array<{
    diagnosis_id: string;
    diagnosis_name: string;
    icd10_code?: string | null;
    probability: number;
    must_not_miss?: boolean;
  }>;
  patient_symptoms: string[];
  patient_age?: number | null;
  patient_sex?: string | null;
  allergies?: string[];
  current_medications?: string[];
}

/**
 * Test DDX candidates against the knowledge graph's symptom_likelihoods.
 * Returns null on error (graceful degradation).
 */
export async function testHypotheses(
  input: HypothesisTestInput,
): Promise<HypothesisTestResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke("test-hypotheses", {
      body: input,
    });

    if (error) {
      console.error("[HypothesisTesting] Failed:", error);
      return null;
    }

    return data as HypothesisTestResult;
  } catch (e) {
    console.error("[HypothesisTesting] Error:", e);
    return null;
  }
}
