/**
 * Benchmark → ClinicalContext Adapter
 *
 * Converts benchmark case formats (v9 MergedContextObject, v10 BenchmarkCaseV10)
 * into the canonical ClinicalContext consumed by the production orchestrator.
 *
 * This ensures benchmarks exercise the SAME code path as production.
 */

import type { ClinicalContext } from "@/lib/clinical-context";
import type { MergedContextObject } from "@/services/context_service";
import type { BenchmarkCaseV10 } from "@/services/benchmark_v10/types";
import type { PipelineInput } from "@/services/clinical_pipeline/orchestrator";

/**
 * Convert a v9 MergedContextObject into a ClinicalContext + PipelineInput.
 */
export function v9CaseToPipelineInput(mco: MergedContextObject): PipelineInput {
  const bpStr =
    mco.vitals?.bp_systolic != null && mco.vitals?.bp_diastolic != null
      ? `${mco.vitals.bp_systolic}/${mco.vitals.bp_diastolic}`
      : null;

  const clinical_context: ClinicalContext = {
    patient_age: (mco as any).patient_age ?? null,
    patient_sex: (mco as any).patient_sex ?? null,
    height: mco.vitals?.height_cm ?? null,
    weight: mco.vitals?.weight_kg ?? null,
    blood_pressure: bpStr,
    pulse: mco.vitals?.pulse ?? null,
    temperature: mco.vitals?.temperature ?? null,
    respiratory_rate: mco.vitals?.respiratory_rate ?? null,
    oxygen_saturation: mco.vitals?.spo2 ?? null,
    chief_complaint: mco.chief_complaint || "",
    symptom_duration: mco.symptom_duration || "",
    medical_history: mco.medical_history || [],
    current_medications: mco.medications || [],
    allergies: mco.allergies || [],
    symptoms: mco.symptoms || [],
    associated_symptoms: mco.associated_symptoms || [],
    risk_flags: mco.risk_flags || [],
    risk_factors: mco.risk_factors || [],
    family_history: mco.family_history || [],
    onset_pattern: (mco as any).onset_pattern ?? undefined,
    severity: (mco as any).severity ?? undefined,
    body_location: (mco as any).body_location ?? undefined,
    patient_id: mco.patient_id || null,
  };

  return {
    clinical_context,
    visit_id: mco.visit_id || null,
    clinic_id: mco.clinic_id || null,
    skip_cache: true,
  };
}

/**
 * Convert a v10 BenchmarkCaseV10 into a ClinicalContext + PipelineInput.
 */
export function v10CaseToPipelineInput(c: BenchmarkCaseV10): PipelineInput {
  const v = c.input.vitals;
  const bpStr =
    v.bp_systolic != null && v.bp_diastolic != null
      ? `${v.bp_systolic}/${v.bp_diastolic}`
      : null;

  const clinical_context: ClinicalContext = {
    patient_age: null,
    patient_sex: null,
    height: v.height_cm ?? null,
    weight: v.weight_kg ?? null,
    blood_pressure: bpStr,
    pulse: v.pulse ?? null,
    temperature: v.temperature ?? null,
    respiratory_rate: v.respiratory_rate ?? null,
    oxygen_saturation: v.spo2 ?? null,
    chief_complaint: c.input.chief_complaint || "",
    symptom_duration: c.input.symptom_duration || "",
    medical_history: c.input.history || [],
    current_medications: c.input.medications || [],
    allergies: c.input.allergies || [],
    symptoms: c.input.symptoms || [],
    associated_symptoms: c.input.associated_symptoms || [],
    risk_factors: c.input.risk_factors || [],
    risk_flags: [],
    family_history: [],
  };

  return {
    clinical_context,
    visit_id: `bench-v10-${c.case_id}`,
    clinic_id: "bench-clinic-001",
    skip_cache: true,
  };
}
