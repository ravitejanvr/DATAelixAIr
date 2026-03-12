/**
 * UnifiedClinicalContext — Canonical Type
 *
 * Consolidates MergedContextObject, EnrichedClinicalContext, and
 * PCIE patient_context_objects into a single interface consumed
 * by the v4 Wave Orchestrator (O1).
 *
 * Adapters convert legacy types into this structure during migration.
 */

import type { ClinicalContext } from "@/lib/clinical-context";
import type { MergedContextObject } from "@/services/context_service";
import type { EnrichedClinicalContext } from "@/services/clinical_context";

// ── Canonical Type ──

export interface UnifiedClinicalContext {
  // Identity
  visit_id: string | null;
  patient_id: string | null;
  clinic_id: string | null;
  consultation_id: string | null;

  // Demographics
  patient_age: number | null;
  patient_sex: string | null;
  patient_name: string | null;

  // Clinical Core
  chief_complaint: string;
  symptoms: string[];
  symptom_duration: string;
  associated_symptoms: string[];

  // History
  medical_history: string[];
  family_history: string[];
  risk_factors: string[];
  current_medications: string[];
  allergies: string[];

  // Vitals
  vitals: {
    bp_systolic?: number | null;
    bp_diastolic?: number | null;
    pulse?: number | null;
    temperature?: number | null;
    spo2?: number | null;
    respiratory_rate?: number | null;
    weight_kg?: number | null;
    height_cm?: number | null;
  } | null;

  // Labs
  lab_results: Array<{
    parameter: string;
    value: string;
    unit?: string | null;
    reference_range?: string | null;
    is_abnormal?: boolean | null;
  }>;

  // Intelligence
  risk_flags: string[];
  missing_information: string[];
  context_confidence: number;

  // Provenance
  source_type: "merged_context" | "enriched_context" | "pcie" | "direct";
  assembled_at: string;
}

// ── Adapters ──

/**
 * Convert a MergedContextObject (O2 format) to UnifiedClinicalContext.
 */
export function fromMergedContext(mco: MergedContextObject): UnifiedClinicalContext {
  return {
    visit_id: mco.visit_id || null,
    patient_id: mco.patient_id || null,
    clinic_id: mco.clinic_id || null,
    consultation_id: null,
    patient_age: null,
    patient_sex: null,
    patient_name: null,
    chief_complaint: mco.chief_complaint,
    symptoms: mco.symptoms,
    symptom_duration: mco.symptom_duration,
    associated_symptoms: mco.associated_symptoms,
    medical_history: mco.medical_history,
    family_history: mco.family_history,
    risk_factors: mco.risk_factors,
    current_medications: mco.medications,
    allergies: mco.allergies,
    vitals: mco.vitals || null,
    lab_results: mco.lab_results || [],
    risk_flags: mco.risk_flags,
    missing_information: mco.missing_information,
    context_confidence: mco.context_confidence,
    source_type: "merged_context",
    assembled_at: new Date().toISOString(),
  };
}

/**
 * Convert an EnrichedClinicalContext (O1 format) to UnifiedClinicalContext.
 */
export function fromEnrichedContext(ecc: EnrichedClinicalContext): UnifiedClinicalContext {
  const core = ecc.core;
  return {
    visit_id: ecc.visit_id,
    patient_id: null,
    clinic_id: ecc.clinic_id,
    consultation_id: ecc.consultation_id,
    patient_age: core.patient_age ?? null,
    patient_sex: core.patient_sex ?? null,
    patient_name: null,
    chief_complaint: core.chief_complaint || "",
    symptoms: (core as any).symptoms || [core.chief_complaint].filter(Boolean),
    symptom_duration: core.symptom_duration || "",
    associated_symptoms: [],
    medical_history: core.medical_history || [],
    family_history: [],
    risk_factors: [],
    current_medications: core.current_medications || [],
    allergies: core.allergies || [],
    vitals: {
      temperature: core.temperature ?? null,
      spo2: core.oxygen_saturation ?? null,
      pulse: core.pulse ?? null,
      bp_systolic: core.blood_pressure ? parseInt(core.blood_pressure.split("/")[0]) || null : null,
      bp_diastolic: core.blood_pressure ? parseInt(core.blood_pressure.split("/")[1]) || null : null,
    },
    lab_results: [],
    risk_flags: [],
    missing_information: [],
    context_confidence: 0,
    source_type: "enriched_context",
    assembled_at: ecc.assembled_at,
  };
}

/**
 * Convert a PCIE patient_context_objects row to UnifiedClinicalContext.
 */
export function fromPCIEContext(pcie: any): UnifiedClinicalContext {
  const episode = pcie.episode_context || {};
  const profile = pcie.patient_profile || {};
  const observations = pcie.clinical_observations || {};
  const history = pcie.medical_history || {};

  return {
    visit_id: pcie.visit_id || null,
    patient_id: pcie.patient_id || null,
    clinic_id: pcie.clinic_id || null,
    consultation_id: null,
    patient_age: profile.age ?? null,
    patient_sex: profile.sex ?? null,
    patient_name: profile.name ?? null,
    chief_complaint: episode.chief_complaint || "",
    symptoms: episode.symptoms || [],
    symptom_duration: episode.duration || "",
    associated_symptoms: episode.associated_symptoms || [],
    medical_history: history.conditions || [],
    family_history: history.family || [],
    risk_factors: history.risk_factors || [],
    current_medications: history.medications || [],
    allergies: history.allergies || [],
    vitals: observations.vitals || null,
    lab_results: observations.lab_results || [],
    risk_flags: (pcie.derived_context?.risk_flags || []),
    missing_information: pcie.missing_fields || [],
    context_confidence: pcie.context_confidence ?? 0,
    source_type: "pcie",
    assembled_at: pcie.updated_at || new Date().toISOString(),
  };
}

/**
 * Convert UnifiedClinicalContext back to a ClinicalContext (for O1 PipelineInput).
 */
export function toClinicalContext(ucc: UnifiedClinicalContext): ClinicalContext {
  return {
    patient_age: ucc.patient_age ?? null,
    patient_sex: ucc.patient_sex || null,
    chief_complaint: ucc.chief_complaint,
    symptom_duration: ucc.symptom_duration,
    medical_history: ucc.medical_history,
    current_medications: ucc.current_medications,
    allergies: ucc.allergies,
    temperature: ucc.vitals?.temperature ?? null,
    blood_pressure: ucc.vitals?.bp_systolic && ucc.vitals?.bp_diastolic
      ? `${ucc.vitals.bp_systolic}/${ucc.vitals.bp_diastolic}`
      : null,
    pulse: ucc.vitals?.pulse ?? null,
    oxygen_saturation: ucc.vitals?.spo2 ?? null,
    respiratory_rate: ucc.vitals?.respiratory_rate ?? null,
    weight: ucc.vitals?.weight_kg ?? null,
    height: ucc.vitals?.height_cm ?? null,
    // Previously dropped — now propagated to DDX/reasoning engines
    symptoms: ucc.symptoms,
    associated_symptoms: ucc.associated_symptoms,
    risk_flags: ucc.risk_flags,
    risk_factors: ucc.risk_factors,
  };
}
