/**
 * Uncertainty Engine — Client Service
 *
 * Invokes the uncertainty-engine edge function to produce
 * calibrated confidence scores and missing evidence detection.
 * Gated by ENABLE_UNCERTAINTY_ENGINE feature flag.
 */

import { supabase } from "@/integrations/supabase/client";
import { isUncertaintyEngineEnabled } from "@/services/feature_flags";

export interface UncertaintyResult {
  confidence_score: number;
  confidence_label: string;
  top_diagnosis: string;
  alternative_diagnoses: Array<{ name: string; probability: number }>;
  must_not_miss: string[];
  missing_evidence: string[];
  diagnostic_conflict: boolean;
  conflict_details: string[];
  guideline_sources: string[];
  safety_flags: string[];
  scoring_breakdown: {
    symptom_match: number;
    vital_support: number;
    guideline_strength: number;
    lab_confirmation: number;
    missing_data_penalty: number;
    conflict_penalty: number;
    safety_penalty: number;
  };
  execution_ms: number;
}

export interface UncertaintyInput {
  symptoms: string[];
  vitals?: Record<string, any>;
  differential_diagnoses: Array<{
    diagnosis_name?: string;
    diagnosis?: string;
    probability?: number;
    confidence?: number;
    supporting_symptoms?: string[];
    must_not_miss?: boolean;
  }>;
  suggested_labs?: Array<{ test_name: string; priority?: string }>;
  guideline_sources?: string[];
  guideline_recommendations?: Array<{ authority?: string; evidence_level?: string }>;
  safety_flags?: string[];
  safety_score?: number;
  medical_history?: string[];
  current_medications?: string[];
  allergies?: string[];
  matched_symptoms?: string[];
  unmatched_symptoms?: string[];
}

/**
 * Run the uncertainty engine. Returns null if disabled or on error.
 */
export async function runUncertaintyEngine(input: UncertaintyInput): Promise<UncertaintyResult | null> {
  if (!isUncertaintyEngineEnabled()) {
    console.log("[UncertaintyEngine] Disabled, skipping.");
    return null;
  }

  try {
    const { data, error } = await supabase.functions.invoke("uncertainty-engine", {
      body: input,
    });

    if (error) {
      console.error("[UncertaintyEngine] Failed:", error);
      return null;
    }

    return data as UncertaintyResult;
  } catch (e) {
    console.error("[UncertaintyEngine] Error:", e);
    return null;
  }
}
