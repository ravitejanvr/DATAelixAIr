/**
 * Medication Intelligence Client
 * 
 * Client-side service for the medication validation pipeline.
 * Provides typed interfaces and invocation helpers.
 */

import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface MedicationOrder {
  drug_input: string;
  drug_generic?: string;
  drug_brand?: string;
  ingredient_id?: string;
  dose_value?: number;
  dose_unit?: string;
  frequency?: string;
  route?: string;
  duration_days?: number;
  indication?: string;
}

export interface MedicationWarning {
  type:
    | "allergy"
    | "interaction"
    | "dose_exceeded"
    | "pediatric_dose"
    | "contraindication"
    | "indication_mismatch"
    | "duplicate_ingredient";
  severity: "critical" | "high" | "moderate" | "low";
  drug: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface NormalizedMedication {
  original: string;
  generic_name: string | null;
  brand_name: string | null;
  ingredient_cui: string | null;
  dose_value: number | null;
  dose_unit: string;
  frequency_code: string;
  times_per_day: number;
  route: string;
  duration_days: number | null;
  max_daily_dose: number | null;
  pediatric_dose: string | null;
  mg_per_kg: number | null;
  renal_adjustment: string | null;
  hepatic_adjustment: string | null;
  pregnancy_category: string | null;
  contraindications: string[];
  indication: string | null;
  guideline_reference: string | null;
  safety_score: number;
}

export interface MedicationValidationResult {
  medications: NormalizedMedication[];
  warnings: MedicationWarning[];
  summary: {
    total_medications: number;
    total_warnings: number;
    critical_warnings: number;
    high_warnings: number;
    safety_score: number;
    is_pediatric: boolean;
    validation_ms: number;
  };
}

// ── API ──

/**
 * Run the full medication intelligence pipeline:
 * normalization → indication → dose → pediatric → interaction → allergy → contraindication → score
 */
export async function validateMedications(params: {
  medications: MedicationOrder[];
  patient_allergies?: string[];
  patient_weight_kg?: number | null;
  patient_age?: number | null;
  patient_diagnoses?: string[];
  existing_medications?: string[];
}): Promise<MedicationValidationResult | null> {
  const { data, error } = await supabase.functions.invoke("validate-medication", {
    body: {
      medications: params.medications,
      patient_allergies: params.patient_allergies || [],
      patient_weight_kg: params.patient_weight_kg,
      patient_age: params.patient_age,
      patient_diagnoses: params.patient_diagnoses || [],
      existing_medications: params.existing_medications || [],
    },
  });

  if (error) {
    console.error("[MedIntel] Validation failed:", error);
    return null;
  }

  return data as MedicationValidationResult;
}

/**
 * Severity priority for sorting warnings.
 */
export function warningSeverityPriority(severity: MedicationWarning["severity"]): number {
  switch (severity) {
    case "critical": return 0;
    case "high": return 1;
    case "moderate": return 2;
    case "low": return 3;
    default: return 4;
  }
}

/**
 * Sort warnings by severity (critical first).
 */
export function sortWarnings(warnings: MedicationWarning[]): MedicationWarning[] {
  return [...warnings].sort((a, b) => warningSeverityPriority(a.severity) - warningSeverityPriority(b.severity));
}

/**
 * Get a color class for a safety score.
 */
export function safetyScoreColor(score: number): string {
  if (score >= 90) return "text-emerald-600";
  if (score >= 70) return "text-amber-600";
  if (score >= 50) return "text-orange-600";
  return "text-destructive";
}
