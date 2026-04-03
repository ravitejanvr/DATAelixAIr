/**
 * Bayesian Diagnostic Probability Engine v6 — Client Service
 *
 * Computes posterior probabilities for candidate diagnoses using:
 *   - Disease priors (prevalence × demographic modifiers)
 *   - Symptom likelihoods P(S|D) with specificity weighting
 *   - Physiology likelihoods P(Φ|D)
 *   - Risk factor modifiers
 *   - Medical history prior multipliers
 *   - Duration & onset temporal modifiers
 *   - Vital sign modifiers (disease-specific)
 *   - Symptom cluster modifiers
 *   - Systemic instability conditioning (v6)
 */

import { supabase } from "@/integrations/supabase/client";

export interface BayesianDiagnosis {
  diagnosis_id: string;
  posterior_probability: number;
  prior: number;
  history_multiplier?: number;
  symptom_likelihood: number;
  coverage_ratio?: number;
  physiology_likelihood: number;
  risk_modifier: number;
  duration_modifier?: number;
  onset_modifier?: number;
  vital_modifier?: number;
  cluster_modifier?: number;
  supporting_evidence: string[];
  must_not_miss: boolean;
}

export interface BayesianResult {
  diagnoses: BayesianDiagnosis[];
  total_candidates: number;
  symptoms_resolved: number;
  physiology_states_used: number;
  risk_factors_applied: number;
  history_modifiers_applied?: number;
  duration_category?: string | null;
  onset_pattern?: string | null;
  vitals_signals_applied?: number;
  cluster_matches?: number;
  systemic_conditioning_applied?: boolean;
  systemic_state_used?: SystemicStateInput | null;
  execution_ms: number;
  source: string;
}

export interface SystemicStateInput {
  instability_level: "LOW" | "MODERATE" | "HIGH";
  signal_count: number;
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
  duration?: string | null;
  onset_pattern?: string | null;
  severity?: string | null;
  body_location?: string | null;
  enable_systemic_likelihood?: boolean;
  systemic_state?: SystemicStateInput | null;
}

/**
 * Run the Bayesian diagnostic probability engine.
 */
export async function calculateDiagnosticProbabilities(
  input: BayesianInput
): Promise<BayesianResult | null> {
  console.log("[BayesianEngine] Computing diagnostic probabilities...", 
    input.enable_systemic_likelihood ? "(systemic conditioning ON)" : "(standard mode)");

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
