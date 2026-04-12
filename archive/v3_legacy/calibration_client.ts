/**
 * Prior Calibration Service — Client
 *
 * Retrieves learned calibration factors from historical outcome data
 * and doctor corrections. Used by the orchestrator to adjust disease
 * priors before Bayesian scoring.
 *
 * Calibration types:
 *   1. Correction-based: Penalizes over-predicted, boosts under-predicted diagnoses
 *   2. Outcome-based: Flags diagnoses with poor outcome rates
 *   3. Graph expansion: Suggests missing knowledge graph relationships
 */

import { supabase } from "@/integrations/supabase/client";

export interface PriorCalibration {
  diagnosis: string;
  calibration_factor: number;
  direction: "boost" | "penalize" | "neutral";
  sample_size: number;
  correction_rate: number;
  confidence: "high" | "moderate" | "low";
}

export interface OutcomeCalibration {
  diagnosis: string;
  positive_outcome_rate: number;
  worsened_rate: number;
  sample_size: number;
  outcome_flag: "good" | "concerning" | "insufficient_data";
}

export interface GraphExpansionSuggestion {
  suggested_relationship: string;
  ai_missed_diagnosis: string;
  doctor_corrected_to: string;
  frequency: number;
  suggestion_type: "missing_symptom_link" | "missing_diagnosis" | "misweighted_prior";
}

export interface CalibrationResult {
  prior_calibrations: PriorCalibration[];
  outcome_calibrations: OutcomeCalibration[];
  graph_expansion_suggestions: GraphExpansionSuggestion[];
  summary: {
    total_outcomes_analyzed: number;
    total_corrections_analyzed: number;
    calibrations_computed: number;
    outcome_flags: number;
    graph_suggestions: number;
    lookback_days: number;
    min_samples: number;
  };
  execution_ms: number;
}

// ── Cached calibration (refreshed every 30 min) ──
let _cachedCalibration: CalibrationResult | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get calibration factors. Caches for 30 minutes.
 */
export async function getCalibrationFactors(
  clinicId?: string,
  forceRefresh = false,
): Promise<CalibrationResult | null> {
  // Return cached if fresh
  if (!forceRefresh && _cachedCalibration && Date.now() - _cacheTimestamp < CACHE_TTL_MS) {
    return _cachedCalibration;
  }

  try {
    const { data, error } = await supabase.functions.invoke("calibrate-priors", {
      body: {
        clinic_id: clinicId || undefined,
        lookback_days: 90,
        min_samples: 5,
      },
    });

    if (error) {
      console.error("[CalibrationService] Failed:", error);
      return null;
    }

    _cachedCalibration = data as CalibrationResult;
    _cacheTimestamp = Date.now();
    return _cachedCalibration;
  } catch (e) {
    console.error("[CalibrationService] Error:", e);
    return null;
  }
}

/**
 * Apply calibration factors to DDX probabilities.
 * Returns adjusted probabilities as a Map<diagnosis_name_lower, multiplier>.
 */
export function buildCalibrationMap(
  calibration: CalibrationResult,
): Map<string, number> {
  const map = new Map<string, number>();

  for (const cal of calibration.prior_calibrations) {
    if (cal.direction !== "neutral" && cal.confidence !== "low") {
      map.set(cal.diagnosis.toLowerCase(), cal.calibration_factor);
    }
  }

  return map;
}

/**
 * Clear the calibration cache (for testing/refresh).
 */
export function clearCalibrationCache(): void {
  _cachedCalibration = null;
  _cacheTimestamp = 0;
}
