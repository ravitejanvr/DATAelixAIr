/**
 * Benchmark v10 — Multi-Layer Clinical Evaluation Types
 *
 * 4 benchmark layers:
 *   L1: Control (30 existing cases — regression tracking)
 *   L2: Noisy Real-World (50 cases — robustness)
 *   L3: Ambiguous Competition (40 cases — discrimination)
 *   L4: Adversarial Safety (30 cases — safety edge cases)
 */

// ── Case Structure ──

export type BenchmarkLayer = "control" | "noisy" | "ambiguous" | "adversarial";
export type EvaluationType = "single" | "multi-label";

export interface BenchmarkCaseV10 {
  case_id: string;
  layer: BenchmarkLayer;
  name: string;
  description: string;
  organ_system: string;
  input: {
    chief_complaint: string;
    symptoms: string[];
    associated_symptoms?: string[];
    history: string[];
    medications?: string[];
    allergies?: string[];
    risk_factors?: string[];
    vitals: {
      bp_systolic?: number;
      bp_diastolic?: number;
      pulse?: number;
      temperature?: number;
      spo2?: number;
      respiratory_rate?: number;
      weight_kg?: number;
      height_cm?: number;
    };
    noise?: string[];
    symptom_duration?: string;
  };
  ground_truth: {
    primary: string;
    acceptable_alternatives: string[];
    must_not_miss: string[];
  };
  evaluation: {
    type: EvaluationType;
    safety_expected: boolean;
    minimum_safety_signals?: string[];
  };
}

// ── Per-Case Result ──

export interface CaseResult {
  case_id: string;
  layer: BenchmarkLayer;
  name: string;
  predicted_top5: Array<{ diagnosis: string; probability: number }>;
  gold_rank: number | null;
  top1_match: boolean;
  top3_match: boolean;
  top5_match: boolean;
  candidate_recall: boolean;
  safety_triggered: boolean;
  safety_alerts: Array<{ condition: string; severity: string; source: string }>;
  safety_expected: boolean;
  safety_correct: boolean;
  clinical_acceptability: number;
  latency_ms: number;
  failure_reasons: string[];
}

// ── Suite-Level Metrics ──

export interface LayerMetrics {
  layer: BenchmarkLayer;
  total_cases: number;
  top1_accuracy: number;
  top3_accuracy: number;
  top5_accuracy: number;
  candidate_recall: number;
  safety_sensitivity: number;
  safety_specificity: number;
  alert_precision: number;
  alert_recall: number;
  clinical_acceptability_score: number;
  noise_robustness_score: number;
  ambiguity_resolution_score: number;
  ranking_stability_score: number;
  avg_latency_ms: number;
  max_latency_ms: number;
}

export interface SuiteRunResult {
  run_id: string;
  timestamp: string;
  benchmark_version: string;
  pipeline_phase: string;
  total_cases: number;
  passed: number;
  failed: number;
  layer_metrics: LayerMetrics[];
  aggregate_metrics: {
    top1_accuracy: number;
    top3_accuracy: number;
    top5_accuracy: number;
    candidate_recall: number;
    safety_sensitivity: number;
    safety_specificity: number;
    alert_precision: number;
    alert_recall: number;
    clinical_acceptability_score: number;
    avg_latency_ms: number;
  };
  results: CaseResult[];
  failure_summary: Array<{ case_id: string; name: string; reasons: string[] }>;
}

// ── Comparison ──

export interface SuiteComparison {
  timestamp: string;
  run_a: { run_id: string; phase: string; version: string };
  run_b: { run_id: string; phase: string; version: string };
  metric_deltas: Record<string, number>;
  per_layer_deltas: Array<{ layer: BenchmarkLayer; deltas: Record<string, number> }>;
  regressions: Array<{ case_id: string; name: string; reason: string }>;
  improvements: Array<{ case_id: string; name: string; reason: string }>;
  verdict: "SAFE" | "UNSAFE" | "REVIEW";
  verdict_reasons: string[];
}

// ── Audit Report ──

export interface BenchmarkAuditReport {
  coverage_score: number;
  ambiguity_score: number;
  noise_score: number;
  clinical_realism_score: number;
  failure_modes_detected: string[];
  organ_system_coverage: Record<string, number>;
  layer_composition: Record<BenchmarkLayer, number>;
}
