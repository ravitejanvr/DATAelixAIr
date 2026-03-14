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

export interface SafetyTrace {
  danger_detected: boolean;
  expected_danger: boolean;
  safety_alerts: number;
  safety_score: number;
  dangerous_diagnoses: string[];
  correct: boolean;
}

export interface FinalRankingTrace {
  ranking: Array<{ rank: number; diagnosis: string; diagnosis_id: string; probability: number }>;
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
