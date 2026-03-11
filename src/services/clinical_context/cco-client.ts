/**
 * Clinical Context Object (CCO) Client
 * 
 * Invokes the build-clinical-context edge function and provides
 * typed access to the structured context object.
 */

import { supabase } from "@/integrations/supabase/client";

export interface ContextField<T = unknown> {
  value: T;
  source: string;
  confidence: number;
}

export interface CCOPatientProfile {
  patient_id: ContextField<string>;
  age: ContextField<number | null>;
  sex: ContextField<string | null>;
  weight: ContextField<number | null>;
  pregnancy_status: ContextField<string | null>;
  risk_factors: ContextField<string[]>;
  family_history: ContextField<string | null>;
}

export interface CCOEpisodeContext {
  chief_complaint: ContextField<string>;
  symptoms: ContextField<string | null>;
  symptom_duration: ContextField<string | null>;
  associated_symptoms: ContextField<string | null>;
  severity: ContextField<string | null>;
  onset_type: ContextField<string | null>;
}

export interface CCOMedicalHistory {
  past_conditions: ContextField<string[]>;
  current_medications: ContextField<string[]>;
  drug_allergies: ContextField<string[]>;
  previous_antibiotics: ContextField<string[]>;
  vaccination_history: ContextField<string | null>;
}

export interface CCOClinicalObservations {
  vitals: ContextField<{
    bp_systolic: number | null;
    bp_diastolic: number | null;
    pulse: number | null;
    temperature: number | null;
    spo2: number | null;
    respiratory_rate: number | null;
    weight_kg: number | null;
    height_cm: number | null;
  } | null>;
  recent_labs: ContextField<Array<{
    parameter: string;
    value: string;
    unit: string | null;
    reference_range: string | null;
    is_abnormal: boolean | null;
    reported_at: string | null;
  }>>;
  uploaded_reports: ContextField<null>;
}

export interface CCODerivedContext {
  risk_flags: ContextField<string[]>;
  missing_information: ContextField<string[]>;
  context_confidence: ContextField<number>;
  evidence_sources: ContextField<Array<{ field: string; source: string }>>;
}

export interface ClinicalContextObject {
  cco_id: string;
  version: number;
  context_confidence: number;
  fields_populated: number;
  total_fields: number;
  missing_fields: string[];
  risk_flags: string[];
  patient_profile: CCOPatientProfile;
  episode_context: CCOEpisodeContext;
  medical_history: CCOMedicalHistory;
  clinical_observations: CCOClinicalObservations;
  derived_context: CCODerivedContext;
}

/**
 * Build a structured Clinical Context Object for a visit.
 * Returns the full CCO with field-level provenance and confidence.
 */
export async function buildClinicalContextObject(
  visitId: string
): Promise<ClinicalContextObject | null> {
  const { data, error } = await supabase.functions.invoke("build-clinical-context", {
    body: { visit_id: visitId },
  });

  if (error) {
    console.error("[CCO] Failed to build clinical context:", error);
    return null;
  }

  return data as ClinicalContextObject;
}

/**
 * Fetch the latest CCO for a visit from the database.
 */
export async function getLatestCCO(visitId: string): Promise<ClinicalContextObject | null> {
  const { data, error } = await supabase
    .from("clinical_context_objects")
    .select("*")
    .eq("visit_id", visitId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    cco_id: data.id,
    version: data.version,
    context_confidence: Number(data.context_confidence),
    fields_populated: data.fields_populated,
    total_fields: data.total_fields,
    missing_fields: data.missing_fields,
    risk_flags: [],
    patient_profile: data.patient_profile as unknown as CCOPatientProfile,
    episode_context: data.episode_context as unknown as CCOEpisodeContext,
    medical_history: data.medical_history as unknown as CCOMedicalHistory,
    clinical_observations: data.clinical_observations as unknown as CCOClinicalObservations,
    derived_context: data.derived_context as unknown as CCODerivedContext,
  };
}
