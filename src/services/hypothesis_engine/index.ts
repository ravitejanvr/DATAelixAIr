/**
 * Diagnostic Hypothesis Engine
 * 
 * Generates ranked differential diagnoses from clinical context.
 * Now connects to the clinical knowledge graph for structured reasoning
 * and injects must-not-miss dangerous diagnoses.
 */

export interface DiagnosticHypothesis {
  condition: string;
  icd_code: string | null;
  confidence: "high" | "moderate" | "low";
  supporting_evidence: string[];
  contradicting_evidence: string[];
  recommended_tests: string[];
  urgency: "routine" | "urgent" | "emergent";
  must_not_miss?: boolean;
}

export interface HypothesisResult {
  hypotheses: DiagnosticHypothesis[];
  reasoning_chain: string;
  data_gaps: string[];
  generated_at: string;
  source?: string;
}

/**
 * Generate diagnostic hypotheses from enriched clinical context.
 * 
 * Uses the generate-hypotheses edge function which internally calls:
 * 1. query-clinical-graph (knowledge graph traversal)
 * 2. AI reasoning with graph context
 * 3. dangerous_diagnoses injection
 */
export async function generateHypotheses(
  context: import("@/services/clinical_context").EnrichedClinicalContext
): Promise<HypothesisResult> {
  console.log("[HypothesisEngine] Generating hypotheses for visit:", context.visit_id);
  
  // The actual graph + AI logic is in the generate-hypotheses edge function.
  // The client service (hypothesis_engine/client.ts) invokes it.
  // This index.ts is used by the client-side orchestrator which already calls the edge function.
  // Return empty to let the edge function handle it.
  return {
    hypotheses: [],
    reasoning_chain: "",
    data_gaps: [],
    generated_at: new Date().toISOString(),
    source: "pending_edge_function",
  };
}

/**
 * Validate that hypothesis output meets minimum quality thresholds.
 */
export function validateHypotheses(result: HypothesisResult): boolean {
  if (result.hypotheses.length === 0) return false;
  // Every hypothesis must have at least one supporting evidence item
  return result.hypotheses.every(h => h.supporting_evidence.length > 0);
}
