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
 * Includes SafetyAlertEntry for the decoupled safety_alerts[] channel and
 * alert-aware safety metrics. The former dual-mode (Phase 8/9) comparison
 * types were removed 2026-09-19 — see runner.ts's header comment.
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

  /**
   * The engine that actually produced this ranking, per
   * PipelineResult.engine_audit.engine_version. See engine_force.ts and
   * CLAUDE.md's 2026-09-19 entry for why this is read from the executed
   * result rather than any requested config.
   */
  engine_version: string | null;

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

  /** The engine(s) that actually executed across this suite's results — "mixed" if they differ. */
  engine_version: string | null;

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

