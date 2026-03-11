/**
 * Clinical Learning System — Client Services
 * 
 * Provides typed APIs for:
 *   1. Learning signal capture (diagnosis corrections, treatment modifications)
 *   2. Outcome feedback tracking (diagnosis → treatment → recovery chain)
 *   3. Bias monitoring (fairness metrics + mitigation recommendations)
 */

import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export type OutcomeStatus = "pending" | "improved" | "unchanged" | "worsened" | "resolved" | "referred" | "unknown";

export interface OutcomeFeedback {
  visit_id: string;
  consultation_id?: string;
  patient_id: string;
  clinic_id: string;
  ai_diagnosis: string;
  doctor_final_diagnosis: string;
  treatment_prescribed?: any[];
  outcome_status?: OutcomeStatus;
  follow_up_required?: boolean;
  days_to_resolution?: number;
}

export interface DiagnosisCorrectionSignal {
  ai_diagnosis: string;
  doctor_final_diagnosis: string;
  was_corrected: boolean;
  correction_type?: "replacement" | "refinement" | "addition" | "removal";
  confidence_at_time?: number;
}

export interface TreatmentModificationSignal {
  ai_medications: string[];
  doctor_medications: string[];
  added: string[];
  removed: string[];
  modified: string[];
}

export interface SafetyOverrideSignal {
  alert_type: string;
  severity: string;
  override_reason: string;
  was_appropriate?: boolean;
}

export type BiasMetricType = "selection_bias" | "measurement_bias" | "label_bias" | "algorithmic_bias" | "demographic_parity" | "equalized_odds";

export interface BiasMetric {
  metric_type: BiasMetricType;
  dimension: string;
  dimension_value: string;
  sample_count: number;
  positive_rate: number;
  acceptance_rate: number;
  override_rate: number;
  disparity_score: number;
  passes_fairness: boolean;
  period_start: string;
  period_end: string;
}

export interface BiasAuditResult {
  success: boolean;
  metrics_computed: number;
  failing_metrics: number;
  overall_fairness: boolean;
  results: BiasMetric[];
  mitigation_recommendations: string[];
}

// ── Learning Signal Capture ──

/**
 * Capture a diagnosis correction signal.
 * Called when doctor modifies AI-suggested diagnosis.
 */
export async function captureDiagnosisCorrection(
  clinicId: string | null,
  signal: DiagnosisCorrectionSignal,
  visitId?: string,
  consultationId?: string,
): Promise<void> {
  try {
    await supabase.functions.invoke("capture-learning", {
      body: {
        signal_type: "diagnosis_correction",
        signal_data: signal,
        clinic_id: clinicId,
        visit_id: visitId,
        consultation_id: consultationId,
      },
    });
  } catch {
    // Non-blocking
  }
}

/**
 * Capture a treatment modification signal.
 */
export async function captureTreatmentModification(
  clinicId: string | null,
  signal: TreatmentModificationSignal,
): Promise<void> {
  try {
    await supabase.functions.invoke("capture-learning", {
      body: {
        signal_type: "treatment_modification",
        signal_data: signal,
        clinic_id: clinicId,
      },
    });
  } catch {
    // Non-blocking
  }
}

/**
 * Capture a safety override signal.
 */
export async function captureSafetyOverride(
  clinicId: string | null,
  signal: SafetyOverrideSignal,
  visitId?: string,
): Promise<void> {
  try {
    await supabase.functions.invoke("capture-learning", {
      body: {
        signal_type: "safety_alert_override",
        signal_data: signal,
        clinic_id: clinicId,
        visit_id: visitId,
      },
    });
  } catch {
    // Non-blocking
  }
}

// ── Outcome Feedback ──

/**
 * Record outcome feedback for a consultation.
 */
export async function recordOutcomeFeedback(
  feedback: OutcomeFeedback,
): Promise<void> {
  try {
    await supabase.functions.invoke("capture-learning", {
      body: {
        signal_type: "outcome_feedback",
        signal_data: feedback,
        clinic_id: feedback.clinic_id,
        visit_id: feedback.visit_id,
        consultation_id: feedback.consultation_id,
      },
    });
  } catch {
    // Non-blocking
  }
}

/**
 * Update outcome status for a visit (e.g., at follow-up).
 */
export async function updateOutcomeStatus(
  visitId: string,
  status: OutcomeStatus,
  daysToResolution?: number,
): Promise<void> {
  try {
    await (supabase as any).from("outcome_feedback")
      .update({
        outcome_status: status,
        days_to_resolution: daysToResolution || null,
        updated_at: new Date().toISOString(),
      })
      .eq("visit_id", visitId);
  } catch {
    // Non-blocking
  }
}

// ── Bias Monitoring ──

/**
 * Run bias audit for a clinic or platform-wide.
 */
export async function runBiasAudit(
  clinicId?: string,
  periodDays: number = 30,
): Promise<BiasAuditResult> {
  const { data, error } = await supabase.functions.invoke("bias-monitoring", {
    body: { clinic_id: clinicId || null, period_days: periodDays },
  });

  if (error) throw new Error(error.message || "Bias audit failed");
  return data as BiasAuditResult;
}

/**
 * Get recent bias metrics from the database.
 */
export async function getRecentBiasMetrics(
  clinicId?: string,
  limit: number = 50,
): Promise<BiasMetric[]> {
  let query = (supabase as any).from("bias_metrics")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (clinicId) query = query.eq("clinic_id", clinicId);

  const { data } = await query;
  return (data || []) as BiasMetric[];
}

// ── Learning Analytics Helpers ──

/**
 * Compute AI acceptance rate for a doctor.
 */
export async function getDoctorAcceptanceRate(
  doctorId: string,
): Promise<{ acceptance_rate: number; total_decisions: number; corrections: number }> {
  const { data } = await supabase
    .from("ai_decision_ledger")
    .select("doctor_action")
    .eq("doctor_id", doctorId);

  const entries = data || [];
  const total = entries.length;
  const accepted = entries.filter((e: any) => e.doctor_action === "accepted").length;

  return {
    acceptance_rate: total > 0 ? Math.round((accepted / total) * 1000) / 1000 : 0,
    total_decisions: total,
    corrections: total - accepted,
  };
}

/**
 * Get outcome statistics for a clinic.
 */
export async function getOutcomeStatistics(
  clinicId: string,
): Promise<Record<OutcomeStatus, number>> {
  const { data } = await (supabase as any).from("outcome_feedback")
    .select("outcome_status")
    .eq("clinic_id", clinicId);

  const stats: Record<string, number> = {
    pending: 0, improved: 0, unchanged: 0, worsened: 0,
    resolved: 0, referred: 0, unknown: 0,
  };

  for (const row of (data || [])) {
    const status = row.outcome_status || "unknown";
    stats[status] = (stats[status] || 0) + 1;
  }

  return stats as Record<OutcomeStatus, number>;
}

/**
 * Get bias summary for dashboard display.
 */
export function computeBiasSummary(metrics: BiasMetric[]): {
  total_metrics: number;
  passing: number;
  failing: number;
  fairness_score: number;
  worst_dimension: string | null;
} {
  if (metrics.length === 0) {
    return { total_metrics: 0, passing: 0, failing: 0, fairness_score: 100, worst_dimension: null };
  }

  const passing = metrics.filter(m => m.passes_fairness).length;
  const failing = metrics.length - passing;
  const fairnessScore = Math.round((passing / metrics.length) * 100);

  const worstMetric = metrics.reduce((worst, m) =>
    m.disparity_score > (worst?.disparity_score || 0) ? m : worst,
    metrics[0]
  );

  return {
    total_metrics: metrics.length,
    passing,
    failing,
    fairness_score: fairnessScore,
    worst_dimension: worstMetric.passes_fairness ? null : `${worstMetric.dimension}:${worstMetric.dimension_value}`,
  };
}
