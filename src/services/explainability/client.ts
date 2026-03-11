/**
 * Clinical Explainability Engine — Client Service
 * 
 * Generates SHAP-style factor attribution for diagnostic conclusions.
 * Makes AI reasoning transparent and interpretable for clinicians.
 */

import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface ExplanationFactor {
  factor: string;
  type: "symptom" | "vital" | "lab" | "history" | "risk_factor" | "medication" | "guideline" | "absence";
  direction: "positive" | "negative" | "neutral";
  weight: number;
  source?: string;
}

export interface DiagnosisExplanation {
  diagnosis: string;
  summary: string;
  factors: ExplanationFactor[];
  confidence_rationale: string;
  factor_counts: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

export interface ExplainabilityResult {
  explanations: DiagnosisExplanation[];
  duration_ms: number;
}

export interface ExplainabilityInput {
  diagnoses: Array<{
    diagnosis_name?: string;
    diagnosis?: string;
    probability?: number;
    fused_probability?: number;
    confidence?: number;
  }>;
  symptoms: string[];
  chief_complaint?: string;
  vitals?: Record<string, any>;
  medical_history?: string[];
  current_medications?: string[];
  allergies?: string[];
  lab_results?: any[];
  risk_factors?: string[];
  patient_age?: number | null;
  patient_sex?: string | null;
  guideline_sources?: string[];
}

/**
 * Generate SHAP-style explanations for clinical diagnoses.
 */
export async function generateExplanations(
  input: ExplainabilityInput
): Promise<ExplainabilityResult | null> {
  console.log("[Explainability] Generating factor attributions...");

  try {
    const { data, error } = await supabase.functions.invoke("clinical-explainability", {
      body: input,
    });

    if (error) {
      console.error("[Explainability] Failed:", error);
      return null;
    }

    return data as ExplainabilityResult;
  } catch (e) {
    console.error("[Explainability] Error:", e);
    return null;
  }
}

/**
 * Get a color class for factor direction.
 */
export function factorDirectionColor(direction: string): string {
  switch (direction) {
    case "positive": return "text-emerald-600 dark:text-emerald-400";
    case "negative": return "text-destructive";
    case "neutral": return "text-muted-foreground";
    default: return "text-muted-foreground";
  }
}

/**
 * Get an icon indicator for factor direction.
 */
export function factorDirectionSymbol(direction: string): string {
  switch (direction) {
    case "positive": return "+";
    case "negative": return "−";
    case "neutral": return "○";
    default: return "?";
  }
}

/**
 * Format factor weight as a visual bar width percentage.
 */
export function factorBarWidth(weight: number): string {
  return `${Math.round(Math.max(weight, 0.05) * 100)}%`;
}
