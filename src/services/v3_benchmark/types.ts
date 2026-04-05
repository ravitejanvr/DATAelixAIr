/**
 * V3 Benchmark Suite — Types
 */

export type V3BenchCategory = "strong_systemic" | "pure_local" | "ambiguous_overlap";

export interface V3BenchCase {
  id: string;
  name: string;
  category: V3BenchCategory;
  expected_top1: string;
  top3_sufficient?: boolean;
  hero?: boolean;
  input: {
    symptoms: string[];
    vitals: Record<string, any>;
    risk_factors?: string[];
    medical_history?: string[];
    age: number;
    sex: string;
    duration?: string;
  };
}

export interface V3BenchCaseResult {
  case_id: string;
  case_name: string;
  category: V3BenchCategory;
  expected_top1: string;
  top3: Array<{ diagnosis: string; probability: number }>;
  ground_truth_rank: number | null;
  top1_match: boolean;
  top3_match: boolean;
  confidence_gap: number;
  latency_ms: number;
  failure_reason?: string;
  error?: string;
}

export interface V3BenchMetrics {
  top1_accuracy: number;
  top3_recall: number;
  systemic_top1: number;
  local_top1: number;
  ambiguous_top3: number;
  systemic_sensitivity: number;
  local_sensitivity: number;
  ambiguous_sensitivity: number;
  avg_confidence_correct: number;
  avg_confidence_gap: number;
  fragile_count: number;
  systemic_flip_count: number;
  generic_overuse_rate: number;
  precision: number;
}

export interface V3BenchFailureBreakdown {
  missing_state: number;
  weak_discrimination: number;
  feature_mismatch: number;
  generic_leakage: number;
  scoring_interference: number;
}

export interface V3BenchSuiteResult {
  timestamp: string;
  total_cases: number;
  metrics: V3BenchMetrics;
  failure_breakdown: V3BenchFailureBreakdown;
  results: V3BenchCaseResult[];
  verdict: "production_ready" | "needs_stabilization";
}
