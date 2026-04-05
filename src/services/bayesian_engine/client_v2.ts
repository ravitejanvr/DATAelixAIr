/**
 * Probabilistic Diagnostic Engine v2 — Client Service
 *
 * Latent-state architecture. Shadow mode runner.
 * Same input interface as V1 for drop-in comparison.
 */

import { supabase } from "@/integrations/supabase/client";
import type { BayesianInput, BayesianResult } from "./client";

export interface LatentStateActivation {
  state: string;
  posterior: number;
  contribution: number;
}

export interface V2DiagnosisExtra {
  latent_state_contribution: number;
  latent_state_activations: LatentStateActivation[];
}

export interface V2Result extends BayesianResult {
  latent_state_posteriors?: Array<{ state: string; posterior: number }>;
  separation_validation?: Array<{ pair: string; delta_logP: number; sufficient: boolean }>;
}

/**
 * Run V2 probabilistic engine (latent state architecture).
 * Returns null on error. Used in shadow mode comparison.
 */
export async function calculateDiagnosticProbabilitiesV2(
  input: BayesianInput
): Promise<V2Result | null> {
  console.log("[ProbEngineV2Client] Running latent state engine (shadow mode)...");

  try {
    const { data, error } = await supabase.functions.invoke(
      "calculate-diagnostic-probabilities-v2",
      { body: input }
    );

    if (error) {
      console.error("[ProbEngineV2Client] Failed:", error);
      return null;
    }

    return data as V2Result;
  } catch (e) {
    console.error("[ProbEngineV2Client] Error:", e);
    return null;
  }
}

/**
 * Compare V1 and V2 outputs for shadow mode analysis.
 */
export function comparePipelineOutputs(
  v1: BayesianResult | null,
  v2: V2Result | null,
  diagNameMap?: Map<string, string>,
): void {
  if (!v1 || !v2) {
    console.log("[ShadowCompare] Cannot compare — missing V1 or V2 result");
    return;
  }

  const v1Top5 = v1.diagnoses.slice(0, 5);
  const v2Top5 = v2.diagnoses.slice(0, 5);

  const getName = (id: string) => diagNameMap?.get(id) || id.substring(0, 8);

  console.log("[ShadowCompare] ═══════════════════════════════════");
  console.log("[ShadowCompare] V1 (rule-weighted) vs V2 (latent-state)");
  console.log("[ShadowCompare] ───────────────────────────────────");

  for (let i = 0; i < Math.max(v1Top5.length, v2Top5.length); i++) {
    const v1d = v1Top5[i];
    const v2d = v2Top5[i];
    const v1Str = v1d ? `${getName(v1d.diagnosis_id)} ${(v1d.posterior_probability * 100).toFixed(1)}%` : "—";
    const v2Str = v2d ? `${getName(v2d.diagnosis_id)} ${(v2d.posterior_probability * 100).toFixed(1)}%` : "—";
    console.log(`[ShadowCompare] #${i + 1}: V1=${v1Str} | V2=${v2Str}`);
  }

  // Rank agreement
  const v1Ids = v1Top5.map(d => d.diagnosis_id);
  const v2Ids = v2Top5.map(d => d.diagnosis_id);
  const top1Match = v1Ids[0] === v2Ids[0];
  const top3Overlap = v1Ids.slice(0, 3).filter(id => v2Ids.slice(0, 3).includes(id)).length;

  console.log(`[ShadowCompare] Top-1 match: ${top1Match}, Top-3 overlap: ${top3Overlap}/3`);

  // Latent state info from V2
  if (v2.latent_state_posteriors) {
    const activeStates = v2.latent_state_posteriors.filter(s => s.posterior > 0.6);
    console.log(`[ShadowCompare] Active latent states: ${activeStates.map(s => `${s.state}(${(s.posterior * 100).toFixed(0)}%)`).join(", ")}`);
  }

  console.log("[ShadowCompare] ═══════════════════════════════════");
}
