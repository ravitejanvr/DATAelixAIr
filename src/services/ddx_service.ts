/**
 * DDX Engine Service — Canonical Interface
 *
 * Reads from the Clinical Context Object and produces
 * ranked differential diagnoses via the DDX edge function.
 */

import { runDDXEngine as invokeDDX, type DDXInput, type DDXResult } from "@/services/ddx_engine/client";
import type { MergedContextObject } from "@/services/context_service";

export type { DDXResult, DDXDiagnosis, DDXLabRecommendation, DDXMedication, DDXGuideline } from "@/services/ddx_engine/client";

export interface DDXOutput {
  diagnoses: Array<{
    diagnosis: string;
    diagnosis_id: string;
    probability_score: number;
    supporting_symptoms: string[];
    must_not_miss: boolean;
  }>;
  recommended_labs: Array<{ test_name: string; priority: string; differentiates: string[] }>;
  raw: DDXResult | null;
}

/**
 * Run the DDX engine using a merged context object.
 */
export async function runDifferentialDiagnosis(ctx: MergedContextObject): Promise<DDXOutput> {
  const input: DDXInput = {
    symptoms: [...ctx.symptoms, ...(ctx.associated_symptoms || [])],
    vitals: ctx.vitals ? {
      temperature: ctx.vitals.temperature,
      spo2: ctx.vitals.spo2,
      pulse: ctx.vitals.pulse,
      bp: ctx.vitals.bp_systolic && ctx.vitals.bp_diastolic
        ? `${ctx.vitals.bp_systolic}/${ctx.vitals.bp_diastolic}`
        : undefined,
    } : undefined,
    medical_history: ctx.medical_history,
    current_medications: ctx.medications,
    allergies: ctx.allergies,
    risk_factors: ctx.risk_factors,
    visit_id: ctx.visit_id,
    clinic_id: ctx.clinic_id,
  };

  const result = await invokeDDX(input);

  if (!result) {
    return { diagnoses: [], recommended_labs: [], raw: null };
  }

  return {
    diagnoses: result.differential_diagnoses.map(d => ({
      diagnosis: d.diagnosis_name,
      diagnosis_id: d.diagnosis_id,
      probability_score: d.probability,
      supporting_symptoms: d.supporting_symptoms,
      must_not_miss: d.must_not_miss,
    })),
    recommended_labs: result.recommended_labs.map(l => ({
      test_name: l.test_name,
      priority: l.priority,
      differentiates: l.differentiates,
    })),
    raw: result,
  };
}
