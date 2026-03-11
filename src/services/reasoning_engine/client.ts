/**
 * Hybrid Clinical Reasoning Engine — Client Service
 * 
 * Combines three reasoning paradigms:
 *   1. Symbolic  — Knowledge graph rule-based inference
 *   2. Probabilistic — Bayesian scoring for diagnosis ranking
 *   3. Neural — LLM summarization, interpretation, explanation
 * 
 * Weighted fusion produces unified clinical reasoning output.
 */

import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface FusedDiagnosis {
  diagnosis_name: string;
  diagnosis_id: string | null;
  icd10_code: string | null;
  category: string;
  symbolic_score: number;
  probabilistic_score: number;
  neural_score: number;
  fused_score: number;
  fused_probability: number;
  supporting_symptoms: string[];
  must_not_miss: boolean;
  emergency_protocol?: string;
  severity_level?: string;
  recommended_tests: string[];
  treatment_options: string[];
  reasoning: string;
  paradigm_sources: string[];
}

export interface ReasoningTest {
  test_name: string;
  category: string;
  priority: string;
  source: "symbolic" | "neural" | "differentiator";
}

export interface ReasoningDrug {
  generic_name: string;
  drug_class: string;
  line_of_treatment: string;
  for_diagnosis: string;
  max_daily_dose_mg?: number | null;
  pregnancy_category?: string | null;
  source: string;
}

export interface ReasoningGuideline {
  authority: string;
  authority_priority: number;
  recommendation: string;
  evidence_level: string;
  treatment: string;
  country: string;
  source: string;
}

export interface SafetyAlert {
  alert_type: "critical" | "warning" | "info";
  message: string;
}

export interface ParadigmDetails {
  symbolic: {
    diagnoses_found: number;
    symptoms_matched: number;
    symptoms_unmatched: number;
    labs_found: number;
    drugs_found: number;
    guidelines_found: number;
  };
  probabilistic: {
    diagnoses_scored: number;
    top_probability: number;
    priors_used: number;
  };
  neural: {
    diagnoses_generated: number;
    safety_alerts_generated: number;
  };
}

export interface HybridReasoningResult {
  // Unified output
  differential_diagnoses: FusedDiagnosis[];
  recommended_tests: ReasoningTest[];
  treatment_options: ReasoningDrug[];
  guideline_references: ReasoningGuideline[];
  safety_alerts: SafetyAlert[];

  // Reasoning metadata
  reasoning_summary: string;
  reasoning_explanation: string;
  paradigm_agreement: "strong_agreement" | "moderate_agreement" | "divergent";
  confidence_assessment: "high" | "moderate" | "low" | "very_low";
  key_differentiators: string[];

  // Per-paradigm details
  paradigm_details: ParadigmDetails;
  weights: { symbolic: number; probabilistic: number; neural: number };
  dangerous_diagnoses: Array<{
    diagnosis_id: string;
    diagnosis_name: string;
    severity_level: string;
    emergency_protocol: string;
    trigger_symptom: string;
    must_not_miss: boolean;
  }>;
  matched_symptoms: string[];
  unmatched_symptoms: string[];
  stage_latencies: Record<string, number>;
  total_ms: number;
}

export interface HybridReasoningInput {
  symptoms: string[];
  chief_complaint?: string;
  vitals?: Record<string, any>;
  patient_age?: number | null;
  patient_sex?: string | null;
  weight_kg?: number | null;
  medical_history?: string[];
  current_medications?: string[];
  allergies?: string[];
  risk_factors?: string[];
  visit_id?: string | null;
  clinic_id?: string | null;
}

/**
 * Run the hybrid clinical reasoning engine.
 * Combines symbolic, probabilistic, and neural paradigms.
 */
export async function runHybridReasoning(
  input: HybridReasoningInput
): Promise<HybridReasoningResult | null> {
  console.log("[ReasoningEngine] Running hybrid clinical reasoning...");

  try {
    const { data, error } = await supabase.functions.invoke("clinical-reasoning-engine", {
      body: input,
    });

    if (error) {
      console.error("[ReasoningEngine] Failed:", error);
      return null;
    }

    return data as HybridReasoningResult;
  } catch (e) {
    console.error("[ReasoningEngine] Error:", e);
    return null;
  }
}

/**
 * Get a human-readable label for paradigm agreement.
 */
export function agreementLabel(agreement: string): string {
  switch (agreement) {
    case "strong_agreement": return "Strong Agreement";
    case "moderate_agreement": return "Moderate Agreement";
    case "divergent": return "Divergent — Review Recommended";
    default: return agreement;
  }
}

/**
 * Get a color class for confidence assessment.
 */
export function confidenceColor(confidence: string): string {
  switch (confidence) {
    case "high": return "text-emerald-600 border-emerald-200";
    case "moderate": return "text-amber-600 border-amber-200";
    case "low": return "text-orange-600 border-orange-200";
    case "very_low": return "text-destructive border-destructive/30";
    default: return "text-muted-foreground";
  }
}
