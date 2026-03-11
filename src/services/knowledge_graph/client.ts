/**
 * Clinical Knowledge Graph Client
 * 
 * Typed client for invoking the query-clinical-graph edge function.
 * Performs full graph traversal: symptoms → diagnoses → drugs/labs/guidelines.
 */

import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface GraphDiagnosis {
  id: string;
  diagnosis_name: string;
  category: string;
  icd10_code: string | null;
  confidence: number;
  matching_symptoms: number;
  coverage_ratio: number;
  is_dangerous?: boolean;
  emergency_protocol?: string | null;
}

export interface GraphDrug {
  generic_name: string;
  line_of_treatment: string;
  source: "diagnosis_drug_map" | "symptom_drug_map";
  for_diagnosis: string;
  treatment_type?: string;
  drug_class?: string;
  max_daily_dose_mg?: number | null;
  pregnancy_category?: string | null;
  allergy_conflict: boolean;
}

export interface GraphLab {
  test_name: string;
  category: string;
  priority: string;
  source: "diagnosis_lab_map" | "symptom_lab_map";
  for_diagnosis: string;
  clinical_rationale?: string;
}

export interface GraphGuideline {
  title: string;
  organization: string;
  country: string;
  tier: number;
  recommendation: string;
  guideline_url: string | null;
  relevance_score: number;
  for_diagnosis: string;
}

export interface GraphTraversalResult {
  matched_symptoms: string[];
  unmatched_symptoms: string[];
  diagnoses: GraphDiagnosis[];
  suggested_labs: GraphLab[];
  suggested_drugs: GraphDrug[];
  guideline_references: GraphGuideline[];
  traversal_confidence: number;
  traversal_ms: number;
  graph_miss: boolean;
  node_counts: {
    symptoms_matched: number;
    diagnoses_found: number;
    drugs_found: number;
    labs_found: number;
    guidelines_found: number;
  };
  disclaimer: string;
}

// ── API ──

export async function queryClinicalGraph(params: {
  symptoms: string[];
  patient_age?: number | null;
  patient_sex?: string | null;
  patient_allergies?: string[];
  existing_medications?: string[];
  risk_factors?: string[];
}): Promise<GraphTraversalResult | null> {
  const { data, error } = await supabase.functions.invoke("query-clinical-graph", {
    body: params,
  });

  if (error) {
    console.error("[KnowledgeGraph] Traversal failed:", error);
    return null;
  }

  return data as GraphTraversalResult;
}

/**
 * Get a confidence label from a numeric score.
 */
export function confidenceLabel(score: number): string {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "moderate";
  if (score >= 0.3) return "low";
  return "very_low";
}
