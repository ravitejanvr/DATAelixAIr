/**
 * Benchmark v9 — Types
 *
 * Aligned with current pipeline architecture:
 *   1. Input normalization
 *   2. Physiology inference
 *   3. Candidate generation (DDX)
 *   4. Bayesian ranking
 *   5. Cognitive pruning
 *   6. Safety evaluation
 *   7. Final ranked diagnoses
 *
 * Phase 9 additions:
 *   - SafetyAlertEntry for decoupled safety_alerts[] channel
 *   - Alert-aware safety metrics
 *   - Dual-mode comparison types
 */

export interface NormalizationTrace {
  raw_tokens: string[];
  normalized_tokens: string[];
  mappings: Array<{ original: string; canonical: string; changed: boolean }>;
  expected_match_rate: number;
}

export interface PhysiologyTrace {
  states_activated: Array<{ state: string; confidence: number; system: string }>;
  affected_organ_systems: string[];
  candidate_diagnosis_ids: string[];
  expected_state_match_rate: number;
  expected_system_match: boolean;
}

export interface CandidateGenerationTrace {
  candidates: Array<{ name: string; diagnosis_id: string; probability: number; must_not_miss: boolean }>;
  candidate_count: number;
  gold_in_candidates: boolean;
  gold_candidate_rank: number | null;
  gold_candidate_probability: number | null;
}

export interface BayesianTrace {
  ranked_diagnoses: Array<{ diagnosis: string; probability: number }>;
  gold_rank_after_bayesian: number | null;
}

export interface CognitivePruningTrace {
  total_evaluated: number;
  kept: number;
  pruned: number;
  escalated: number;
  pruned_names: string[];
  gold_pruned: boolean;
  quality_score: number;
}

/** Individual safety alert from the Phase 9 decoupled channel */
export interface SafetyAlertEntry {
  condition: string;
  severity: string;
  source: "ddx_engine" | "cluster_detector" | "vital_trigger";
  trigger_symptoms: string[];
  context_gate_passed: boolean;
}

export interface SafetyTrace {
  danger_detected: boolean;
  expected_danger: boolean;
  safety_alerts: number;
  safety_score: number;
  dangerous_diagnoses: string[];
  expected_dangerous_diagnoses: string[];
  dangerous_diagnoses_in_candidates: string[];
  correct: boolean;
  detection_details: string;

  /** Phase 9: individual alert entries from decoupled channel */
  alert_entries?: SafetyAlertEntry[];
  /** Phase 9: safety detected via alerts channel (not ranking) */
  alert_channel_detected?: boolean;
  /** Phase 9: safety detected via ranking presence */
  ranking_channel_detected?: boolean;
}

export interface FinalRankingTrace {
  ranking: Array<{ rank: number; diagnosis: string; diagnosis_id: string; probability: number; ranking_source: "bayesian" | "fallback_ddx" }>;
  gold_rank: number | null;
  top1_match: boolean;
  top3_match: boolean;
  top5_match: boolean;
}

export interface StageLatency {
  stage: string;
  latency_ms: number;
  status: "success" | "error" | "skipped";
  error?: string;
}

export interface BenchmarkResult {
  scenario_id: string;
  scenario_name: string;
  timestamp: string;
  passed: boolean;

  /** Which mode was used for this run */
  pipeline_mode: "phase8" | "phase9";

  // Full pipeline trace
  normalization: NormalizationTrace;
  physiology: PhysiologyTrace;
  candidate_generation: CandidateGenerationTrace;
  bayesian: BayesianTrace;
  cognitive_pruning: CognitivePruningTrace;
  safety: SafetyTrace;
  final_ranking: FinalRankingTrace;

  // Aggregate metrics
  metrics: {
    candidate_recall: boolean;
    top1_accuracy: boolean;
    top3_accuracy: boolean;
    safety_correct: boolean;
    /** Phase 9: safety detected via alert channel OR ranking */
    safety_detected_combined: boolean;
    physiology_activated: boolean;
    normalization_applied: boolean;
    soap_generated: boolean;
    total_latency_ms: number;
    latency_under_5s: boolean;
  };

  stage_latencies: StageLatency[];

  // Failure analysis
  failure_reasons: string[];
  recommendations: string[];

  // Raw pipeline output (for debugging)
  raw_output: any;
}

/** Aggregate metrics across all scenarios in a suite run */
export interface BenchmarkSuiteResult {
  timestamp: string;
  total_scenarios: number;
  passed: number;
  failed: number;

  /** Which mode produced this result */
  pipeline_mode: "phase8" | "phase9";

  // Accuracy metrics (percentage 0-100)
  top1_accuracy: number;
  top3_accuracy: number;
  top5_accuracy: number;
  candidate_recall: number;

  // Legacy safety metric (ranking-only)
  safety_detection_rate: number;

  // Phase 9 alert-aware safety metrics
  safety_sensitivity: number;
  safety_specificity: number;
  alert_precision: number;
  alert_recall: number;
  alert_to_ranking_overlap: number;

  // Latency
  avg_latency_ms: number;
  max_latency_ms: number;
  min_latency_ms: number;

  // Per-scenario results
  results: BenchmarkResult[];

  // Failure summary
  failure_summary: Array<{
    scenario: string;
    reasons: string[];
  }>;
}

/** Per-scenario comparison between Phase 8 and Phase 9 */
export interface ScenarioDiff {
  scenario_id: string;
  scenario_name: string;
  phase8_top1: string | null;
  phase9_top1: string | null;
  top1_changed: boolean;
  phase8_gold_rank: number | null;
  phase9_gold_rank: number | null;
  ranking_improved: boolean;
  ranking_degraded: boolean;
  phase8_safety_correct: boolean;
  phase9_safety_correct: boolean;
  safety_changed: boolean;
  acceptable: boolean;
  reason: string;
}

/** Full comparison report */
export interface PhaseComparisonReport {
  timestamp: string;
  phase8_metrics: Omit<BenchmarkSuiteResult, "results" | "failure_summary">;
  phase9_metrics: Omit<BenchmarkSuiteResult, "results" | "failure_summary">;
  deltas: {
    top1_delta: number;
    top3_delta: number;
    top5_delta: number;
    recall_delta: number;
    safety_sensitivity_delta: number;
    safety_specificity_delta: number;
  };
  scenario_diffs: ScenarioDiff[];
  regressions: ScenarioDiff[];
  improvements: ScenarioDiff[];
  verdict: "READY" | "NOT_READY";
  verdict_reasons: string[];
}
