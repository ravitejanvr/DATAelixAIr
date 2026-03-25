/**
 * DDX Engine v4 — Client Service
 *
 * Invokes the probabilistic DDX engine with organ system reasoning,
 * score thresholds, and transparent reasoning traces.
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

export interface ReasoningTrace {
  diagnosis: string;
  diagnosis_id: string;
  total_score: number;
  prior: number;
  likelihood: number;
  symptom_coverage: number;
  symptom_evidence: Array<{ symptom: string; weight: number }>;
  organ_system_bonus: boolean;
  must_not_miss: boolean;
  contradicting_factors: string[];
  confidence: number;
}

export interface SafetyAlert {
  diagnosis_id: string | null;
  diagnosis_name: string;
  severity_level: string;
  must_not_miss: boolean;
  emergency_protocol: string;
  guideline_source: string;
  trigger_symptoms: string[];
  trigger_count: number;
  context_gate_passed: boolean;
  injection_level: string;
  supporting_context: {
    abnormal_vitals?: boolean;
    risk_age?: boolean;
    history_match?: boolean;
    symptom_signals?: number;
    vital_signals?: number;
  };
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
  safety_alerts: SafetyAlert[];
  matched_symptoms: string[];
  unmatched_symptoms: string[];
  dangerous_diagnoses_injected: number;
  must_not_miss_count: number;
  safety_alerts_count: number;
  organ_systems_active: string[];
  reasoning_traces: ReasoningTrace[];
  score_threshold_applied: number;
  execution_ms: number;
  stage_latencies: {
    symptom_resolution: number;
    bayesian_scoring: number;
    dangerous_injection: number;
    enrichment: number;
  };
  bayesian_model: boolean;
  phase9_active: boolean;
  phase10_active?: boolean;
  safety_augmented_count?: number;
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
  // Clinical modifiers for multi-signal candidate retrieval
  onset_pattern?: string | null;
  severity?: string | null;
  body_location?: string | null;
  duration?: string | null;
  family_history?: string[];
  phase9?: boolean;
  phase10_augment?: boolean;
}

/**
 * Run the probabilistic DDX engine. Returns null if disabled or on error.
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
