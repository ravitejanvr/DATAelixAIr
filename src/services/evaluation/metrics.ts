/**
 * V2 Evaluation Metrics Engine
 * Computes calibration, accuracy, sensitivity, separation, and bias metrics.
 */

import type { EvalCaseResult, EvalSuiteResult } from "./runner";

export interface CategoryMetrics {
  category: string;
  total: number;
  top1_correct: number;
  top3_correct: number;
  errors: number;
  top1_accuracy: number;
  top3_recall: number;
  avg_score: number;
  avg_delta_logP: number;
  avg_entropy: number;
  avg_latency_ms: number;
}

export interface DiagnosisFrequency {
  diagnosis: string;
  count: number;
  pct: number;
  correct_when_predicted: number;
}

export interface CalibrationBucket {
  range: string;
  lo: number;
  hi: number;
  count: number;
  avg_predicted: number;
  avg_correct: number; // fraction of correct in this bucket
}

export interface SweepPoint {
  case_id: string;
  sweep_value: number;
  predicted: string;
  score: number;
}

export interface FullMetrics {
  // Accuracy
  top1_accuracy: number;
  top3_recall: number;
  // Calibration
  brier_score: number;
  ece: number;
  calibration_buckets: CalibrationBucket[];
  // Confidence
  avg_entropy: number;
  overconfident_count: number; // wrong + score > 0.5
  underconfident_count: number; // correct + score < 0.2
  // Separation
  avg_delta_logP: number;
  pct_ambiguous: number; // ΔlogP < 0.3
  pct_strong_separation: number; // ΔlogP > 1.0
  // Bias
  diagnosis_frequency: DiagnosisFrequency[];
  dominant_diagnosis: string | null; // if any > 30%
  // Per-category
  category_metrics: CategoryMetrics[];
  // Sweep data
  lactate_sweep: SweepPoint[];
  spo2_sweep: SweepPoint[];
  sbp_sweep: SweepPoint[];
  // Summary
  total_cases: number;
  valid_cases: number;
  error_cases: number;
}

export function computeFullMetrics(suite: EvalSuiteResult): FullMetrics {
  const all = suite.results;
  const valid = all.filter(r => !r.error);
  const errors = all.filter(r => !!r.error);

  // Top-1, Top-3
  const top1Correct = valid.filter(r => r.top1_match).length;
  const top3Correct = valid.filter(r => r.top3_match).length;
  const top1_accuracy = valid.length > 0 ? top1Correct / valid.length : 0;
  const top3_recall = valid.length > 0 ? top3Correct / valid.length : 0;

  // Brier score: mean of (predicted_score - correct)^2
  // For top-1: correct=1 if match, 0 if not
  const brierSum = valid.reduce((sum, r) => {
    const correct = r.top1_match ? 1 : 0;
    return sum + Math.pow(r.predicted_top1_score - correct, 2);
  }, 0);
  const brier_score = valid.length > 0 ? brierSum / valid.length : 1;

  // ECE: expected calibration error
  const bucketRanges: [number, number][] = [
    [0, 0.1], [0.1, 0.2], [0.2, 0.3], [0.3, 0.4], [0.4, 0.5],
    [0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1.01],
  ];

  const calibration_buckets: CalibrationBucket[] = [];
  let eceSum = 0;

  for (const [lo, hi] of bucketRanges) {
    const inBucket = valid.filter(r => r.predicted_top1_score >= lo && r.predicted_top1_score < hi);
    if (inBucket.length === 0) continue;
    const avgPredicted = inBucket.reduce((s, r) => s + r.predicted_top1_score, 0) / inBucket.length;
    const avgCorrect = inBucket.filter(r => r.top1_match).length / inBucket.length;
    calibration_buckets.push({
      range: `${(lo * 100).toFixed(0)}-${(hi * 100).toFixed(0)}%`,
      lo, hi, count: inBucket.length,
      avg_predicted: Math.round(avgPredicted * 1000) / 1000,
      avg_correct: Math.round(avgCorrect * 1000) / 1000,
    });
    eceSum += (inBucket.length / valid.length) * Math.abs(avgPredicted - avgCorrect);
  }

  // Confidence
  const avg_entropy = valid.length > 0
    ? valid.reduce((s, r) => s + r.entropy, 0) / valid.length : 0;
  const overconfident_count = valid.filter(r => !r.top1_match && r.predicted_top1_score > 0.5).length;
  const underconfident_count = valid.filter(r => r.top1_match && r.predicted_top1_score < 0.2).length;

  // Separation
  const avg_delta_logP = valid.length > 0
    ? valid.reduce((s, r) => s + r.delta_logP, 0) / valid.length : 0;
  const pct_ambiguous = valid.length > 0
    ? valid.filter(r => r.delta_logP < 0.3).length / valid.length : 0;
  const pct_strong_separation = valid.length > 0
    ? valid.filter(r => r.delta_logP > 1.0).length / valid.length : 0;

  // Bias: frequency of each diagnosis as top-1
  const freqMap = new Map<string, { count: number; correct: number }>();
  for (const r of valid) {
    const dx = r.predicted_top1;
    const entry = freqMap.get(dx) || { count: 0, correct: 0 };
    entry.count++;
    if (r.top1_match) entry.correct++;
    freqMap.set(dx, entry);
  }
  const diagnosis_frequency: DiagnosisFrequency[] = Array.from(freqMap.entries())
    .map(([dx, { count, correct }]) => ({
      diagnosis: dx,
      count,
      pct: Math.round((count / valid.length) * 1000) / 10,
      correct_when_predicted: count > 0 ? Math.round((correct / count) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const dominant_diagnosis = diagnosis_frequency.length > 0 && diagnosis_frequency[0].pct > 30
    ? diagnosis_frequency[0].diagnosis : null;

  // Per-category
  const categories = [...new Set(all.map(r => r.category))];
  const category_metrics: CategoryMetrics[] = categories.map(cat => {
    const catResults = all.filter(r => r.category === cat);
    const catValid = catResults.filter(r => !r.error);
    const catTop1 = catValid.filter(r => r.top1_match).length;
    const catTop3 = catValid.filter(r => r.top3_match).length;
    return {
      category: cat,
      total: catResults.length,
      top1_correct: catTop1,
      top3_correct: catTop3,
      errors: catResults.filter(r => !!r.error).length,
      top1_accuracy: catValid.length > 0 ? Math.round((catTop1 / catValid.length) * 100) / 100 : 0,
      top3_recall: catValid.length > 0 ? Math.round((catTop3 / catValid.length) * 100) / 100 : 0,
      avg_score: catValid.length > 0 ? Math.round((catValid.reduce((s, r) => s + r.predicted_top1_score, 0) / catValid.length) * 1000) / 1000 : 0,
      avg_delta_logP: catValid.length > 0 ? Math.round((catValid.reduce((s, r) => s + r.delta_logP, 0) / catValid.length) * 1000) / 1000 : 0,
      avg_entropy: catValid.length > 0 ? Math.round((catValid.reduce((s, r) => s + r.entropy, 0) / catValid.length) * 1000) / 1000 : 0,
      avg_latency_ms: catValid.length > 0 ? Math.round(catValid.reduce((s, r) => s + r.latency_ms, 0) / catValid.length) : 0,
    };
  });

  // Sweep data extraction
  const lactate_sweep = all
    .filter(r => r.case_id.startsWith("SWEEP-LAC"))
    .map(r => ({
      case_id: r.case_id,
      sweep_value: parseFloat(r.case_id.replace("SWEEP-LAC-", "")),
      predicted: r.predicted_top1,
      score: r.predicted_top1_score,
    }))
    .sort((a, b) => a.sweep_value - b.sweep_value);

  const spo2_sweep = all
    .filter(r => r.case_id.startsWith("SWEEP-SPO2"))
    .map(r => ({
      case_id: r.case_id,
      sweep_value: parseFloat(r.case_id.replace("SWEEP-SPO2-", "")),
      predicted: r.predicted_top1,
      score: r.predicted_top1_score,
    }))
    .sort((a, b) => a.sweep_value - b.sweep_value);

  const sbp_sweep = all
    .filter(r => r.case_id.startsWith("SWEEP-SBP"))
    .map(r => ({
      case_id: r.case_id,
      sweep_value: parseFloat(r.case_id.replace("SWEEP-SBP-", "")),
      predicted: r.predicted_top1,
      score: r.predicted_top1_score,
    }))
    .sort((a, b) => a.sweep_value - b.sweep_value);

  return {
    top1_accuracy: Math.round(top1_accuracy * 1000) / 1000,
    top3_recall: Math.round(top3_recall * 1000) / 1000,
    brier_score: Math.round(brier_score * 10000) / 10000,
    ece: Math.round(eceSum * 10000) / 10000,
    calibration_buckets,
    avg_entropy: Math.round(avg_entropy * 1000) / 1000,
    overconfident_count,
    underconfident_count,
    avg_delta_logP: Math.round(avg_delta_logP * 1000) / 1000,
    pct_ambiguous: Math.round(pct_ambiguous * 1000) / 10,
    pct_strong_separation: Math.round(pct_strong_separation * 1000) / 10,
    diagnosis_frequency,
    dominant_diagnosis,
    category_metrics,
    lactate_sweep,
    spo2_sweep,
    sbp_sweep,
    total_cases: all.length,
    valid_cases: valid.length,
    error_cases: errors.length,
  };
}

export function getSystemVerdict(m: FullMetrics): {
  label: string;
  color: string;
  details: string[];
} {
  const issues: string[] = [];
  if (m.top1_accuracy < 0.7) issues.push(`Top-1 accuracy ${(m.top1_accuracy * 100).toFixed(0)}% < 70%`);
  if (m.top3_recall < 0.9) issues.push(`Top-3 recall ${(m.top3_recall * 100).toFixed(0)}% < 90%`);
  if (m.ece > 0.08) issues.push(`ECE ${m.ece.toFixed(3)} > 0.08`);
  if (m.brier_score > 0.20) issues.push(`Brier ${m.brier_score.toFixed(3)} > 0.20`);
  if (m.avg_delta_logP < 0.5) issues.push(`Avg ΔlogP ${m.avg_delta_logP.toFixed(2)} < 0.5`);
  if (m.dominant_diagnosis) issues.push(`Bias: ${m.dominant_diagnosis} dominates at ${m.diagnosis_frequency[0]?.pct}%`);

  if (issues.length === 0) return { label: "PRODUCTION-READY", color: "text-primary", details: ["All thresholds met"] };
  if (issues.length <= 2) return { label: "PROBABILISTIC & CALIBRATED", color: "text-blue-500", details: issues };
  if (issues.length <= 4) return { label: "PROBABILISTIC BUT BIASED", color: "text-yellow-500", details: issues };
  return { label: "NOT PRODUCTION-READY", color: "text-destructive", details: issues };
}
