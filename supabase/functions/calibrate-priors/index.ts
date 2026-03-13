/**
 * Calibrate Priors — Edge Function
 *
 * Computes probability calibration factors from historical outcome data.
 * Uses doctor corrections + outcome feedback to adjust disease priors:
 *
 *   1. Correction-based calibration: If doctors consistently correct
 *      diagnosis X → Y, boost Y's prior and penalize X's
 *   2. Outcome-based calibration: If diagnosed condition X leads to
 *      "worsened" outcomes, flag for prior review
 *   3. Graph expansion suggestions: Identify repeated corrections that
 *      indicate missing symptom-disease relationships
 *
 * Deterministic, DB-only — no LLM. Target: <200ms.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CalibrationInput {
  /** Diagnosis IDs to calibrate (from DDX candidates) */
  diagnosis_ids?: string[];
  /** Clinic ID for clinic-specific calibration (optional) */
  clinic_id?: string;
  /** Lookback period in days (default: 90) */
  lookback_days?: number;
  /** Minimum sample size to produce calibration (default: 5) */
  min_samples?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = performance.now();

  try {
    const input: CalibrationInput = await req.json();
    const lookbackDays = input.lookback_days || 90;
    const minSamples = input.min_samples || 5;
    const cutoffDate = new Date(Date.now() - lookbackDays * 86400000).toISOString();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Parallel data retrieval ──
    const [outcomeRes, correctionRes] = await Promise.all([
      // Outcome feedback with resolution data
      supabase
        .from("outcome_feedback")
        .select("ai_diagnosis, doctor_final_diagnosis, diagnosis_match, outcome_status, days_to_resolution, clinic_id")
        .gte("created_at", cutoffDate)
        .then((r: any) => r),

      // Diagnosis correction signals
      supabase
        .from("doctor_learning_signals")
        .select("signal_data, clinic_id, created_at")
        .eq("signal_type", "diagnosis_correction")
        .gte("created_at", cutoffDate)
        .then((r: any) => r),
    ]);

    const outcomes = outcomeRes.data || [];
    const corrections = correctionRes.data || [];

    // Filter by clinic if specified
    const filteredOutcomes = input.clinic_id
      ? outcomes.filter((o: any) => o.clinic_id === input.clinic_id)
      : outcomes;
    const filteredCorrections = input.clinic_id
      ? corrections.filter((c: any) => c.clinic_id === input.clinic_id)
      : corrections;

    // ── 1. Correction-Based Calibration ──
    // Track: AI said X → Doctor changed to Y
    const correctionCounts: Record<string, { total: number; corrections: number; replacements: Record<string, number> }> = {};

    for (const row of filteredOutcomes) {
      const ai = row.ai_diagnosis?.toLowerCase().trim();
      const doc = row.doctor_final_diagnosis?.toLowerCase().trim();
      if (!ai) continue;

      if (!correctionCounts[ai]) {
        correctionCounts[ai] = { total: 0, corrections: 0, replacements: {} };
      }
      correctionCounts[ai].total++;

      if (!row.diagnosis_match && doc && doc !== ai) {
        correctionCounts[ai].corrections++;
        correctionCounts[ai].replacements[doc] = (correctionCounts[ai].replacements[doc] || 0) + 1;
      }
    }

    // Also process learning signals
    for (const sig of filteredCorrections) {
      const data = sig.signal_data as any;
      if (!data?.ai_diagnosis) continue;

      const ai = data.ai_diagnosis.toLowerCase().trim();
      const doc = data.doctor_final_diagnosis?.toLowerCase().trim();

      if (!correctionCounts[ai]) {
        correctionCounts[ai] = { total: 0, corrections: 0, replacements: {} };
      }
      correctionCounts[ai].total++;

      if (data.was_corrected && doc && doc !== ai) {
        correctionCounts[ai].corrections++;
        correctionCounts[ai].replacements[doc] = (correctionCounts[ai].replacements[doc] || 0) + 1;
      }
    }

    // Compute calibration multipliers
    const priorCalibrations: Array<{
      diagnosis: string;
      calibration_factor: number;
      direction: "boost" | "penalize" | "neutral";
      sample_size: number;
      correction_rate: number;
      confidence: "high" | "moderate" | "low";
    }> = [];

    for (const [diagnosis, stats] of Object.entries(correctionCounts)) {
      if (stats.total < minSamples) continue;

      const correctionRate = stats.corrections / stats.total;
      let factor = 1.0;
      let direction: "boost" | "penalize" | "neutral" = "neutral";

      if (correctionRate > 0.4) {
        // High correction rate → penalize this diagnosis's prior
        factor = Math.max(0.5, 1.0 - correctionRate * 0.8);
        direction = "penalize";
      } else if (correctionRate < 0.1 && stats.total >= 10) {
        // Very low correction rate → boost this diagnosis's prior
        factor = Math.min(1.3, 1.0 + (1.0 - correctionRate) * 0.15);
        direction = "boost";
      }

      priorCalibrations.push({
        diagnosis,
        calibration_factor: Math.round(factor * 1000) / 1000,
        direction,
        sample_size: stats.total,
        correction_rate: Math.round(correctionRate * 1000) / 1000,
        confidence: stats.total >= 20 ? "high" : stats.total >= 10 ? "moderate" : "low",
      });
    }

    // ── 2. Outcome-Based Calibration ──
    const outcomeCalibrations: Array<{
      diagnosis: string;
      positive_outcome_rate: number;
      worsened_rate: number;
      sample_size: number;
      outcome_flag: "good" | "concerning" | "insufficient_data";
    }> = [];

    const outcomeBuckets: Record<string, { total: number; improved: number; resolved: number; worsened: number }> = {};
    for (const row of filteredOutcomes) {
      const dx = (row.doctor_final_diagnosis || row.ai_diagnosis || "").toLowerCase().trim();
      if (!dx) continue;

      if (!outcomeBuckets[dx]) {
        outcomeBuckets[dx] = { total: 0, improved: 0, resolved: 0, worsened: 0 };
      }
      outcomeBuckets[dx].total++;

      const status = row.outcome_status || "pending";
      if (status === "improved") outcomeBuckets[dx].improved++;
      if (status === "resolved") outcomeBuckets[dx].resolved++;
      if (status === "worsened") outcomeBuckets[dx].worsened++;
    }

    for (const [dx, stats] of Object.entries(outcomeBuckets)) {
      if (stats.total < minSamples) continue;

      const positiveRate = (stats.improved + stats.resolved) / stats.total;
      const worsenedRate = stats.worsened / stats.total;

      outcomeCalibrations.push({
        diagnosis: dx,
        positive_outcome_rate: Math.round(positiveRate * 1000) / 1000,
        worsened_rate: Math.round(worsenedRate * 1000) / 1000,
        sample_size: stats.total,
        outcome_flag: worsenedRate > 0.2 ? "concerning" : stats.total < 10 ? "insufficient_data" : "good",
      });
    }

    // ── 3. Graph Expansion Suggestions ──
    // Identify repeated corrections that indicate missing relationships
    const graphSuggestions: Array<{
      suggested_relationship: string;
      ai_missed_diagnosis: string;
      doctor_corrected_to: string;
      frequency: number;
      suggestion_type: "missing_symptom_link" | "missing_diagnosis" | "misweighted_prior";
    }> = [];

    for (const [aiDx, stats] of Object.entries(correctionCounts)) {
      for (const [docDx, count] of Object.entries(stats.replacements)) {
        if (count >= 3) {
          // Doctor consistently replaces AI diagnosis → suggest graph link
          graphSuggestions.push({
            suggested_relationship: `${aiDx} frequently corrected to ${docDx}`,
            ai_missed_diagnosis: docDx,
            doctor_corrected_to: docDx,
            frequency: count,
            suggestion_type: count >= 5 ? "missing_diagnosis" : "misweighted_prior",
          });
        }
      }
    }

    // Sort suggestions by frequency
    graphSuggestions.sort((a, b) => b.frequency - a.frequency);

    const executionMs = Math.round(performance.now() - start);

    const result = {
      prior_calibrations: priorCalibrations,
      outcome_calibrations: outcomeCalibrations,
      graph_expansion_suggestions: graphSuggestions.slice(0, 10),
      summary: {
        total_outcomes_analyzed: filteredOutcomes.length,
        total_corrections_analyzed: filteredCorrections.length,
        calibrations_computed: priorCalibrations.length,
        outcome_flags: outcomeCalibrations.filter(o => o.outcome_flag === "concerning").length,
        graph_suggestions: graphSuggestions.length,
        lookback_days: lookbackDays,
        min_samples: minSamples,
      },
      execution_ms: executionMs,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[CalibratePriors] Error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
