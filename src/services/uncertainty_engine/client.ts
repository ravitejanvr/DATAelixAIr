/**
 * Uncertainty Engine v2 — Client Service
 *
 * Invokes the uncertainty-engine edge function to produce
 * calibrated confidence scores using:
 *   1. Evidence strength (graph support, citations, guideline authority)
 *   2. Missing data detection
 *   3. Conflicting signal analysis
 *
 * Output categories: High, Moderate, Low, Very Uncertain
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
    evidence_strength: number;
    evidence_components?: {
      graph_support: number;
      citation_quality: number;
      guideline_strength: number;
    };
    data_completeness: number;
    signal_coherence: number;
    conflict_count?: number;
    // Legacy fields for backward compat
    symptom_match?: number;
    vital_support?: number;
    guideline_strength?: number;
    lab_confirmation?: number;
    missing_data_penalty?: number;
    conflict_penalty?: number;
    safety_penalty?: number;
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
    fused_probability?: number;
    supporting_symptoms?: string[];
    contradicting_factors?: string[];
    must_not_miss?: boolean;
    paradigm_sources?: string[];
  }>;
  suggested_labs?: Array<{ test_name: string; priority?: string }>;
  guideline_sources?: string[];
  guideline_recommendations?: Array<{ authority?: string; evidence_level?: string }>;
  evidence_citations?: Array<{ source?: string; title?: string; evidence_strength?: string }>;
  safety_flags?: string[];
  safety_score?: number;
  medical_history?: string[];
  current_medications?: string[];
  allergies?: string[];
  matched_symptoms?: string[];
  unmatched_symptoms?: string[];
  dangerous_diagnoses?: any[];
  paradigm_agreement?: string;
  conflicts?: any[];
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

/**
 * Get a color class for confidence label.
 */
export function confidenceLabelColor(label: string): string {
  switch (label) {
    case "High": return "text-emerald-600 border-emerald-200";
    case "Moderate": return "text-amber-600 border-amber-200";
    case "Low": return "text-orange-600 border-orange-200";
    case "Very Uncertain": return "text-destructive border-destructive/30";
    default: return "text-muted-foreground";
  }
}
