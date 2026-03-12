/**
 * Clinical Context Service — Single Source of Truth
 *
 * Builds, merges, and validates the Clinical Context Object (CCO)
 * from multiple input sources with priority-based merge ordering.
 *
 * Priority order (highest to lowest):
 *   1. Doctor input
 *   2. Front desk intake
 *   3. Patient self-intake
 *   4. AI extraction
 */

import { supabase } from "@/integrations/supabase/client";
import { buildClinicalContextObject, getLatestCCO, type ClinicalContextObject } from "@/services/clinical_context/cco-client";

// ── Types ──

export interface ContextSource {
  source_type: "doctor" | "front_desk" | "patient_intake" | "ai_extraction" | "uploaded_report";
  chief_complaint?: string;
  symptoms?: string[];
  symptom_duration?: string;
  associated_symptoms?: string[];
  medical_history?: string[];
  family_history?: string[];
  risk_factors?: string[];
  medications?: string[];
  allergies?: string[];
  vitals?: {
    bp_systolic?: number | null;
    bp_diastolic?: number | null;
    pulse?: number | null;
    temperature?: number | null;
    spo2?: number | null;
    respiratory_rate?: number | null;
    weight_kg?: number | null;
    height_cm?: number | null;
  };
  lab_results?: Array<{
    parameter: string;
    value: string;
    unit?: string | null;
    reference_range?: string | null;
    is_abnormal?: boolean | null;
  }>;
}

export interface MergedContextObject {
  visit_id: string;
  patient_id: string;
  clinic_id: string;
  chief_complaint: string;
  symptoms: string[];
  symptom_duration: string;
  associated_symptoms: string[];
  medical_history: string[];
  family_history: string[];
  risk_factors: string[];
  medications: string[];
  allergies: string[];
  vitals: ContextSource["vitals"] | null;
  lab_results: ContextSource["lab_results"];
  risk_flags: string[];
  missing_information: string[];
  context_confidence: number;
  source_priority: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missing_information: string[];
}

// ── Priority Map ──

const SOURCE_PRIORITY: Record<ContextSource["source_type"], number> = {
  doctor: 1,
  front_desk: 2,
  patient_intake: 3,
  ai_extraction: 4,
  uploaded_report: 5,
};

// ── Build Context Object ──

/**
 * Build a CCO from a visit ID using the server-side edge function.
 * Falls back to database lookup if edge function fails.
 */
export async function buildContextObject(visitId: string): Promise<ClinicalContextObject | null> {
  try {
    const cco = await buildClinicalContextObject(visitId);
    if (cco) return cco;
  } catch (e) {
    console.warn("[ContextService] Edge function failed, falling back to DB:", e);
  }

  return getLatestCCO(visitId);
}

// ── Merge Context Sources ──

/**
 * Merge multiple context sources using priority ordering.
 * Higher-priority sources override lower-priority ones for scalar fields.
 * Array fields are union-merged and deduplicated.
 */
export function mergeContextSources(
  visitId: string,
  patientId: string,
  clinicId: string,
  sources: ContextSource[],
): MergedContextObject {
  // Sort by priority (doctor first)
  const sorted = [...sources].sort(
    (a, b) => SOURCE_PRIORITY[a.source_type] - SOURCE_PRIORITY[b.source_type],
  );

  const merged: MergedContextObject = {
    visit_id: visitId,
    patient_id: patientId,
    clinic_id: clinicId,
    chief_complaint: "",
    symptoms: [],
    symptom_duration: "",
    associated_symptoms: [],
    medical_history: [],
    family_history: [],
    risk_factors: [],
    medications: [],
    allergies: [],
    vitals: null,
    lab_results: [],
    risk_flags: [],
    missing_information: [],
    context_confidence: 0,
    source_priority: sorted.map(s => s.source_type),
  };

  // Scalar fields: take from highest-priority source that has them
  for (const src of sorted) {
    if (!merged.chief_complaint && src.chief_complaint) merged.chief_complaint = src.chief_complaint;
    if (!merged.symptom_duration && src.symptom_duration) merged.symptom_duration = src.symptom_duration;
    if (!merged.vitals && src.vitals) merged.vitals = src.vitals;
  }

  // Array fields: union-merge and deduplicate (case-insensitive)
  const dedup = (arr: string[]) => [...new Set(arr.map(s => s.toLowerCase().trim()).filter(Boolean))];

  for (const src of sorted) {
    if (src.symptoms) merged.symptoms.push(...src.symptoms);
    if (src.associated_symptoms) merged.associated_symptoms.push(...src.associated_symptoms);
    if (src.medical_history) merged.medical_history.push(...src.medical_history);
    if (src.family_history) merged.family_history.push(...src.family_history);
    if (src.risk_factors) merged.risk_factors.push(...src.risk_factors);
    if (src.medications) merged.medications.push(...src.medications);
    if (src.allergies) merged.allergies.push(...src.allergies);
    if (src.lab_results) merged.lab_results.push(...src.lab_results);
  }

  merged.symptoms = dedup(merged.symptoms);
  merged.associated_symptoms = dedup(merged.associated_symptoms);
  merged.medical_history = dedup(merged.medical_history);
  merged.family_history = dedup(merged.family_history);
  merged.risk_factors = dedup(merged.risk_factors);
  merged.medications = dedup(merged.medications);
  merged.allergies = dedup(merged.allergies);

  // Compute confidence
  const validation = validateContextObject(merged);
  merged.missing_information = validation.missing_information;
  merged.context_confidence = computeConfidence(merged);

  return merged;
}

// ── Validate Context Object ──

/**
 * Validate a merged context object for pipeline readiness.
 */
export function validateContextObject(ctx: Partial<MergedContextObject>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];

  // Required fields
  if (!ctx.chief_complaint) {
    errors.push("Chief complaint is required");
    missing.push("chief_complaint");
  }

  if (!ctx.symptoms || ctx.symptoms.length === 0) {
    errors.push("At least one symptom is required");
    missing.push("symptoms");
  }

  // Recommended fields
  if (!ctx.vitals) {
    warnings.push("Vitals not recorded");
    missing.push("vitals");
  }

  if (!ctx.symptom_duration) {
    warnings.push("Symptom duration not specified");
    missing.push("symptom_duration");
  }

  if (!ctx.medical_history || ctx.medical_history.length === 0) {
    missing.push("medical_history");
  }

  if (!ctx.medications || ctx.medications.length === 0) {
    missing.push("current_medications");
  }

  if (!ctx.allergies || ctx.allergies.length === 0) {
    missing.push("allergies");
  }

  if (!ctx.lab_results || ctx.lab_results.length === 0) {
    missing.push("lab_results");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missing_information: missing,
  };
}

// ── Confidence Scoring ──

function computeConfidence(ctx: MergedContextObject): number {
  let score = 0;
  const weights = {
    chief_complaint: 0.25,
    symptoms: 0.20,
    vitals: 0.15,
    medical_history: 0.10,
    medications: 0.08,
    allergies: 0.07,
    symptom_duration: 0.05,
    lab_results: 0.05,
    risk_factors: 0.05,
  };

  if (ctx.chief_complaint) score += weights.chief_complaint;
  if (ctx.symptoms.length > 0) score += weights.symptoms;
  if (ctx.vitals) score += weights.vitals;
  if (ctx.medical_history.length > 0) score += weights.medical_history;
  if (ctx.medications.length > 0) score += weights.medications;
  if (ctx.allergies.length > 0) score += weights.allergies;
  if (ctx.symptom_duration) score += weights.symptom_duration;
  if (ctx.lab_results && ctx.lab_results.length > 0) score += weights.lab_results;
  if (ctx.risk_factors.length > 0) score += weights.risk_factors;

  return Math.round(score * 100) / 100;
}

/**
 * Log pipeline execution to the pipeline_execution_logs table.
 */
export async function logPipelineExecution(
  visitId: string,
  engineName: string,
  status: "started" | "completed" | "failed" | "skipped",
  latencyMs?: number,
  errorMessage?: string,
): Promise<void> {
  try {
    await supabase.from("pipeline_execution_logs" as any).insert({
      visit_id: visitId,
      engine_name: engineName,
      status,
      latency_ms: latencyMs ?? null,
      error_message: errorMessage ?? null,
    });
  } catch {
    // Non-blocking
  }
}
