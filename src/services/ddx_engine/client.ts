/**
 * DDX Engine v3 — Client Service
 *
 * Invokes the Bayesian DDX engine for structured differential diagnosis.
 * Gated by USE_DDX_ENGINE feature flag.
 */

import { supabase } from "@/integrations/supabase/client";
import { isDdxEngineEnabled } from "@/services/feature_flags";

export interface DDXDiagnosis {
  diagnosis_id: string;
  diagnosis_name: string;
  icd10_code: string | null;
  category: string;
  probability: number;
  supporting_symptoms: string[];
  contradicting_factors: string[];
  symptom_coverage: string;
  must_not_miss: boolean;
  emergency_protocol?: string;
  severity_level?: string;
  guideline_source?: string;
}

export interface DDXLabRecommendation {
  test_name: string;
  category: string;
  priority: string;
  differentiates: string[];
}

export interface DDXMedication {
  generic_name: string;
  drug_class: string;
  line_of_treatment: string;
  for_diagnosis: string;
  safe: boolean;
  allergy_conflict: boolean;
  contraindications: Array<{ condition: string; severity: string }>;
  interactions: Array<{ with_drug: string; severity: string; description: string }>;
}

export interface DDXGuideline {
  guideline_name: string;
  authority: string;
  authority_priority: number;
  recommendation: string;
  evidence_level: string;
  treatment: string;
  for_diagnosis: string;
  source?: string;
  guideline_url?: string;
}

export interface DDXResult {
  differential_diagnoses: DDXDiagnosis[];
  recommended_labs: DDXLabRecommendation[];
  suggested_medications: DDXMedication[];
  guideline_recommendations: DDXGuideline[];
  dangerous_diagnoses: Array<{
    diagnosis_id: string;
    diagnosis_name: string;
    severity_level: string;
    must_not_miss: boolean;
    emergency_protocol: string;
    trigger_symptom: string;
  }>;
  matched_symptoms: string[];
  unmatched_symptoms: string[];
  dangerous_diagnoses_injected: number;
  must_not_miss_count: number;
  execution_ms: number;
  stage_latencies: {
    symptom_resolution: number;
    bayesian_scoring: number;
    dangerous_injection: number;
    enrichment: number;
  };
  bayesian_model: boolean;
  source: string;
  graph_miss: boolean;
}

export interface DDXInput {
  symptoms: string[];
  vitals?: Record<string, any>;
  age?: number | null;
  sex?: string | null;
  weight_kg?: number | null;
  medical_history?: string[];
  current_medications?: string[];
  allergies?: string[];
  risk_factors?: string[];
  visit_id?: string | null;
  clinic_id?: string | null;
  cco_id?: string | null;
  physiological_context?: {
    candidate_diagnosis_ids: string[];
    affected_systems: string[];
    physiological_states: Array<{ state: string; confidence: number; system: string }>;
  };
}

/**
 * Run the Bayesian DDX engine. Returns null if disabled or on error.
 */
export async function runDDXEngine(input: DDXInput): Promise<DDXResult | null> {
  if (!isDdxEngineEnabled()) {
    console.log("[DDXEngine] DDX engine disabled, skipping.");
    return null;
  }

  try {
    const { data, error } = await supabase.functions.invoke("ddx-engine", {
      body: input,
    });

    if (error) {
      console.error("[DDXEngine] Failed:", error);
      return null;
    }

    return data as DDXResult;
  } catch (e) {
    console.error("[DDXEngine] Error:", e);
    return null;
  }
}
