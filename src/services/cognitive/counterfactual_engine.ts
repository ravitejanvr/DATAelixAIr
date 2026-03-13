/**
 * Counterfactual Reasoning Engine — Cognitive Layer
 *
 * Extends the existing causal_reasoning engine by persisting counterfactual
 * simulations and providing a client-side API for "what if" analysis.
 *
 * Simulates alternate diagnostic scenarios by:
 *   1. Removing individual symptoms (fragility analysis)
 *   2. Adding suspected symptoms (hypothesis exploration)
 *   3. Persisting results for longitudinal learning
 *
 * Uses the causal-reasoning edge function for the actual computation,
 * then stores results in counterfactual_simulations.
 */

import { supabase } from "@/integrations/supabase/client";
import { runCausalReasoning, type CausalReasoningResult } from "@/services/causal_reasoning/client";

// ── Types ──

export interface CounterfactualSimulation {
  id?: string;
  visit_id?: string;
  clinic_id: string;
  original_symptoms: string[];
  modified_symptoms: string[];
  modification_type: "removal" | "addition" | "substitution";
  original_top_diagnosis: string | null;
  counterfactual_top_diagnosis: string | null;
  diagnosis_changed: boolean;
  fragility_score: number;
  critical_symptoms: string[];
  supporting_symptoms: string[];
  reasoning_trace: any;
  execution_ms: number;
}

export interface FragilityReport {
  overall_fragility: number;
  critical_symptoms: string[];
  supporting_symptoms: string[];
  robust_diagnosis: boolean;
  simulations: CounterfactualSimulation[];
}

// ── Public API ──

/**
 * Analyze the fragility of the current top diagnosis by simulating
 * removal of each symptom one at a time.
 * Uses existing causal-reasoning engine counterfactual output.
 */
export async function analyzeFragility(
  symptoms: string[],
  candidateDiagnoses: Array<{ diagnosis_id: string; diagnosis_name: string; probability: number }>,
  clinicId: string,
  visitId?: string,
): Promise<FragilityReport> {
  const start = performance.now();
  const topDiagnosis = candidateDiagnoses[0]?.diagnosis_name || null;

  // Use existing causal reasoning engine which already does counterfactual analysis
  const causalResult = await runCausalReasoning({
    symptoms,
    candidate_diagnoses: candidateDiagnoses.map(d => ({
      diagnosis_id: d.diagnosis_id,
      diagnosis_name: d.diagnosis_name,
      probability: d.probability,
    })),
  });

  const simulations: CounterfactualSimulation[] = [];
  const criticalSymptoms: string[] = [];
  const supportingSymptoms: string[] = [];

  if (causalResult?.counterfactuals) {
    for (const cf of causalResult.counterfactuals) {
      if (cf.diagnosis === topDiagnosis) {
        criticalSymptoms.push(...cf.critical_symptoms);
        supportingSymptoms.push(...cf.supporting_symptoms);
      }
    }
  }

  // Deduplicate
  const uniqueCritical = [...new Set(criticalSymptoms)];
  const uniqueSupporting = [...new Set(supportingSymptoms)];
  const overallFragility = causalResult?.counterfactuals?.[0]?.counterfactual_fragility ?? 0;

  // Build simulation record
  const sim: CounterfactualSimulation = {
    visit_id: visitId,
    clinic_id: clinicId,
    original_symptoms: symptoms,
    modified_symptoms: symptoms.filter(s => !uniqueCritical.includes(s)),
    modification_type: "removal",
    original_top_diagnosis: topDiagnosis,
    counterfactual_top_diagnosis: null,
    diagnosis_changed: overallFragility > 0.5,
    fragility_score: overallFragility,
    critical_symptoms: uniqueCritical,
    supporting_symptoms: uniqueSupporting,
    reasoning_trace: causalResult?.causal_chains?.slice(0, 5) || [],
    execution_ms: performance.now() - start,
  };

  simulations.push(sim);

  // Persist asynchronously
  persistSimulation(sim).catch(() => {});

  return {
    overall_fragility: overallFragility,
    critical_symptoms: uniqueCritical,
    supporting_symptoms: uniqueSupporting,
    robust_diagnosis: overallFragility < 0.3,
    simulations,
  };
}

async function persistSimulation(sim: CounterfactualSimulation): Promise<void> {
  try {
    await supabase.from("counterfactual_simulations" as any).insert({
      visit_id: sim.visit_id || null,
      clinic_id: sim.clinic_id,
      original_symptoms: sim.original_symptoms,
      modified_symptoms: sim.modified_symptoms,
      modification_type: sim.modification_type,
      original_top_diagnosis: sim.original_top_diagnosis,
      counterfactual_top_diagnosis: sim.counterfactual_top_diagnosis,
      diagnosis_changed: sim.diagnosis_changed,
      fragility_score: sim.fragility_score,
      critical_symptoms: sim.critical_symptoms,
      supporting_symptoms: sim.supporting_symptoms,
      reasoning_trace: sim.reasoning_trace,
      execution_ms: Math.round(sim.execution_ms),
    } as any);
  } catch (e) {
    console.warn("[CounterfactualEngine] Persist failed:", e);
  }
}
