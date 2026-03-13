/**
 * Meta-Learning Engine — Cognitive Layer
 *
 * Monitors diagnostic model performance and computes calibration metrics.
 * Periodically generates performance reports that inform the calibration
 * pipeline about systematic biases in the reasoning system.
 *
 * Stores metrics in model_calibration_metrics table.
 */

import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface CalibrationMetrics {
  total_cases: number;
  top1_accuracy: number;
  top3_accuracy: number;
  top5_accuracy: number;
  avg_confidence: number;
  calibration_error: number;
  overconfidence_rate: number;
  underconfidence_rate: number;
  danger_detection_rate: number;
  avg_latency_ms: number;
  correction_rate: number;
}

export interface PerformanceReport {
  period: string;
  period_start: string;
  period_end: string;
  metrics: CalibrationMetrics;
  breakdown_by_specialty: Record<string, CalibrationMetrics>;
  recommendations: string[];
}

// ── Public API ──

/**
 * Compute calibration metrics from diagnostic outcomes over a period.
 */
export async function computeCalibrationMetrics(
  clinicId: string,
  lookbackDays = 30,
): Promise<CalibrationMetrics> {
  try {
    const since = new Date(Date.now() - lookbackDays * 86400000).toISOString();

    const { data: outcomes, error } = await supabase
      .from("diagnostic_outcomes" as any)
      .select("*")
      .eq("clinic_id", clinicId)
      .gte("created_at", since);

    if (error || !outcomes || (outcomes as any[]).length === 0) {
      return emptyMetrics();
    }

    const total = (outcomes as any[]).length;
    let top1Match = 0;
    let corrected = 0;
    let confidenceSum = 0;
    let overconfident = 0;
    let underconfident = 0;

    for (const o of outcomes as any[]) {
      const sim = o.similarity_score || 0;
      if (sim >= 0.85) top1Match++;
      if (o.correction_type !== "match") corrected++;
      const conf = o.metadata?.confidence_score || 0;
      confidenceSum += conf;

      // Calibration: high confidence but wrong = overconfident
      if (conf > 0.7 && sim < 0.5) overconfident++;
      // Low confidence but right = underconfident
      if (conf < 0.4 && sim >= 0.85) underconfident++;
    }

    return {
      total_cases: total,
      top1_accuracy: total > 0 ? top1Match / total : 0,
      top3_accuracy: 0, // Would need DDX stored
      top5_accuracy: 0,
      avg_confidence: total > 0 ? confidenceSum / total : 0,
      calibration_error: Math.abs((total > 0 ? confidenceSum / total : 0) - (total > 0 ? top1Match / total : 0)),
      overconfidence_rate: total > 0 ? overconfident / total : 0,
      underconfidence_rate: total > 0 ? underconfident / total : 0,
      danger_detection_rate: 0,
      avg_latency_ms: 0,
      correction_rate: total > 0 ? corrected / total : 0,
    };
  } catch (e) {
    console.error("[MetaLearning] Metrics computation failed:", e);
    return emptyMetrics();
  }
}

/**
 * Generate and persist a performance report.
 */
export async function generatePerformanceReport(
  clinicId: string,
  period: "daily" | "weekly" | "monthly" = "weekly",
): Promise<PerformanceReport> {
  const lookbackDays = period === "daily" ? 1 : period === "weekly" ? 7 : 30;
  const periodEnd = new Date().toISOString();
  const periodStart = new Date(Date.now() - lookbackDays * 86400000).toISOString();

  const metrics = await computeCalibrationMetrics(clinicId, lookbackDays);
  const recommendations = generateRecommendations(metrics);

  // Persist
  try {
    await supabase.from("model_calibration_metrics" as any).insert({
      clinic_id: clinicId,
      metric_period: period,
      period_start: periodStart,
      period_end: periodEnd,
      total_cases: metrics.total_cases,
      top1_accuracy: metrics.top1_accuracy,
      top3_accuracy: metrics.top3_accuracy,
      top5_accuracy: metrics.top5_accuracy,
      avg_confidence: metrics.avg_confidence,
      calibration_error: metrics.calibration_error,
      overconfidence_rate: metrics.overconfidence_rate,
      underconfidence_rate: metrics.underconfidence_rate,
      danger_detection_rate: metrics.danger_detection_rate,
      avg_latency_ms: metrics.avg_latency_ms,
      correction_rate: metrics.correction_rate,
      learning_updates_applied: 0,
    } as any);
  } catch (e) {
    console.warn("[MetaLearning] Persist report failed:", e);
  }

  return {
    period,
    period_start: periodStart,
    period_end: periodEnd,
    metrics,
    breakdown_by_specialty: {},
    recommendations,
  };
}

/**
 * Get historical performance trend.
 */
export async function getPerformanceTrend(
  clinicId: string,
  periods = 12,
): Promise<Array<{ period_start: string; top1_accuracy: number; correction_rate: number; calibration_error: number }>> {
  try {
    const { data, error } = await supabase
      .from("model_calibration_metrics" as any)
      .select("period_start, top1_accuracy, correction_rate, calibration_error")
      .eq("clinic_id", clinicId)
      .order("period_start", { ascending: false })
      .limit(periods);

    if (error || !data) return [];
    return (data as any[]).reverse();
  } catch {
    return [];
  }
}

// ── Helpers ──

function emptyMetrics(): CalibrationMetrics {
  return {
    total_cases: 0, top1_accuracy: 0, top3_accuracy: 0, top5_accuracy: 0,
    avg_confidence: 0, calibration_error: 0, overconfidence_rate: 0,
    underconfidence_rate: 0, danger_detection_rate: 0, avg_latency_ms: 0,
    correction_rate: 0,
  };
}

function generateRecommendations(m: CalibrationMetrics): string[] {
  const recs: string[] = [];
  if (m.total_cases < 10) {
    recs.push("Insufficient case volume for reliable calibration. Continue data collection.");
    return recs;
  }
  if (m.overconfidence_rate > 0.15) {
    recs.push("High overconfidence rate detected. Consider reducing baseline confidence scores.");
  }
  if (m.correction_rate > 0.3) {
    recs.push("High correction rate. Review knowledge graph coverage for frequently corrected diagnoses.");
  }
  if (m.calibration_error > 0.2) {
    recs.push("Significant calibration error. Run prior recalibration via learning pipeline.");
  }
  if (m.top1_accuracy < 0.5) {
    recs.push("Low top-1 accuracy. Investigate symptom-disease likelihood weights.");
  }
  if (recs.length === 0) {
    recs.push("Model performance within acceptable parameters. No immediate action required.");
  }
  return recs;
}
