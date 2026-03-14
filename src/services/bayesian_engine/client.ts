/**
 * Bayesian Diagnostic Probability Engine — Client Service
 *
 * Computes posterior probabilities for candidate diagnoses using:
 *   - Disease priors (prevalence × demographic modifiers)
 *   - Symptom likelihoods P(S|D)
 *   - Physiology likelihoods P(Φ|D)
 *   - Risk factor modifiers
 */

import { supabase } from "@/integrations/supabase/client";

export interface BayesianDiagnosis {
  diagnosis_id: string;
  posterior_probability: number;
  prior: number;
  symptom_likelihood: number;
  physiology_likelihood: number;
  risk_modifier: number;
  supporting_evidence: string[];
  must_not_miss: boolean;
}

export interface BayesianResult {
  diagnoses: BayesianDiagnosis[];
  total_candidates: number;
  symptoms_resolved: number;
  physiology_states_used: number;
  risk_factors_applied: number;
  execution_ms: number;
  source: string;
}

export interface BayesianInput {
  candidate_diagnosis_ids: string[];
  symptoms: string[];
  physiological_state_ids?: string[];
  risk_factors?: string[];
  medical_history?: string[];
  patient_age?: number | null;
  patient_sex?: string | null;
  region?: string;
  vitals?: Record<string, any>;
}

/**
 * Run the Bayesian diagnostic probability engine.
 */
export async function calculateDiagnosticProbabilities(
  input: BayesianInput
): Promise<BayesianResult | null> {
  console.log("[BayesianEngine] Computing diagnostic probabilities...");

  try {
    const { data, error } = await supabase.functions.invoke("calculate-diagnostic-probabilities", {
      body: input,
    });

    if (error) {
      console.error("[BayesianEngine] Failed:", error);
      return null;
    }

    return data as BayesianResult;
  } catch (e) {
    console.error("[BayesianEngine] Error:", e);
    return null;
  }
}
