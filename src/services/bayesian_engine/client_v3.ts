/**
 * Probabilistic Diagnostic Engine v3 — Client Service
 *
 * Discriminative competitive architecture.
 * 25 diagnosis-selective composite states with anti-correlated mappings.
 * Delta-based contribution: (statePosterior - statePrior) × logLR
 */

import { supabase } from "@/integrations/supabase/client";
import type { BayesianInput, BayesianResult } from "./client";

export interface V3StateActivation {
  state: string;
  delta: number;
  logLR: number;
  contribution: number;
}

export interface V3DiagnosisExtra {
  v3_state_score: number;
  symptom_score: number;
  modifier_score: number;
  state_activations: V3StateActivation[];
  positive_state_count: number;
  negative_state_count: number;
}

export interface V3Result extends BayesianResult {
  latent_state_posteriors?: Array<{
    state: string;
    prior: number;
    posterior: number;
    delta: number;
    conflict_group: string | null;
  }>;
  separation_validation?: Array<{ pair: string; delta_logP: number; sufficient: boolean }>;
  architecture?: string;
  state_count?: number;
  prior_weight_lambda?: number;
  temperature?: number;
  data_completeness?: number;
}

/**
 * Run V3 probabilistic engine (discriminative competitive architecture).
 * Returns null on error.
 */
export async function calculateDiagnosticProbabilitiesV3(
  input: BayesianInput
): Promise<V3Result | null> {
  console.log("[ProbEngineV3Client] Running discriminative competitive engine...");

  try {
    const { data, error } = await supabase.functions.invoke(
      "calculate-diagnostic-probabilities-v3",
      { body: input }
    );

    if (error) {
      console.error("[ProbEngineV3Client] Failed:", error);
      return null;
    }

    return data as V3Result;
  } catch (e) {
    console.error("[ProbEngineV3Client] Error:", e);
    return null;
  }
}

/**
 * Compare V2 and V3 outputs for shadow mode analysis.
 */
export function compareV2V3Outputs(
  v2: BayesianResult | null,
  v3: V3Result | null,
): void {
  if (!v2 || !v3) {
    console.log("[V2V3Compare] Cannot compare — missing V2 or V3 result");
    return;
  }

  const v2Top5 = v2.diagnoses.slice(0, 5);
  const v3Top5 = v3.diagnoses.slice(0, 5);

  console.log("[V2V3Compare] ═══════════════════════════════════");
  console.log("[V2V3Compare] V2 (latent-state) vs V3 (discriminative)");
  console.log("[V2V3Compare] ───────────────────────────────────");

  for (let i = 0; i < Math.max(v2Top5.length, v3Top5.length); i++) {
    const v2d = v2Top5[i];
    const v3d = v3Top5[i];
    const v2Str = v2d ? `${v2d.diagnosis_id.substring(0, 8)} ${(v2d.posterior_probability * 100).toFixed(1)}%` : "—";
    const v3Str = v3d ? `${v3d.diagnosis_id.substring(0, 8)} ${(v3d.posterior_probability * 100).toFixed(1)}%` : "—";
    console.log(`[V2V3Compare] #${i + 1}: V2=${v2Str} | V3=${v3Str}`);
  }

  const v2Ids = v2Top5.map(d => d.diagnosis_id);
  const v3Ids = v3Top5.map(d => d.diagnosis_id);
  const top1Match = v2Ids[0] === v3Ids[0];
  const top3Overlap = v2Ids.slice(0, 3).filter(id => v3Ids.slice(0, 3).includes(id)).length;

  console.log(`[V2V3Compare] Top-1 match: ${top1Match}, Top-3 overlap: ${top3Overlap}/3`);

  if (v3.architecture) {
    console.log(`[V2V3Compare] V3 architecture: ${v3.architecture}, states: ${v3.state_count}, λ=${v3.prior_weight_lambda}, T=${v3.temperature}`);
  }

  console.log("[V2V3Compare] ═══════════════════════════════════");
}
