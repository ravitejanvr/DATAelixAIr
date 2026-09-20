/**
 * V4 → O1 Orchestrator Bridge
 *
 * Architecture Freeze v1.0 — Rule 2 (Single Execution Entrypoint).
 *
 * The conversational path (ConversationEngine) previously ran a local
 * pipeline whose DDX / V3 stages were empty arrays. This bridge maps the
 * V4 PipelineInput into the canonical orchestrator input, executes
 * `runUnifiedClinicalPipeline` (the ONLY reasoning entrypoint), and maps the
 * result back into the V4 stage contracts.
 *
 * No reasoning happens here — mapping only. Deterministic, no mutation.
 */

import type { ClinicalContext as LibClinicalContext } from "@/lib/clinical-context";
import type {
  PipelineInput as O1PipelineInput,
  PipelineResult as O1PipelineResult,
} from "@/services/clinical_pipeline/orchestrator";
import type { PipelineInput as V4PipelineInput, DDXCandidate } from "./types";

export interface BridgedReasoning {
  ddxCandidates: DDXCandidate[];
  v3Diagnoses: Array<{
    diagnosis_id: string;
    diagnosis_name: string;
    probability: number;
    rank: number;
    source?: string;
  }>;
  o1Result: O1PipelineResult | null;
}

/** Map a V4 PipelineInput into the canonical orchestrator input. */
export function v4InputToO1Input(input: V4PipelineInput): O1PipelineInput {
  const v = input.vitals || {};
  const bpStr =
    v.bp_systolic != null && v.bp_diastolic != null
      ? `${v.bp_systolic}/${v.bp_diastolic}`
      : null;

  const symptoms = (input.symptoms || []).filter(Boolean);
  const chiefComplaint = (input.raw_text || symptoms[0] || "").trim();

  const clinical_context: LibClinicalContext = {
    patient_age: input.patient_age ?? null,
    patient_sex: input.patient_sex ?? null,
    height: v.height_cm ?? null,
    weight: v.weight_kg ?? null,
    blood_pressure: bpStr,
    pulse: v.pulse ?? null,
    temperature: v.temperature ?? null,
    respiratory_rate: v.respiratory_rate ?? null,
    oxygen_saturation: v.spo2 ?? null,
    chief_complaint: chiefComplaint,
    symptom_duration: "",
    medical_history: input.medical_history || [],
    current_medications: input.current_medications || [],
    allergies: input.allergies || [],
    symptoms,
    associated_symptoms: [],
    risk_flags: [],
    risk_factors: [],
    family_history: input.family_history || [],
    patient_id: input.patient_id || null,
  };

  return {
    clinical_context,
    visit_id: input.visit_id || null,
    clinic_id: input.clinic_id || null,
  };
}

/** Map an orchestrator result into the V4 DDX / V3 stage contracts. */
export function o1ResultToV4Reasoning(result: O1PipelineResult | null): BridgedReasoning {
  const ranked = result?.ddx?.differential_diagnoses || [];

  // ddxCandidates feed the cognitive/completeness layers, which need the raw
  // DDX shape (supporting/contradicting feature IDs, category) — that part of
  // the bridge is correct as-is and stays sourced from the DDX engine output.
  const ddxCandidates: DDXCandidate[] = ranked.map((d: any) => ({
    diagnosis_id: String(d.diagnosis_id ?? d.diagnosis_name ?? ""),
    diagnosis_name: String(d.diagnosis_name ?? ""),
    probability: Number(d.probability ?? 0),
    supporting_features: Array.isArray(d.supporting_features)
      ? d.supporting_features.map((f: any) => String(f?.feature_id ?? f))
      : [],
    contradicting_features: Array.isArray(d.contradicting_features)
      ? d.contradicting_features.map((f: any) => String(f?.feature_id ?? f))
      : [],
    must_not_miss: Boolean(d.must_not_miss),
    category: String(d.category ?? d.system ?? "unspecified"),
  }));

  // v3Diagnoses feeds resolveAuthority()'s final ranking — this must be O1's
  // actual final output (fusedBayesian, on `result.bayesian`), not the raw
  // pre-fusion DDX candidate list. O1 itself treats `bayesian.diagnoses` as
  // canonical for ranking (see orchestrator.ts's own SOAP generation: "Use
  // fusedBayesian (post-override) for SOAP diagnosis ranking") — it carries
  // clinical-priority-resolution's must-not-miss promotion, evidence-updated
  // posteriors, and resolved diagnosis_name/rank (enrichBayesianWithNames),
  // none of which the raw DDX list has. Reading `ddx.differential_diagnoses`
  // here silently discarded all of that and let V4 re-derive a *different*
  // ranking from earlier, unprocessed data — the root cause of the cockpit
  // (O1/Clinical.tsx) vs conversational (V4/ClinicalInteraction.tsx) rank
  // divergence found in the 2026-09-20 architecture inventory (ROADMAP item 24).
  const bayesianDiagnoses = result?.bayesian?.diagnoses;
  const v3Diagnoses = bayesianDiagnoses && bayesianDiagnoses.length > 0
    ? bayesianDiagnoses.map((d: any, i: number) => ({
        diagnosis_id: String(d.diagnosis_id ?? ""),
        diagnosis_name: String(d.diagnosis_name ?? d.diagnosis_id ?? ""),
        probability: Number(d.posterior_probability ?? 0),
        rank: Number(d.rank ?? i + 1),
        source: "o1_fused_bayesian",
      }))
    : ranked.map((d: any, i: number) => ({
        // Fallback only: mirrors orchestrator.ts's own fusedBayesian-unavailable
        // fallback to the raw DDX list, not a second independent ranking path.
        diagnosis_id: String(d.diagnosis_id ?? d.diagnosis_name ?? ""),
        diagnosis_name: String(d.diagnosis_name ?? ""),
        probability: Number(d.probability ?? 0),
        rank: i + 1,
        source: "o1_unified_pipeline_ddx_fallback",
      }));

  return { ddxCandidates, v3Diagnoses, o1Result: result ?? null };
}
